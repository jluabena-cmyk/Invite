/**
 * Tests for ocrDraftController — the lifecycle handler layer used by
 * app/event/[id].tsx for OCR draft persist/restore/keep/discard/confirm.
 *
 * Covered scenarios:
 * 1.  restoreDraft — no stored data: only setDraftHydrated(true) is called
 * 2.  restoreDraft — stored data found: all setters are called and modal is shown
 * 3.  restoreDraft — cancellation: setters are NOT called after cleanup fires
 * 4.  persistDraft — skip when not hydrated (avoids race-condition clear on mount)
 * 5.  persistDraft — skip when eventId ≤ 0
 * 6.  persistDraft — saves when draft is present and hydrated
 * 7.  persistDraft — clears storage when ocrDraft is null and hydrated
 * 8.  keepDraft  — only hides modal; AsyncStorage is unchanged
 * 9.  discardDraft — resets all state setters and removes draft from storage
 * 10. openDraftCloseAlert → Keep branch fires keepDraft
 * 11. openDraftCloseAlert → Discard branch fires discardDraft
 * 12. Full navigation cycle: save → restore verifies modal reopens with correct data
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── In-memory AsyncStorage mock ───────────────────────────────────────────────

const asyncStore: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStore[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStore[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete asyncStore[key];
    }),
  },
}));

// ── Alert mock (captures button callbacks so we can invoke them) ──────────────

type AlertButton = { text: string; onPress?: () => void };
let capturedAlertButtons: AlertButton[] = [];

vi.mock("react-native", () => ({
  Alert: {
    alert: vi.fn(
      (_title: string, _msg: string, buttons: AlertButton[]) => {
        capturedAlertButtons = buttons ?? [];
      },
    ),
  },
}));

// ── Imports after mocks are registered ───────────────────────────────────────

import {
  restoreDraft,
  focusRestoreDraft,
  persistDraft,
  keepDraft,
  discardDraft,
  openDraftCloseAlert,
} from "../ocrDraftController";
import { saveOcrDraft, loadOcrDraft } from "../ocrDraft";
import type { OcrDraftResult } from "@workspace/api-client-react";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EVENT_ID = 10;
const PHOTO_ID = 3;

const OCR_DRAFT: OcrDraftResult = {
  items: [
    { name: "Ramen", priceStr: "14.00", quantity: 1 },
    { name: "Edamame", priceStr: "5.00", quantity: 2 },
  ],
  subtotal: "24.00",
  tax: "1.92",
  total: "25.92",
};

const DRAFT_ITEMS = [
  { localId: "a1", name: "Ramen", quantity: "1", priceStr: "14.00" },
  { localId: "b2", name: "Edamame", quantity: "2", priceStr: "5.00" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearStore() {
  for (const k of Object.keys(asyncStore)) delete asyncStore[k];
}

function makeSetters() {
  return {
    setOcrDraft: vi.fn(),
    setDraftItems: vi.fn(),
    setDraftPhotoId: vi.fn(),
    setDraftErrors: vi.fn(),
    setIsDraftModalVisible: vi.fn(),
    setDraftHydrated: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ocrDraftController", () => {
  beforeEach(() => {
    clearStore();
    capturedAlertButtons = [];
    vi.clearAllMocks();
  });

  // ── 1. restoreDraft: nothing stored ────────────────────────────────────────

  it("restoreDraft sets hydrated=true but does not open modal when no draft is stored", async () => {
    const setters = makeSetters();
    restoreDraft(EVENT_ID, setters);

    // Give the async loadOcrDraft a tick to resolve.
    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setDraftHydrated).toHaveBeenCalledWith(false); // reset on start
    expect(setters.setDraftHydrated).toHaveBeenCalledWith(true);  // settled
    expect(setters.setIsDraftModalVisible).not.toHaveBeenCalled();
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
  });

  // ── 2. restoreDraft: draft exists ─────────────────────────────────────────

  it("restoreDraft hydrates all setters and opens the modal when a draft is stored", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    restoreDraft(EVENT_ID, setters);
    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setDraftPhotoId).toHaveBeenCalledWith(PHOTO_ID);
    expect(setters.setOcrDraft).toHaveBeenCalledWith(OCR_DRAFT);
    expect(setters.setDraftItems).toHaveBeenCalledWith(DRAFT_ITEMS);
    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(true);
    expect(setters.setDraftHydrated).toHaveBeenCalledWith(true);
  });

  // ── 3. restoreDraft: cancellation ─────────────────────────────────────────

  it("restoreDraft does not call setters after the returned cleanup is invoked", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    const cleanup = restoreDraft(EVENT_ID, setters);

    // Simulate component unmounting before the promise resolves.
    cleanup();

    await new Promise((r) => setTimeout(r, 0));

    // setDraftHydrated(false) was already called synchronously before the async read.
    // After cancellation the .then() callback should be a no-op.
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    expect(setters.setIsDraftModalVisible).not.toHaveBeenCalled();
    expect(setters.setDraftHydrated).not.toHaveBeenCalledWith(true);
  });

  // ── 4. persistDraft: skipped when not hydrated ────────────────────────────

  it("persistDraft does not write to storage when hydrated=false (mount race guard)", async () => {
    await persistDraft(EVENT_ID, OCR_DRAFT, PHOTO_ID, DRAFT_ITEMS, false);
    expect(await loadOcrDraft(EVENT_ID)).toBeNull();
  });

  // ── 5. persistDraft: skipped when eventId ≤ 0 ────────────────────────────

  it("persistDraft does not write to storage when eventId is 0", async () => {
    await persistDraft(0, OCR_DRAFT, PHOTO_ID, DRAFT_ITEMS, true);
    expect(await loadOcrDraft(0)).toBeNull();
  });

  // ── 6. persistDraft: saves when draft is present ──────────────────────────

  it("persistDraft writes the draft to storage when hydrated and ocrDraft is non-null", async () => {
    await persistDraft(EVENT_ID, OCR_DRAFT, PHOTO_ID, DRAFT_ITEMS, true);
    const loaded = await loadOcrDraft(EVENT_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.photoId).toBe(PHOTO_ID);
    expect(loaded!.ocrDraft).toEqual(OCR_DRAFT);
    expect(loaded!.draftItems).toEqual(DRAFT_ITEMS);
  });

  // ── 7. persistDraft: clears storage when ocrDraft is null ─────────────────

  it("persistDraft clears storage when ocrDraft is null (confirms or discards draft)", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);
    await persistDraft(EVENT_ID, null, null, [], true);
    expect(await loadOcrDraft(EVENT_ID)).toBeNull();
  });

  // ── 8. keepDraft: only hides modal ────────────────────────────────────────

  it("keepDraft hides the modal but leaves AsyncStorage intact", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    keepDraft(setters);

    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(false);
    // No other setter should be touched.
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    expect(setters.setDraftItems).not.toHaveBeenCalled();
    expect(setters.setDraftPhotoId).not.toHaveBeenCalled();
    expect(setters.setDraftErrors).not.toHaveBeenCalled();

    // Storage still has the draft.
    const still = await loadOcrDraft(EVENT_ID);
    expect(still).not.toBeNull();
    expect(still!.draftItems).toEqual(DRAFT_ITEMS);
  });

  // ── 9. discardDraft: resets state and clears storage ──────────────────────

  it("discardDraft resets all state setters and removes the draft from storage", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    discardDraft(EVENT_ID, setters);

    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(false);
    expect(setters.setOcrDraft).toHaveBeenCalledWith(null);
    expect(setters.setDraftItems).toHaveBeenCalledWith([]);
    expect(setters.setDraftPhotoId).toHaveBeenCalledWith(null);
    expect(setters.setDraftErrors).toHaveBeenCalledWith({});

    // Give the async clearOcrDraft a tick.
    await new Promise((r) => setTimeout(r, 0));

    expect(await loadOcrDraft(EVENT_ID)).toBeNull();
  });

  // ── 10. openDraftCloseAlert → Keep branch ─────────────────────────────────

  it("openDraftCloseAlert → Keep: only hides the modal and preserves storage", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    openDraftCloseAlert(EVENT_ID, setters);

    // Alert should have been shown with two buttons.
    expect(capturedAlertButtons).toHaveLength(2);
    const keepBtn = capturedAlertButtons.find((b) => b.text === "Keep");
    expect(keepBtn).toBeDefined();

    // Press "Keep".
    keepBtn!.onPress!();

    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(false);
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    expect(setters.setDraftItems).not.toHaveBeenCalled();

    // Storage untouched.
    expect(await loadOcrDraft(EVENT_ID)).not.toBeNull();
  });

  // ── 11. openDraftCloseAlert → Discard branch ──────────────────────────────

  it("openDraftCloseAlert → Discard: resets all state and clears storage", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    openDraftCloseAlert(EVENT_ID, setters);

    const discardBtn = capturedAlertButtons.find((b) => b.text === "Discard");
    expect(discardBtn).toBeDefined();

    discardBtn!.onPress!();

    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(false);
    expect(setters.setOcrDraft).toHaveBeenCalledWith(null);
    expect(setters.setDraftItems).toHaveBeenCalledWith([]);
    expect(setters.setDraftPhotoId).toHaveBeenCalledWith(null);
    expect(setters.setDraftErrors).toHaveBeenCalledWith({});

    await new Promise((r) => setTimeout(r, 0));
    expect(await loadOcrDraft(EVENT_ID)).toBeNull();
  });

  // ── 12. focusRestoreDraft: draft already in memory → reopen modal only ───

  it("focusRestoreDraft re-surfaces the modal when a draft is already in memory", async () => {
    const setters = makeSetters();
    focusRestoreDraft(EVENT_ID, OCR_DRAFT, setters);
    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(true);
    // Should NOT touch ocrDraft / items — already in memory.
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    expect(setters.setDraftItems).not.toHaveBeenCalled();
    expect(setters.setDraftPhotoId).not.toHaveBeenCalled();
    // No need to settle hydration when draft is already present.
    expect(setters.setDraftHydrated).not.toHaveBeenCalled();
  });

  // ── 13. focusRestoreDraft: context-purge fallback — draft in storage ──────

  it("focusRestoreDraft recovers draft from AsyncStorage when memory is empty (iOS context-purge)", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    focusRestoreDraft(EVENT_ID, null, setters);
    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setDraftPhotoId).toHaveBeenCalledWith(PHOTO_ID);
    expect(setters.setOcrDraft).toHaveBeenCalledWith(OCR_DRAFT);
    expect(setters.setDraftItems).toHaveBeenCalledWith(DRAFT_ITEMS);
    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(true);
    // Must settle hydration so the persist effect stays active after recovery.
    expect(setters.setDraftHydrated).toHaveBeenCalledWith(true);
  });

  // ── 14. focusRestoreDraft: context-purge fallback — no draft stored ────────

  it("focusRestoreDraft settles hydration even when no draft is found in AsyncStorage", async () => {
    const setters = makeSetters();
    focusRestoreDraft(EVENT_ID, null, setters);
    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setIsDraftModalVisible).not.toHaveBeenCalled();
    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    // Hydration must still be settled so the persist effect is not stuck.
    expect(setters.setDraftHydrated).toHaveBeenCalledWith(true);
  });

  // ── 15. focusRestoreDraft: cancellation ───────────────────────────────────

  it("focusRestoreDraft does not call setters after cleanup fires", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const setters = makeSetters();
    const cleanup = focusRestoreDraft(EVENT_ID, null, setters);
    cleanup?.();

    await new Promise((r) => setTimeout(r, 0));

    expect(setters.setOcrDraft).not.toHaveBeenCalled();
    expect(setters.setIsDraftModalVisible).not.toHaveBeenCalled();
    expect(setters.setDraftHydrated).not.toHaveBeenCalled();
  });

  // ── 16. focusRestoreDraft: edits persist after context-purge recovery ──────

  it("edits made after a context-purge recovery are saved to AsyncStorage", async () => {
    // Simulate a draft that was persisted before the context was purged.
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    // focus-restore fires: hydrates in-memory state (including draftHydrated=true).
    const hydratedState: {
      ocrDraft: typeof OCR_DRAFT | null;
      draftItems: typeof DRAFT_ITEMS;
      draftPhotoId: number | null;
      draftHydrated: boolean;
    } = { ocrDraft: null, draftItems: [], draftPhotoId: null, draftHydrated: false };

    const setters = {
      setOcrDraft: vi.fn((v) => { hydratedState.ocrDraft = v; }),
      setDraftItems: vi.fn((v) => { hydratedState.draftItems = v; }),
      setDraftPhotoId: vi.fn((v) => { hydratedState.draftPhotoId = v; }),
      setDraftErrors: vi.fn(),
      setIsDraftModalVisible: vi.fn(),
      setDraftHydrated: vi.fn((v) => { hydratedState.draftHydrated = v; }),
    };

    focusRestoreDraft(EVENT_ID, null, setters);
    await new Promise((r) => setTimeout(r, 0));

    // User edits an item name — simulate a state change then persistDraft.
    const editedItems = [
      { localId: "a1", name: "Ramen Deluxe", quantity: "1", priceStr: "14.00" },
      { localId: "b2", name: "Edamame", quantity: "2", priceStr: "5.00" },
    ];
    await persistDraft(
      EVENT_ID,
      hydratedState.ocrDraft,
      hydratedState.draftPhotoId,
      editedItems,
      hydratedState.draftHydrated,
    );

    const saved = await loadOcrDraft(EVENT_ID);
    expect(saved).not.toBeNull();
    expect(saved!.draftItems[0].name).toBe("Ramen Deluxe");
  });

  // ── 17. Full navigation cycle ─────────────────────────────────────────────

  it("draft survives navigation: save → restore reopens modal with the same items", async () => {
    // Step 1: user scans; persistDraft is called (hydrated, draft present).
    await persistDraft(EVENT_ID, OCR_DRAFT, PHOTO_ID, DRAFT_ITEMS, true);

    // Step 2: user navigates away. In-memory state is gone; storage holds the draft.

    // Step 3: user returns; the restore useEffect fires.
    const setters = makeSetters();
    restoreDraft(EVENT_ID, setters);
    await new Promise((r) => setTimeout(r, 0));

    // Modal should reopen.
    expect(setters.setIsDraftModalVisible).toHaveBeenCalledWith(true);
    // Items and draft should match what was saved.
    expect(setters.setDraftItems).toHaveBeenCalledWith(DRAFT_ITEMS);
    expect(setters.setOcrDraft).toHaveBeenCalledWith(OCR_DRAFT);
    expect(setters.setDraftPhotoId).toHaveBeenCalledWith(PHOTO_ID);
    // Hydration settled.
    expect(setters.setDraftHydrated).toHaveBeenCalledWith(true);
  });
});
