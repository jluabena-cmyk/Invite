/**
 * ocrDraftController
 *
 * Pure lifecycle helpers for the OCR draft feature. Extracted from
 * app/event/[id].tsx so they can be unit-tested without React Native rendering.
 *
 * Each function is intentionally side-effect-only against the supplied
 * callbacks / AsyncStorage so tests can inject fakes for both.
 */

import { Alert } from "react-native";
import type { OcrDraftResult } from "@workspace/api-client-react";
import { saveOcrDraft, loadOcrDraft, clearOcrDraft } from "./ocrDraft";

export type DraftItem = {
  localId: string;
  name: string;
  quantity: string;
  priceStr: string;
};

export type DraftFieldError = { name?: string; quantity?: string; priceStr?: string };

export type DraftSetters = {
  setOcrDraft: (v: OcrDraftResult | null) => void;
  setDraftItems: (v: DraftItem[]) => void;
  setDraftPhotoId: (v: number | null) => void;
  setDraftErrors: (v: Record<string, DraftFieldError>) => void;
  setIsDraftModalVisible: (v: boolean) => void;
  setDraftHydrated: (v: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Restore (on mount / eventId change)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a persisted OCR draft from AsyncStorage and hydrate state via setters.
 * Returns a cleanup function (as expected by useEffect) that cancels the async
 * read if the component unmounts before it completes.
 */
export function restoreDraft(
  eventId: number,
  setters: DraftSetters,
): () => void {
  setters.setDraftHydrated(false);
  let cancelled = false;

  loadOcrDraft(eventId).then((stored) => {
    if (cancelled) return;
    if (stored) {
      setters.setDraftPhotoId(stored.photoId);
      setters.setOcrDraft(stored.ocrDraft);
      setters.setDraftItems(stored.draftItems);
      setters.setIsDraftModalVisible(true);
    }
    setters.setDraftHydrated(true);
  });

  return () => {
    cancelled = true;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus restore (on every screen focus — guards the iOS context-purge case)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by useFocusEffect each time the screen gains focus.
 *
 * Two cases:
 *  - Draft already in memory (user pressed Keep then switched tabs) → simply
 *    re-surface the review sheet.
 *  - No draft in memory and eventId > 0 → re-read AsyncStorage.  This handles
 *    the iOS context-purge scenario where the component remounts but the
 *    restore useEffect ran before eventId resolved to a valid value.
 *    Sets draftHydrated(true) once the read settles so the persist effect
 *    remains active after recovery.
 *
 * Returns an optional cleanup that cancels the async read on unmount /
 * re-focus (mirrors the useEffect contract expected by useFocusEffect).
 */
export function focusRestoreDraft(
  eventId: number,
  currentOcrDraft: OcrDraftResult | null,
  setters: DraftSetters,
): (() => void) | void {
  if (currentOcrDraft !== null) {
    // Draft already loaded — just reopen the sheet.
    setters.setIsDraftModalVisible(true);
    return;
  }

  if (eventId <= 0) return;

  let cancelled = false;
  loadOcrDraft(eventId).then((stored) => {
    if (cancelled) return;
    if (stored) {
      setters.setDraftPhotoId(stored.photoId);
      setters.setOcrDraft(stored.ocrDraft);
      setters.setDraftItems(stored.draftItems);
      setters.setIsDraftModalVisible(true);
    }
    // Always settle hydration so the persist effect stays active after a
    // context-purge recovery, even when no draft was found.
    setters.setDraftHydrated(true);
  });

  return () => {
    cancelled = true;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist (whenever draft state changes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write the current draft to AsyncStorage, or clear it when there is no draft.
 * A no-op until hydration is complete to avoid clearing a draft before restore.
 */
export async function persistDraft(
  eventId: number,
  ocrDraft: OcrDraftResult | null,
  photoId: number | null,
  draftItems: DraftItem[],
  hydrated: boolean,
): Promise<void> {
  if (eventId <= 0 || !hydrated) return;
  if (ocrDraft !== null && photoId !== null) {
    await saveOcrDraft(eventId, photoId, ocrDraft, draftItems);
  } else if (ocrDraft === null) {
    await clearOcrDraft(eventId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keep (hide modal, preserve storage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hide the draft review sheet without discarding the draft.
 * AsyncStorage is untouched so the draft resurfaces when the user returns.
 */
export function keepDraft(
  setters: Pick<DraftSetters, "setIsDraftModalVisible">,
): void {
  setters.setIsDraftModalVisible(false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Discard (clear storage and reset all draft state)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discard the OCR draft: reset all in-memory state and remove the entry from
 * AsyncStorage.  Called from the "Discard" Alert button and from handleConfirmDraft
 * after a successful commit.
 */
export function discardDraft(
  eventId: number,
  setters: Omit<DraftSetters, "setDraftHydrated">,
): void {
  setters.setIsDraftModalVisible(false);
  setters.setOcrDraft(null);
  setters.setDraftItems([]);
  setters.setDraftPhotoId(null);
  setters.setDraftErrors({});
  void clearOcrDraft(eventId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Close alert (presents Keep / Discard choice to the user)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show the Alert that asks the user whether to keep or discard the draft.
 * Delegates to keepDraft / discardDraft on button press.
 */
export function openDraftCloseAlert(
  eventId: number,
  setters: Omit<DraftSetters, "setDraftHydrated">,
): void {
  Alert.alert(
    "Discard unconfirmed items?",
    "Your scanned items haven't been added to the bill yet. Discard them or keep them for later?",
    [
      {
        text: "Keep",
        style: "cancel",
        onPress: () => keepDraft(setters),
      },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => discardDraft(eventId, setters),
      },
    ],
  );
}
