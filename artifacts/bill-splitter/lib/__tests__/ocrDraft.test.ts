/**
 * Tests for the OCR draft persist/restore cycle.
 *
 * Covered scenarios:
 * 1. save + load round-trips all fields correctly (the persist/restore path)
 * 2. Draft survives simulated navigation: save → wipe in-memory → load returns the same data
 * 3. Confirming the draft (clearOcrDraft) removes the entry from storage
 * 4. "Keep" behaviour: storage is unchanged after hiding the modal (draft survives)
 * 5. "Discard" behaviour: clearOcrDraft is called and subsequent load returns null
 * 6. Key isolation: drafts for different eventIds are independent
 * 7. Corrupt JSON in storage gracefully returns null instead of throwing
 * 8. Missing entry returns null
 * 9. Overwriting a draft with new data replaces the old payload
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── In-memory AsyncStorage mock ───────────────────────────────────────────────

const store: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn(async (key: string) => { delete store[key]; }),
  },
}));

// Import AFTER the mock is registered so the module picks it up.
import { saveOcrDraft, loadOcrDraft, clearOcrDraft } from "../ocrDraft";
import type { OcrDraftResult } from "@workspace/api-client-react";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EVENT_ID = 42;
const PHOTO_ID = 7;

const OCR_DRAFT: OcrDraftResult = {
  items: [
    { name: "Margherita Pizza", priceStr: "12.50", quantity: 2 },
    { name: "Tiramisu", priceStr: "6.00", quantity: 1 },
  ],
  subtotal: "31.00",
  tax: "2.48",
  tip: "4.65",
  total: "38.13",
};

const DRAFT_ITEMS = [
  { localId: "a1", name: "Margherita Pizza", quantity: "2", priceStr: "12.50" },
  { localId: "b2", name: "Tiramisu", quantity: "1", priceStr: "6.00" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wipe the in-memory store between tests. */
function clearStore() {
  for (const key of Object.keys(store)) delete store[key];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ocrDraft helpers", () => {
  beforeEach(() => {
    clearStore();
    vi.clearAllMocks();
  });

  // ── 1. Basic round-trip ──────────────────────────────────────────────────

  it("saveOcrDraft then loadOcrDraft returns the exact same payload", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);
    const loaded = await loadOcrDraft(EVENT_ID);

    expect(loaded).not.toBeNull();
    expect(loaded!.photoId).toBe(PHOTO_ID);
    expect(loaded!.ocrDraft).toEqual(OCR_DRAFT);
    expect(loaded!.draftItems).toEqual(DRAFT_ITEMS);
  });

  // ── 2. Draft survives navigation (the core regression guard) ────────────

  it("draft data survives simulated navigation away and back", async () => {
    // User scans a photo and the draft is persisted.
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    // Simulate navigating away: the component unmounts, clearing in-memory
    // React state.  AsyncStorage still holds the data.
    // On return the restore useEffect calls loadOcrDraft.
    const restored = await loadOcrDraft(EVENT_ID);

    expect(restored).not.toBeNull();
    expect(restored!.photoId).toBe(PHOTO_ID);
    expect(restored!.draftItems).toHaveLength(DRAFT_ITEMS.length);
    expect(restored!.draftItems[0]).toMatchObject({ name: "Margherita Pizza", quantity: "2" });
    expect(restored!.draftItems[1]).toMatchObject({ name: "Tiramisu", quantity: "1" });
    expect(restored!.ocrDraft.total).toBe("38.13");
  });

  // ── 3. Confirming the draft clears AsyncStorage ──────────────────────────

  it("clearOcrDraft after confirm removes the entry so a subsequent load returns null", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    // Simulate handleConfirmDraft completing → clearOcrDraft is called.
    await clearOcrDraft(EVENT_ID);

    const afterConfirm = await loadOcrDraft(EVENT_ID);
    expect(afterConfirm).toBeNull();
  });

  // ── 4. "Keep" flow: draft survives hiding the modal ──────────────────────

  it("draft survives when the user chooses Keep (modal hidden, storage unchanged)", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    // handleCloseDraft → "Keep" branch: setIsDraftModalVisible(false) only.
    // No clearOcrDraft call is made.  Storage must still have the draft.
    const afterKeep = await loadOcrDraft(EVENT_ID);

    expect(afterKeep).not.toBeNull();
    expect(afterKeep!.draftItems).toEqual(DRAFT_ITEMS);
  });

  // ── 5. "Discard" flow: clearOcrDraft is called ───────────────────────────

  it("draft is gone when the user chooses Discard", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    // handleCloseDraft → "Discard" branch calls clearOcrDraft.
    await clearOcrDraft(EVENT_ID);

    const afterDiscard = await loadOcrDraft(EVENT_ID);
    expect(afterDiscard).toBeNull();
  });

  // ── 6. Key isolation ──────────────────────────────────────────────────────

  it("drafts for different eventIds are stored and retrieved independently", async () => {
    const OTHER_EVENT_ID = 99;
    const otherDraftItems = [{ localId: "x1", name: "Burger", quantity: "3", priceStr: "9.00" }];
    const otherOcrDraft: OcrDraftResult = { items: [], total: "27.00" };

    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);
    await saveOcrDraft(OTHER_EVENT_ID, 55, otherOcrDraft, otherDraftItems);

    const loaded1 = await loadOcrDraft(EVENT_ID);
    const loaded2 = await loadOcrDraft(OTHER_EVENT_ID);

    expect(loaded1!.draftItems).toEqual(DRAFT_ITEMS);
    expect(loaded2!.draftItems).toEqual(otherDraftItems);

    // Clearing one should not affect the other.
    await clearOcrDraft(EVENT_ID);
    expect(await loadOcrDraft(EVENT_ID)).toBeNull();
    expect(await loadOcrDraft(OTHER_EVENT_ID)).not.toBeNull();
  });

  // ── 7. Corrupt JSON gracefully returns null ───────────────────────────────

  it("loadOcrDraft returns null instead of throwing when storage contains corrupt JSON", async () => {
    // Write garbage directly into the store at the key loadOcrDraft will use.
    store[`ocr-draft-${EVENT_ID}`] = "{ this is not valid JSON !!";

    const result = await loadOcrDraft(EVENT_ID);
    expect(result).toBeNull();
  });

  // ── 8. Missing entry returns null ─────────────────────────────────────────

  it("loadOcrDraft returns null when no draft has been saved for that eventId", async () => {
    const result = await loadOcrDraft(9999);
    expect(result).toBeNull();
  });

  // ── 9. Overwriting a draft replaces the old payload ───────────────────────

  it("a second save for the same eventId replaces the first draft", async () => {
    await saveOcrDraft(EVENT_ID, PHOTO_ID, OCR_DRAFT, DRAFT_ITEMS);

    const newPhotoId = 88;
    const newItems = [{ localId: "c3", name: "Cheesecake", quantity: "1", priceStr: "7.50" }];
    const newDraft: OcrDraftResult = { items: [], total: "7.50" };
    await saveOcrDraft(EVENT_ID, newPhotoId, newDraft, newItems);

    const loaded = await loadOcrDraft(EVENT_ID);
    expect(loaded!.photoId).toBe(newPhotoId);
    expect(loaded!.draftItems).toEqual(newItems);
    expect(loaded!.ocrDraft.total).toBe("7.50");
  });
});
