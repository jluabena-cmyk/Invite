import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OcrDraftResult } from "@workspace/api-client-react";

type DraftItem = { localId: string; name: string; quantity: string; priceStr: string };

type StoredOcrDraft = {
  photoId: number;
  ocrDraft: OcrDraftResult;
  draftItems: DraftItem[];
};

function draftKey(eventId: number): string {
  return `ocr-draft-${eventId}`;
}

export async function saveOcrDraft(
  eventId: number,
  photoId: number,
  ocrDraft: OcrDraftResult,
  draftItems: DraftItem[],
): Promise<void> {
  const payload: StoredOcrDraft = { photoId, ocrDraft, draftItems };
  await AsyncStorage.setItem(draftKey(eventId), JSON.stringify(payload));
}

export async function loadOcrDraft(eventId: number): Promise<StoredOcrDraft | null> {
  const raw = await AsyncStorage.getItem(draftKey(eventId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOcrDraft;
  } catch {
    return null;
  }
}

export async function clearOcrDraft(eventId: number): Promise<void> {
  await AsyncStorage.removeItem(draftKey(eventId));
}
