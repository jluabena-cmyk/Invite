import {
  useCreateReceipt,
  useCreateReceiptItem,
  useDeleteReceiptItem,
  useDeleteReceiptPhoto,
  useGenerateJoinCode,
  useGetEventJoinCode,
  useGetEventChat,
  useMarkChatRead,
  useGetEventDetail,
  useGetFriends,
  useHostAssignItem,
  useInviteToEvent,
  useRemoveEventParticipant,
  useRespondToEventInvitation,
  useScanReceiptPhoto,
  useSearchUsers,
  useSendMessage,
  useToggleClaim,
  useUpdateReceipt,
  useDeleteEventPhoto,
  useCancelEvent,
  useTransferHost,
  useUpdateEvent,
  useResetBill,
  useBulkAssignItems,
  requestReceiptPhotoUploadUrl,
  confirmReceiptPhotoUpload,
  requestEventPhotoUploadUrl,
  confirmEventPhotoUpload,
  searchPlaces,
  useGetPaymentRequests,
  useCreatePaymentRequests,
  useUpdatePaymentRequestStatus,
  useUpdatePaymentRequestAmount,
  useGetPlaceDetails,
  useGetCurrentUser,
  useUpdateCurrentUser,
  getBaseUrl,
  matchPhones,
  useAddSuggestion,
  useRescindSuggestion,
  useVoteOnSuggestion,
  useOpenVoting,
  useExtendVotingDeadline,
  useCloseVoting,
  useUpdateEventNotifications,
  discoverPlaces,
  useAddGuest,
  useRemoveGuest,
  useRemindParticipant,
  useRemindGuest,
  useGetSavedContacts,
  useCreateGuestPayment,
  usePatchGuestPayment,
  useUpdateGuestPaymentInfo,
  useGenerateGuestSummaryLink,
  useGetEventScanHealth,
  useGetScanErrorsGlobalSummary,
  getEventScanHealthQueryKey,
  getScanErrorsGlobalSummaryQueryKey,
  getGetEventJoinCodeQueryKey,
  getGetEventsQueryKey,
} from "@workspace/api-client-react";
import type { GuestPaymentRecord } from "@workspace/api-client-react";
import { parsePaymentQr } from "../../utils/parsePaymentQr";
import type { ChatMessage, EventGalleryPhoto, ItemAssignmentWithUser, MatchedUser, OcrDraftResult, ParticipantSummary, PlaceResult, PublicUserProfile, ReceiptItem, SavedContact } from "@workspace/api-client-react";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  Dimensions,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import * as SMS from "expo-sms";
import * as Haptics from "expo-haptics";
import * as StoreReview from "expo-store-review";
import * as Sharing from "expo-sharing";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, interpolateColor, runOnJS, Easing, withRepeat } from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { captureRef } from "react-native-view-shot";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";
import { maskZelle, isValidZelleInfo } from "@/utils/maskZelle";
import { formatVotingCountdown } from "@/utils/voting";
import { useSubscription } from "@/lib/revenuecat";
import { PaywallModal } from "@/components/PaywallModal";
import { saveOcrDraft, clearOcrDraft } from "@/lib/ocrDraft";
import { restoreDraft, focusRestoreDraft, persistDraft, keepDraft, discardDraft, openDraftCloseAlert } from "@/lib/ocrDraftController";
import { buildItemizedLines, buildPaymentSmsBody } from "@/lib/paymentMessage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCents(val: string | null | undefined): number {
  if (!val) return 0;
  return Math.round(parseFloat(val) * 100);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function roleBadgeLabel(role: string): string {
  if (role === "host") return "Host";
  if (role === "accepted") return "Accepted";
  if (role === "participant") return "Accepted";
  if (role === "invited") return "Invited";
  if (role === "declined") return "Declined";
  if (role === "guest") return "Guest";
  return role;
}

function roleBadgeColor(role: string): string {
  if (role === "host") return "#7c3aed";
  if (role === "accepted" || role === "participant") return "#16a34a";
  if (role === "invited") return "#d97706";
  if (role === "declined") return "#6b7280";
  if (role === "guest") return "#0369a1";
  return "#6b7280";
}


// ─── Proportional distribution (Hamilton / largest-remainder method) ──────────

function distributeProportionally(
  totalCents: number,
  weights: Record<number, number>,
  totalWeight: number,
): Record<number, number> {
  if (totalCents === 0 || totalWeight === 0) return {};

  const entries = Object.entries(weights).map(([k, w]) => ({ id: Number(k), w }));
  const result: Record<number, number> = {};
  let allocated = 0;

  for (const { id, w } of entries) {
    const floor = Math.floor((totalCents * w) / totalWeight);
    result[id] = floor;
    allocated += floor;
  }

  const remainder = totalCents - allocated;
  const sorted = entries
    .map(({ id, w }) => ({
      id,
      frac: (totalCents * w) / totalWeight - Math.floor((totalCents * w) / totalWeight),
    }))
    .sort((a, b) => b.frac - a.frac || a.id - b.id);

  for (let i = 0; i < remainder; i++) {
    result[sorted[i].id] = (result[sorted[i].id] ?? 0) + 1;
  }

  return result;
}

// ─── Totals calculation ───────────────────────────────────────────────────────

interface Totals {
  byParticipant: Record<number, number>;
  unallocatedCents: number;
}

function computeTotals(
  items: ReceiptItem[],
  assignments: ItemAssignmentWithUser[],
  taxCents: number,
  tipCents: number,
  totalCents: number,
): Totals {
  // Step 1: compute item-level weights by participant (proportional basis)
  const itemByParticipant: Record<number, number> = {};
  let unallocatedItemCents = 0;

  for (const item of items) {
    const subtotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
    const active = assignments.filter((a) => a.receiptItemId === item.id && a.claimed);
    if (active.length === 0) {
      unallocatedItemCents += subtotalCents;
    } else {
      const shareCents = Math.floor(subtotalCents / active.length);
      const remainderCents = subtotalCents - shareCents * active.length;
      active.forEach((a, idx) => {
        const key = aKey(a);
        itemByParticipant[key] =
          (itemByParticipant[key] ?? 0) + shareCents + (idx === 0 ? remainderCents : 0);
      });
    }
  }

  const totalWeightCents =
    Object.values(itemByParticipant).reduce((s, v) => s + v, 0) + unallocatedItemCents;

  // Step 2a: receipt.total exists — use it as the single authoritative basis.
  // Distribute totalCents proportionally by item weights; tax/tip are already
  // embedded in the receipt total so they are NOT added again.
  if (totalCents > 0) {
    if (totalWeightCents === 0) {
      return { byParticipant: {}, unallocatedCents: totalCents };
    }
    const weights: Record<number, number> = { ...itemByParticipant };
    if (unallocatedItemCents > 0) weights[-1] = unallocatedItemCents;
    const dist = distributeProportionally(totalCents, weights, totalWeightCents);
    const byParticipant: Record<number, number> = {};
    for (const uid of Object.keys(itemByParticipant).map(Number)) {
      byParticipant[uid] = dist[uid] ?? 0;
    }
    return { byParticipant, unallocatedCents: dist[-1] ?? 0 };
  }

  // Step 2b: no receipt.total — fall back to items + tax + tip (original behaviour).
  if (taxCents === 0 && tipCents === 0) {
    return { byParticipant: itemByParticipant, unallocatedCents: unallocatedItemCents };
  }

  const weights: Record<number, number> = { ...itemByParticipant };
  if (unallocatedItemCents > 0) weights[-1] = unallocatedItemCents;

  const taxDist = distributeProportionally(taxCents, weights, totalWeightCents);
  const tipDist = distributeProportionally(tipCents, weights, totalWeightCents);

  const byParticipant: Record<number, number> = {};
  for (const uid of Object.keys(itemByParticipant).map(Number)) {
    byParticipant[uid] =
      (itemByParticipant[uid] ?? 0) + (taxDist[uid] ?? 0) + (tipDist[uid] ?? 0);
  }

  const unallocatedCents =
    unallocatedItemCents + (taxDist[-1] ?? 0) + (tipDist[-1] ?? 0);

  return { byParticipant, unallocatedCents };
}

// ─── Phone hashing (client-side SHA-256 for contact matching) ─────────────────
// Normalizes a raw phone number to digits only, strips a leading US country
// code ("1") from 11-digit numbers, then returns the SHA-256 hex digest.
// Returns an empty string if the number is too short to be valid.

async function hashPhone(rawNumber: string): Promise<string> {
  const digits = rawNumber.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length < 7) return "";
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized,
  );
}

// ─── User avatar initials ─────────────────────────────────────────────────────

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

const AVATAR_COLORS = ["#7c3aed", "#0369a1", "#047857", "#b45309", "#be123c"];
const screenWidth = Dimensions.get("window").width;
function avatarBg(userId: number): string {
  return AVATAR_COLORS[Math.abs(userId) % AVATAR_COLORS.length];
}

function pKey(p: ParticipantSummary): number {
  return p.guestParticipantId ? -p.guestParticipantId : p.userId!;
}

function aKey(a: ItemAssignmentWithUser): number {
  return a.guestParticipantId ? -a.guestParticipantId : a.userId!;
}

function formatMessageTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEventDate(startsAt: string | null | undefined, createdAt: string): string {
  if (startsAt) {
    const d = new Date(startsAt);
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  return new Date(createdAt).toLocaleDateString();
}

// ─── Local types ──────────────────────────────────────────────────────────────

type DraftItem = { localId: string; name: string; quantity: string; priceStr: string };

// ─── OCR duplicate detection / merge ─────────────────────────────────────────

function normalizeDraftName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,\-\u2013\u2014:;!?'"()[\]{}/\\]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .trim();
}

function mergeDraftDuplicates(items: DraftItem[]): DraftItem[] {
  type Group = { normName: string; priceCents: number; items: DraftItem[] };
  const groups: Group[] = [];

  for (const item of items) {
    const priceNum = parseFloat(item.priceStr);
    const priceCents = isFinite(priceNum) ? Math.round(priceNum * 100) : -1;
    const normName = normalizeDraftName(item.name);

    const existing =
      priceCents >= 0
        ? groups.find(
            (g) =>
              g.priceCents >= 0 &&
              g.normName === normName &&
              Math.abs(g.priceCents - priceCents) <= 2,
          )
        : undefined;

    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ normName, priceCents, items: [item] });
    }
  }

  return groups.map((g) => {
    if (g.items.length === 1) return g.items[0];
    const totalQty = g.items.reduce(
      (s, it) => s + Math.max(1, parseInt(it.quantity, 10) || 1),
      0,
    );
    return { ...g.items[0], quantity: String(totalQty) };
  });
}

function hasDraftDuplicates(items: DraftItem[]): boolean {
  return mergeDraftDuplicates(items).length < items.length;
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type TabKey = "overview" | "chat" | "bill" | "photos";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "chat", label: "Chat" },
  { key: "bill", label: "Bill" },
  { key: "photos", label: "Photos" },
];

// ─── VenueCard ────────────────────────────────────────────────────────────────

function VenueCard({ placeId }: { placeId: string }) {
  const colors = useColors();
  const baseUrl = getBaseUrl() ?? "";
  const { data, isLoading, isError } = useGetPlaceDetails(placeId);
  const { getToken } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setAuthToken).catch(() => {});
  }, [getToken]);

  const openMaps = useCallback(() => {
    const uri = data?.googleMapsUri ??
      `https://www.google.com/maps/search/?q=${encodeURIComponent(data?.name ?? "")}`;
    Linking.openURL(uri).catch(() => {});
  }, [data?.googleMapsUri, data?.name]);

  if (isLoading) {
    return (
      <View style={[venueStyles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[venueStyles.skeletonText, { color: colors.mutedForeground }]}>Loading venue…</Text>
      </View>
    );
  }

  if (isError || !data || !data.name) return null;

  const subtitleParts = [data.primaryType, data.priceLevel].filter(Boolean);

  return (
    <View style={[venueStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Name row + rating */}
      <View style={venueStyles.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[venueStyles.venueName, { color: colors.foreground }]} numberOfLines={1}>
            {data.name}
          </Text>
          {subtitleParts.length > 0 && (
            <Text style={[venueStyles.venueSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitleParts.join(" · ")}
            </Text>
          )}
        </View>
        {data.rating != null && (
          <View style={venueStyles.ratingBlock}>
            <Text style={venueStyles.ratingStar}>★</Text>
            <Text style={[venueStyles.ratingValue, { color: colors.foreground }]}>
              {data.rating.toFixed(1)}
            </Text>
            {data.userRatingCount != null && (
              <Text style={[venueStyles.ratingCount, { color: colors.mutedForeground }]}>
                ({data.userRatingCount.toLocaleString()})
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Address */}
      {!!data.address && (
        <Text style={[venueStyles.venueAddress, { color: colors.mutedForeground }]} numberOfLines={2}>
          {data.address}
        </Text>
      )}

      {/* Photo strip */}
      {data.photoUrls.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={venueStyles.photoStrip}
          contentContainerStyle={venueStyles.photoStripContent}
        >
          {data.photoUrls.map((rel: string, i: number) => (
            <View key={i} style={venueStyles.photoWrapper}>
              <Image
                source={{
                  uri: `${baseUrl}${rel}`,
                  headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
                }}
                style={venueStyles.photo}
                contentFit="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.13)"]}
                style={venueStyles.photoGradient}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Open in Maps */}
      <Pressable
        style={({ pressed }) => [
          venueStyles.mapsBtn,
          { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
        ]}
        onPress={openMaps}
        testID="venue-open-maps-btn"
      >
        <Ionicons name="map-outline" size={15} color={colors.primary} />
        <Text style={[venueStyles.mapsBtnText, { color: colors.primary }]}>Open in Google Maps</Text>
      </Pressable>
    </View>
  );
}

const venueStyles = StyleSheet.create({
  skeleton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  skeletonText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  venueName: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  venueSubtitle: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", opacity: 0.7 },
  ratingBlock: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0, paddingTop: 1 },
  ratingStar: { fontSize: 13, lineHeight: 17, color: "#F59E0B" },
  ratingValue: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  ratingCount: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular" },
  venueAddress: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 17, opacity: 0.65 },
  photoStrip: { marginHorizontal: -14 },
  photoStripContent: { paddingHorizontal: 14, gap: 6 },
  photoWrapper: { borderRadius: 14, overflow: "hidden" },
  photo: { width: 132, height: 96, borderRadius: 14 },
  photoGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 28, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  mapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  mapsBtnText: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id, anchor } = useLocalSearchParams<{ id: string; anchor?: string }>();
  const rawId = Number(id);
  const eventId = Number.isFinite(rawId) && rawId > 0 ? rawId : 0;
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isFetching, isError, refetch } = useGetEventDetail(eventId);
  const { data: friendsData } = useGetFriends();
  const { mutate: createReceipt, isPending: isCreatingReceipt } = useCreateReceipt();
  const { mutate: createReceiptItem, isPending: isAddingItem } = useCreateReceiptItem();
  const { mutate: deleteReceiptItem } = useDeleteReceiptItem();
  const { mutate: toggleClaim } = useToggleClaim();
  const { mutate: updateReceipt, isPending: isSavingTotals } = useUpdateReceipt();
  // Receipt photo upload: 3-step presigned flow so bytes bypass the proxy.
  const { mutate: uploadPhoto, isPending: isUploadingPhoto } = useMutation({
    mutationFn: async ({ eventId: eid, asset }: { eventId: number; asset: ImagePicker.ImagePickerAsset }) => {
      const compressed = await compressForUpload(asset);
      const { uploadUrl, objectPath: _rpath, token: receiptToken } = await requestReceiptPhotoUploadUrl(eid, compressed.type);
      const fileRes = await fetch(compressed.uri);
      const blob = await fileRes.blob();
      const gcsRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": compressed.type }, body: blob });
      if (!gcsRes.ok) throw new Error(`Direct upload failed (${gcsRes.status})`);
      return confirmReceiptPhotoUpload(eid, receiptToken);
    },
  });
  const { mutate: deletePhoto } = useDeleteReceiptPhoto();
  const { mutate: scanPhoto } = useScanReceiptPhoto();
  const { mutate: resetBillMutate } = useResetBill();
  const { mutate: bulkAssignMutate } = useBulkAssignItems();
  // Gallery photo upload: same 3-step presigned flow.
  const doPresignedEventPhotoUpload = async (eid: number, asset: ImagePicker.ImagePickerAsset) => {
    const compressed = await compressForUpload(asset);
    const { uploadUrl, objectPath: _epath, token: eventToken } = await requestEventPhotoUploadUrl(eid, compressed.type);
    const fileRes = await fetch(compressed.uri);
    const blob = await fileRes.blob();
    const gcsRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": compressed.type }, body: blob });
    if (!gcsRes.ok) throw new Error(`Direct upload failed (${gcsRes.status})`);
    return confirmEventPhotoUpload(eid, eventToken);
  };
  const { mutate: uploadEventPhotoMutate, isPending: isUploadingEventPhoto } = useMutation({
    mutationFn: ({ eventId: eid, asset }: { eventId: number; asset: ImagePicker.ImagePickerAsset }) =>
      doPresignedEventPhotoUpload(eid, asset),
  });
  const { mutate: deleteEventPhotoMutate } = useDeleteEventPhoto();
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchDebounced, setInviteSearchDebounced] = useState("");
  const { data: inviteSearchResults, isFetching: isSearchingInvite } = useSearchUsers(inviteSearchDebounced);
  const { mutateAsync: inviteToEventAsync } = useInviteToEvent();
  const { mutate: generateJoinCode, isPending: isSharingLink } = useGenerateJoinCode();
  const { mutate: removeParticipant } = useRemoveEventParticipant();
  const { mutate: respondToInvitation, isPending: isRsvpPending } = useRespondToEventInvitation();
  const { data: chatMessages, refetch: refetchChat } = useGetEventChat(eventId);
  const chatScrollRef = useRef<ScrollView>(null);
  const prevChatCountRef = useRef(0);
  const [chatHasNew, setChatHasNew] = useState(false);
  // Declared early so the bill-tab polling useEffect below can reference them
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [scanningPhotoId, setScanningPhotoId] = useState<number | null>(null);
  useEffect(() => {
    const interval = setInterval(() => { refetchChat(); }, 8_000);
    return () => clearInterval(interval);
  }, [refetchChat]);

  // ── Bill tab polling ────────────────────────────────────────────────────────
  // • 2 s while a scan is active (local or server-side lock) so all
  //   participants see progress and completion promptly.
  // • 30 s when idle — keeps the bill reasonably fresh without burning
  //   battery on a tight loop when nothing is happening.
  // • No polling when there are no receipt photos and no scan in progress —
  //   nothing to update until the user adds a photo.
  useEffect(() => {
    if (activeTab !== "bill") return;
    const SCAN_LOCK_MS = 5 * 60 * 1000;
    const pollPhotos = data?.photos ?? [];
    const serverScanActive = pollPhotos.some((p) => {
      if (!p.scanLockedAt) return false;
      return Date.now() - new Date(p.scanLockedAt).getTime() < SCAN_LOCK_MS;
    });
    const isActiveScan = scanningPhotoId !== null || serverScanActive;
    if (!isActiveScan && pollPhotos.length === 0) return;
    const interval = setInterval(() => { void refetch(); }, isActiveScan ? 2_000 : 30_000);
    return () => clearInterval(interval);
  }, [activeTab, refetch, scanningPhotoId, data]);

  const { mutate: sendChatMessage, isPending: isSendingMessage } = useSendMessage();
  const queryClient = useQueryClient();
  const { mutate: markChatReadMutate } = useMarkChatRead({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      },
    },
  });
  const { mutate: cancelEvent, isPending: isCancellingEvent } = useCancelEvent();
  const { mutate: transferHostMutate } = useTransferHost();
  const { mutate: updateEventMutate, isPending: isUpdatingEvent } = useUpdateEvent();
  const { mutate: hostAssignItem } = useHostAssignItem();
  const { mutate: addGuestMutate } = useAddGuest();
  const { mutate: removeGuestMutate } = useRemoveGuest();
  const { mutate: remindParticipantMutate } = useRemindParticipant();
  const { mutate: remindGuestMutate } = useRemindGuest();
  const [remindingKey, setRemindingKey] = useState<string | null>(null);
  const [transferringTo, setTransferringTo] = useState<number | null>(null);

  // ── Venue suggestions ──────────────────────────────────────────────────────
  const { mutate: addSuggestion, isPending: isAddingSuggestion } = useAddSuggestion();
  const { mutate: rescindSuggestion } = useRescindSuggestion();
  const { mutate: voteOnSuggestion, isPending: isVoting } = useVoteOnSuggestion();
  const { mutate: openVoting, isPending: isOpeningVoting } = useOpenVoting();
  const { mutate: extendDeadline } = useExtendVotingDeadline();
  const { mutate: closeVoting, isPending: isClosingVoting } = useCloseVoting();
  const { mutate: updateNotifications } = useUpdateEventNotifications();
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryZip, setDiscoveryZip] = useState("");
  const [discoveryCuisines, setDiscoveryCuisines] = useState<string[]>([]);
  const [discoveryRadius, setDiscoveryRadius] = useState<number>(1609);
  const [discoveryResults, setDiscoveryResults] = useState<Array<{ placeId: string; name: string; address: string; lat: number; lng: number; rating: number | null; photoUrl: string | null; priceLevel: string | null; primaryType: string | null }>>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryDeviceCoords, setDiscoveryDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualVenueName, setManualVenueName] = useState("");
  const [manualVenueAddress, setManualVenueAddress] = useState("");
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  const [venueSearchResults, setVenueSearchResults] = useState<PlaceResult[]>([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);
  const venueSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openVotingDuration, setOpenVotingDuration] = useState<24 | 48>(24);
  const [tiebreakerId, setTiebreakerId] = useState<number | null>(null);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [serverReportedTied, setServerReportedTied] = useState(false);
  const [votingCountdown, setVotingCountdown] = useState<string | null>(null);

  // ── Payment requests ───────────────────────────────────────────────────────
  const {
    data: paymentRequestsData,
    refetch: refetchPaymentRequests,
  } = useGetPaymentRequests(eventId);
  const { mutate: createPaymentRequests, isPending: isCreatingPaymentRequests } =
    useCreatePaymentRequests();
  const { mutate: updatePaymentRequestStatus } = useUpdatePaymentRequestStatus();
  const { mutate: updatePaymentRequestAmount } = useUpdatePaymentRequestAmount();
  const { data: myProfile, refetch: refetchMyProfile } = useGetCurrentUser();
  const { mutate: updateMyProfile } = useUpdateCurrentUser();

  // ── Guest payments (app-less guests tracked by host via Cash App) ──────────
  // Payment records are embedded in the event detail response (guestPayments field) —
  // no separate network call needed; just refetch the event detail on changes.
  const { mutate: createGuestPaymentMutate } = useCreateGuestPayment();
  const { mutate: patchGuestPaymentMutate } = usePatchGuestPayment();
  const { mutate: updateGuestPaymentInfoMutate } = useUpdateGuestPaymentInfo();
  const { mutate: generateGuestSummaryLinkMutate } = useGenerateGuestSummaryLink();

  // ── Tab state ──────────────────────────────────────────────────────────────
  // (activeTab is declared earlier so it can be referenced in the bill polling useEffect)
  useEffect(() => {
    if (activeTab !== "bill") {
      setIsSelectMode(false);
      setSelectedItemIds(new Set());
      setBulkError(null);
    }
    if (activeTab === "chat") {
      setChatHasNew(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 100);
      // Mark chat as read on server so home screen badge clears
      void markChatReadMutate({ eventId });
    }
  }, [activeTab]);

  // Track new chat messages arriving
  // - On another tab: show the unread dot so the user knows to switch
  // - On the Chat tab: re-mark as read immediately so the home screen badge stays clear
  useEffect(() => {
    const count = chatMessages?.length ?? 0;
    if (count > prevChatCountRef.current) {
      if (activeTab !== "chat") {
        setChatHasNew(true);
      } else {
        // New message(s) arrived while the Chat tab is open — advance the read cursor
        void markChatReadMutate({ eventId });
      }
    }
    prevChatCountRef.current = count;
  }, [chatMessages, activeTab, markChatReadMutate, eventId]);

  // Auto-scroll chat to bottom whenever messages update
  useEffect(() => {
    if ((chatMessages?.length ?? 0) > 0) {
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [chatMessages]);

  useEffect(() => {
    if (activeTab === "overview" && pendingScrollToVoting.current) {
      pendingScrollToVoting.current = false;
      const scrollTimer = setTimeout(() => {
        overviewScrollRef.current?.scrollTo({ y: suggestionsSectionY.current, animated: true });
      }, 80);
      const highlightTimer = setTimeout(() => {
        highlightSuggestionsAnim.value = withSequence(
          withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 700, easing: Easing.in(Easing.ease) }),
        );
      }, 430);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [activeTab]);

  // ── Voting countdown ────────────────────────────────────────────────────────
  const tickVotingCountdown = useCallback(() => {
    const deadlineStr = data?.votingDeadline;
    if (!data?.votingOpenedAt || !deadlineStr) {
      setVotingCountdown(null);
      return;
    }
    const deadline = new Date(deadlineStr);
    setVotingCountdown(formatVotingCountdown(deadline));
  }, [data?.votingOpenedAt, data?.votingDeadline]);

  useEffect(() => {
    tickVotingCountdown();

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const deadlineStr = data?.votingDeadline;
      if (!deadlineStr || !data?.votingOpenedAt) {
        timeoutId = setTimeout(scheduleNext, 60_000);
        return;
      }
      const msLeft = new Date(deadlineStr).getTime() - Date.now();
      const delay = msLeft > 0 && msLeft <= 5 * 60_000 ? 1_000 : 60_000;
      timeoutId = setTimeout(() => {
        tickVotingCountdown();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [tickVotingCountdown, data?.votingDeadline, data?.votingOpenedAt]);

  // Re-tick immediately when the app returns to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        tickVotingCountdown();
      }
    });
    return () => sub.remove();
  }, [tickVotingCountdown]);

  // Re-tick immediately when this screen regains focus
  useFocusEffect(
    useCallback(() => {
      tickVotingCountdown();
    }, [tickVotingCountdown])
  );

  // ── Item form state ────────────────────────────────────────────────────────
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [addError, setAddError] = useState<string | null>(null);
  const [claimingItemId, setClaimingItemId] = useState<number | null>(null);

  // ── Receipt totals form state (host only) ──────────────────────────────────
  const [subtotalInput, setSubtotalInput] = useState("");
  const [serviceFeeInput, setServiceFeeInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [totalsError, setTotalsError] = useState<string | null>(null);
  const totalsInitedRef = useRef(false);
  const itemPriceRef = useRef<TextInput>(null);
  const itemQtyRef = useRef<TextInput>(null);

  // ── Invite modal state ─────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<number>>(new Set());
  const [isBulkInviting, setIsBulkInviting] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [contacts, setContacts] = useState<Contacts.ExistingContact[]>([]);
  const [contactAppUsers, setContactAppUsers] = useState<MatchedUser[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [eventJoinCode, setEventJoinCode] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [showQRPanel, setShowQRPanel] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const qrContainerRef = useRef<View>(null);

  // ── Receipt camera guide modal ─────────────────────────────────────────────
  const [showReceiptCameraGuide, setShowReceiptCameraGuide] = useState(false);

  // ── Gallery state ───────────────────────────────────────────────────────────
  const uploaderMap = useMemo(
    () => new Map((data?.participants ?? []).map((p) => [p.userId, p])),
    [data?.participants],
  );
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [currentViewerPage, setCurrentViewerPage] = useState(0);
  const [isUploadingEventPhotos, setIsUploadingEventPhotos] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const viewerFlatListRef = useRef<FlatList>(null);
  // Receipt viewer state declared here — must precede closeGesture so
  // setReceiptViewerIndex is in scope when Reanimated transforms the worklet.
  const receiptViewerFlatListRef = useRef<FlatList>(null);
  const [receiptViewerIndex, setReceiptViewerIndex] = useState<number | null>(null);
  const [currentReceiptViewerPage, setCurrentReceiptViewerPage] = useState(0);
  const viewerTranslateY = useSharedValue(0);
  const viewerScale = useSharedValue(1);
  const viewerBgOpacity = useSharedValue(1);
  const closeGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      viewerTranslateY.value = e.translationY;
      const progress = Math.min(Math.abs(e.translationY) / 250, 1);
      viewerScale.value = 1 - progress * 0.15;
      viewerBgOpacity.value = 1 - progress * 0.6;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 120) {
        runOnJS(setViewerIndex)(null);
        viewerTranslateY.value = 0;
        viewerScale.value = 1;
        viewerBgOpacity.value = 1;
      } else {
        viewerTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        viewerScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        viewerBgOpacity.value = withSpring(1, { damping: 20, stiffness: 300 });
      }
    });
  const viewerContentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: viewerTranslateY.value }, { scale: viewerScale.value }],
    flex: 1,
  }));
  const viewerBgAnimStyle = useAnimatedStyle(() => ({
    opacity: viewerBgOpacity.value,
  }));
  const onViewerViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index != null) setCurrentViewerPage(viewableItems[0].index);
    },
  ).current;
  const viewerViewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ── Receipt photo viewer paging ────────────────────────────────────────────
  const onReceiptViewerViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index != null) setCurrentReceiptViewerPage(viewableItems[0].index);
    },
  ).current;
  const receiptViewerViewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ── Receipt photo viewer gesture / animation ───────────────────────────────
  // State (setReceiptViewerIndex) is declared at line ~559 — before this gesture —
  // so Reanimated's Babel plugin captures it correctly into the worklet closure.
  const receiptTranslateY = useSharedValue(0);
  const receiptScale = useSharedValue(1);
  const receiptBgOpacity = useSharedValue(1);
  const receiptCloseGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      receiptTranslateY.value = e.translationY;
      const progress = Math.min(Math.abs(e.translationY) / 250, 1);
      receiptScale.value = 1 - progress * 0.15;
      receiptBgOpacity.value = 1 - progress * 0.6;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 120) {
        runOnJS(setReceiptViewerIndex)(null);
        receiptTranslateY.value = 0;
        receiptScale.value = 1;
        receiptBgOpacity.value = 1;
      } else {
        receiptTranslateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        receiptScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        receiptBgOpacity.value = withSpring(1, { damping: 20, stiffness: 300 });
      }
    });
  const receiptContentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: receiptTranslateY.value }, { scale: receiptScale.value }],
    flex: 1,
  }));
  const receiptBgAnimStyle = useAnimatedStyle(() => ({
    opacity: receiptBgOpacity.value,
  }));

  // ── Edit modal state ───────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDestinationQuery, setEditDestinationQuery] = useState("");
  const [editDestinationSelected, setEditDestinationSelected] = useState<PlaceResult | null>(null);
  const [editDestinationResults, setEditDestinationResults] = useState<PlaceResult[]>([]);
  const [editDestinationLoading, setEditDestinationLoading] = useState(false);
  const [editLocationDenied, setEditLocationDenied] = useState(false);
  const [editUserLatLng, setEditUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [editCityOrZip, setEditCityOrZip] = useState("");
  const editLocationRequestedRef = useRef(false);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editPickedDate, setEditPickedDate] = useState<Date | null>(null);
  const [editShowDatePicker, setEditShowDatePicker] = useState(false);
  const [editShowTimePicker, setEditShowTimePicker] = useState(false);
  const [editHasPickedTime, setEditHasPickedTime] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── OCR draft state ──────────────────────────────────────────────────────────
  // (scanningPhotoId declared earlier for bill polling; remaining OCR state follows)
  const [scanStuckWarning, setScanStuckWarning] = useState(false);
  const scanStuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanErrorBanner, setScanErrorBanner] = useState<{ message: string; onRetry?: () => void } | null>(null);
  const scanErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanErrorTimerStartRef = useRef<number | null>(null);
  const scanErrorTimerDurationRef = useRef<number>(6000);
  const scanErrorTimerRemainingRef = useRef<number | null>(null);
  const scanRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRetryTimerStartRef = useRef<number | null>(null);
  const scanRetryTimerRemainingRef = useRef<number | null>(null);
  const scanRetryPhotoIdRef = useRef<number | null>(null);
  const paymentSetupInputRef = useRef<TextInput>(null);
  const [ocrDraft, setOcrDraft] = useState<OcrDraftResult | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftPhotoId, setDraftPhotoId] = useState<number | null>(null);
  // True once the AsyncStorage restore attempt for the current eventId has settled,
  // so the persist effect never clears a draft that hasn't been read yet.
  const [draftHydrated, setDraftHydrated] = useState(false);
  // Controls modal visibility independently of ocrDraft state, so "Keep" can
  // dismiss the sheet while preserving the draft in memory + AsyncStorage.
  const [isDraftModalVisible, setIsDraftModalVisible] = useState(false);
  const [isConfirmingDraft, setIsConfirmingDraft] = useState(false);
  const [draftErrors, setDraftErrors] = useState<Record<string, { name?: string; quantity?: string; priceStr?: string }>>({});
  const ocrDraftScrollRef = useRef<ScrollView>(null);
  const draftItemLayouts = useRef<Record<string, number>>({});
  const overviewScrollRef = useRef<ScrollView>(null);
  const suggestionsSectionY = useRef<number>(0);
  const pendingScrollToVoting = useRef<boolean>(false);

  // ── OCR draft: restore from AsyncStorage when eventId is known ──────────
  useEffect(() => {
    if (eventId <= 0) return;
    return restoreDraft(eventId, {
      setOcrDraft,
      setDraftItems,
      setDraftPhotoId,
      setDraftErrors,
      setIsDraftModalVisible,
      setDraftHydrated,
    });
  }, [eventId]);

  // ── OCR draft: re-surface modal when screen regains focus ────────────────
  useFocusEffect(
    useCallback(
      () =>
        focusRestoreDraft(eventId, ocrDraft, {
          setOcrDraft,
          setDraftItems,
          setDraftPhotoId,
          setDraftErrors,
          setIsDraftModalVisible,
          setDraftHydrated,
        }),
      [eventId, ocrDraft],
    ),
  );

  // ── OCR draft: persist to AsyncStorage whenever it changes ───────────────
  useEffect(() => {
    void persistDraft(eventId, ocrDraft, draftPhotoId, draftItems, draftHydrated);
  }, [eventId, ocrDraft, draftItems, draftPhotoId, draftHydrated]);

  // If the screen was opened from a voting notification, scroll to voting section.
  useEffect(() => {
    if (anchor === "voting") {
      pendingScrollToVoting.current = true;
    }
  }, [anchor]);
  const highlightSuggestionsAnim = useSharedValue(0);
  const suggestionHighlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      highlightSuggestionsAnim.value,
      [0, 1],
      ["transparent", "rgba(251, 191, 36, 0.25)"],
    ),
    borderRadius: 8,
  }));

  // ── Host tool accordion state ─────────────────────────────────────────────
  const [showEditTotals, setShowEditTotals] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showScanHealth, setShowScanHealth] = useState(false);
  const [isResettingBill, setIsResettingBill] = useState(false);
  const [resetBillError, setResetBillError] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [bulkSplitModalVisible, setBulkSplitModalVisible] = useState(false);
  const [bulkSplitKeys, setBulkSplitKeys] = useState<Set<number>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // ── Add-guest modal state ─────────────────────────────────────────────────
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [addGuestNameInput, setAddGuestNameInput] = useState("");
  const [addGuestError, setAddGuestError] = useState<string | null>(null);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [addGuestSaveToggle, setAddGuestSaveToggle] = useState(false);
  const { data: savedContactsData, refetch: refetchSavedContacts } = useGetSavedContacts();

  // ── Assignment modal state ────────────────────────────────────────────────
  const [assigningItemId, setAssigningItemId] = useState<number | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // ── Subscription ──────────────────────────────────────────────────────────
  const { isSubscribed: rcIsSubscribed, refetchCustomerInfo, hostedEventsSent, freeEventLimit } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // ── Payment request modal state ───────────────────────────────────────────
  const [showRequestPaymentModal, setShowRequestPaymentModal] = useState(false);
  const [paymentRequestNote, setPaymentRequestNote] = useState("");
  const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);
  // ── Inline payment setup state (shown when host has no payment info) ──────
  const [paymentSetupMethod, setPaymentSetupMethod] = useState<"cash_app" | "venmo" | "zelle">("cash_app");
  const [paymentSetupValue, setPaymentSetupValue] = useState("");
  const [paymentSetupError, setPaymentSetupError] = useState<string | null>(null);
  const [paymentSetupSaving, setPaymentSetupSaving] = useState(false);
  const [paymentSetupComplete, setPaymentSetupComplete] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [iPaidError, setIPaidError] = useState<string | null>(null);
  const [cantPaySent, setCantPaySent] = useState(false);
  const [cantPaySending, setCantPaySending] = useState(false);
  const [cashPaySent, setCashPaySent] = useState(false);
  const [cashPaySending, setCashPaySending] = useState(false);
  const prevPaymentRequestRef = useRef<{ id: number | null; updatedAt: string | null }>({ id: null, updatedAt: null });
  const [markingReceivedId, setMarkingReceivedId] = useState<number | null>(null);
  const [markReceivedError, setMarkReceivedError] = useState<string | null>(null);

  // ── Edit payment request state (host) ─────────────────────────────────────
  const [editingRequest, setEditingRequest] = useState<{ id: number; guestDisplayName: string | null; amountCents: number; note: string | null } | null>(null);
  const [editAmountText, setEditAmountText] = useState("");
  const [editNoteText, setEditNoteText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [paymentEditError, setPaymentEditError] = useState<string | null>(null);

  // ── Guest payment tracking state (host) ───────────────────────────────────
  const [markingGuestPaidId, setMarkingGuestPaidId] = useState<number | null>(null);
  const [requestingGuestPayId, setRequestingGuestPayId] = useState<number | null>(null);
  const [sendingGuestLinkId, setSendingGuestLinkId] = useState<number | null>(null);
  const [guestSummaryUrls, setGuestSummaryUrls] = useState<Map<number, string>>(new Map());
  const [copiedGuestLinkId, setCopiedGuestLinkId] = useState<number | null>(null);

  // ── Guest payment info modal (set up / edit Cash App + Venmo handles) ─────
  const [guestPayInfoParticipant, setGuestPayInfoParticipant] = useState<ParticipantSummary | null>(null);
  const [guestPayInfoCashApp, setGuestPayInfoCashApp] = useState("");
  const [guestPayInfoVenmo, setGuestPayInfoVenmo] = useState("");
  const [guestPayInfoPhone, setGuestPayInfoPhone] = useState("");
  const [guestPayInfoError, setGuestPayInfoError] = useState<string | null>(null);
  const [guestPayInfoSaving, setGuestPayInfoSaving] = useState(false);
  const [guestPayInfoScanning, setGuestPayInfoScanning] = useState<"cash_app" | "venmo" | null>(null);
  const [postAddGuestParticipant, setPostAddGuestParticipant] = useState<ParticipantSummary | null>(null);

  // ── Zelle copy feedback state ─────────────────────────────────────────────
  const [copiedField, setCopiedField] = useState<"recipient" | "amount" | "memo" | "all" | null>(null);
  const [zelleOpenFailed, setZelleOpenFailed] = useState(false);
  const [zelleCopied, setZelleCopied] = useState(false);
  const zelleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tip selector mode ─────────────────────────────────────────────────────
  const [tipMode, setTipMode] = useState<"15" | "18" | "20" | "custom" | null>(null);

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [cantPayReplyMsgId, setCantPayReplyMsgId] = useState<number | null>(null);
  const [cantPayReplyText, setCantPayReplyText] = useState("");
  const [cantPayReplySending, setCantPayReplySending] = useState(false);

  useEffect(() => {
    if (data?.receipt && !totalsInitedRef.current) {
      totalsInitedRef.current = true;
      setSubtotalInput(data.receipt.subtotal ?? "");
      setServiceFeeInput(data.receipt.serviceFee ?? "");
      setTaxInput(data.receipt.tax ?? "");
      setTipInput(data.receipt.tip ?? "");
      setTotalInput(data.receipt.total ?? "");
      const sub = parseCents(data.receipt.subtotal);
      const tip = parseCents(data.receipt.tip);
      if (sub > 0 && tip > 0) {
        const r = tip / sub;
        if (Math.abs(r - 0.15) < 0.005) setTipMode("15");
        else if (Math.abs(r - 0.18) < 0.005) setTipMode("18");
        else if (Math.abs(r - 0.20) < 0.005) setTipMode("20");
        else setTipMode("custom");
      }
    }
  }, [data?.receipt]);

  useEffect(() => {
    const t = setTimeout(() => setInviteSearchDebounced(inviteSearchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [inviteSearchQuery]);

  const isHost = data?.role === "host";

  // ── Scan health (host only) ────────────────────────────────────────────────
  const {
    data: scanHealthData,
    isLoading: isScanHealthLoading,
    isError: isScanHealthError,
    refetch: refetchScanHealth,
  } = useGetEventScanHealth(eventId, { query: { queryKey: getEventScanHealthQueryKey(eventId), enabled: isHost && showScanHealth } });

  const {
    data: globalErrorSummaryData,
    isLoading: isGlobalErrorSummaryLoading,
    isError: isGlobalErrorSummaryError,
    refetch: refetchGlobalErrorSummary,
  } = useGetScanErrorsGlobalSummary({ query: { queryKey: getScanErrorsGlobalSummaryQueryKey(), enabled: isHost && showScanHealth } });

  const { data: existingShareData } = useGetEventJoinCode(eventId, {
    query: { queryKey: getGetEventJoinCodeQueryKey(eventId), enabled: isHost && eventId > 0, retry: false },
  });

  useEffect(() => {
    if (existingShareData?.joinCode && !eventJoinCode) {
      setEventJoinCode(existingShareData.joinCode);
    }
  }, [existingShareData?.joinCode]);

  useEffect(() => {
    if (!showRequestPaymentModal) return;
    const hasValidZelle = !!myProfile?.zelleInfo && isValidZelleInfo(myProfile.zelleInfo);
    const hasOtherMethod = !!(myProfile?.cashAppHandle || myProfile?.venmoHandle);
    if (!hasOtherMethod && !hasValidZelle && myProfile?.zelleInfo) {
      setPaymentSetupMethod("zelle");
    }
  }, [showRequestPaymentModal]);

  const isLimited = data?.accessLevel === "limited";
  const isCancelled = !!data?.cancelledAt;
  const myUserId = data?.myUserId;
  const hasValidZelle = !!myProfile?.zelleInfo && isValidZelleInfo(myProfile.zelleInfo);

  const isTied = (() => {
    if (!data) return false;
    if (data.destinationDecidedAt) return false;
    if (!data.votingOpenedAt || !data.votingDeadline) return false;
    const deadlinePassed = new Date(data.votingDeadline) <= new Date();
    if (!deadlinePassed) return false;
    if (serverReportedTied) return true;
    const active = (data.suggestions ?? []).filter((s) => !s.rescinded);
    if (active.length === 0) return false;
    const maxVotes = Math.max(...active.map((s) => s.voteCount));
    const leaders = active.filter((s) => s.voteCount === maxVotes);
    return leaders.length > 1;
  })();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateReceipt = () => {
    createReceipt({ eventId }, { onSuccess: () => refetch() });
  };

  const handleAddItem = () => {
    const name = itemName.trim();
    const price = itemPrice.trim();
    if (!name || !price) return;
    const quantity = Math.max(1, parseInt(itemQty, 10) || 1);
    setAddError(null);
    createReceiptItem(
      { eventId, data: { name, price, quantity } },
      {
        onSuccess: () => {
          setItemName("");
          setItemPrice("");
          setItemQty("1");
          refetch();
        },
        onError: () => setAddError("Failed to add item. Check name and price."),
      },
    );
  };

  const handleDeleteItem = (itemId: number) => {
    deleteReceiptItem({ eventId, itemId }, { onSuccess: () => refetch() });
  };

  // ── Payment app handoff helpers ───────────────────────────────────────────
  const openWithFallback = async (appUrl: string, webUrl: string) => {
    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  const handleCopyZelle = async (field: "recipient" | "amount" | "memo" | "all", text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleSendPaymentRequests = () => {
    setPaymentRequestError(null);
    createPaymentRequests(
      { eventId, data: { note: paymentRequestNote.trim() || null } },
      {
        onSuccess: () => {
          setShowRequestPaymentModal(false);
          setPaymentRequestNote("");
          setPaymentRequestError(null);
          refetchPaymentRequests();
          void refetchCustomerInfo();
          if (hostedEventsSent === 0) {
            void StoreReview.isAvailableAsync().then((available) => {
              if (available) void StoreReview.requestReview();
            });
          }
        },
        onError: (err: any) => {
          if (err?.status === 402 || err?.data?.error === "SUBSCRIPTION_REQUIRED") {
            setShowRequestPaymentModal(false);
            setShowPaywallModal(true);
            return;
          }
          setPaymentRequestError("Couldn't send payment requests. Please try again.");
        },
      },
    );
  };

  const closeRequestPaymentModal = () => {
    setShowRequestPaymentModal(false);
    setPaymentRequestError(null);
    setPaymentSetupComplete(false);
    setPaymentSetupValue("");
    setPaymentSetupError(null);
    setPaymentSetupSaving(false);
  };

  const handleSavePaymentSetup = () => {
    const val = paymentSetupValue.trim();
    if (!val) {
      setPaymentSetupError("Please enter your payment info to continue.");
      return;
    }
    if (paymentSetupMethod === "zelle" && !isValidZelleInfo(val)) {
      setPaymentSetupError("Enter a valid phone number or email address.");
      return;
    }
    setPaymentSetupSaving(true);
    setPaymentSetupError(null);
    const updateFields =
      paymentSetupMethod === "cash_app"
        ? { cashAppHandle: val, preferredPaymentMethod: "cash_app" }
        : paymentSetupMethod === "venmo"
          ? { venmoHandle: val, preferredPaymentMethod: "venmo" }
          : { zelleInfo: val, preferredPaymentMethod: "zelle" };
    updateMyProfile(
      { data: updateFields },
      {
        onSuccess: () => {
          setPaymentSetupSaving(false);
          setPaymentSetupComplete(true);
          void refetchMyProfile();
        },
        onError: () => {
          setPaymentSetupSaving(false);
          setPaymentSetupError("Couldn't save payment info. Please try again.");
        },
      },
    );
  };

  const handleMarkPaid = (requestId: number) => {
    setMarkingPaidId(requestId);
    setIPaidError(null);
    updatePaymentRequestStatus(
      { requestId, data: { status: "paid" } },
      {
        onSuccess: () => {
          setMarkingPaidId(null);
          setIPaidError(null);
          refetchPaymentRequests();
        },
        onError: () => {
          setMarkingPaidId(null);
          setIPaidError("Couldn't mark payment as paid. Please try again.");
        },
      },
    );
  };

  const handleMarkReceived = (requestId: number) => {
    setMarkingReceivedId(requestId);
    setMarkReceivedError(null);
    updatePaymentRequestStatus(
      { requestId, data: { status: "received" } },
      {
        onSuccess: () => {
          setMarkingReceivedId(null);
          setMarkReceivedError(null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetchPaymentRequests();
        },
        onError: () => {
          setMarkingReceivedId(null);
          setMarkReceivedError("Couldn't mark payment as received. Please try again.");
        },
      },
    );
  };

  const handleSavePaymentEdit = () => {
    if (!editingRequest) return;
    const parsed = parseFloat(editAmountText.trim().replace(/[$,]/g, ""));
    if (isNaN(parsed) || parsed <= 0) {
      setPaymentEditError("Please enter a valid amount greater than $0.");
      return;
    }
    const amountCents = Math.round(parsed * 100);
    setIsSavingEdit(true);
    setPaymentEditError(null);
    updatePaymentRequestAmount(
      { requestId: editingRequest.id, data: { amountCents, note: editNoteText.trim() || null } },
      {
        onSuccess: () => {
          setIsSavingEdit(false);
          setEditingRequest(null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetchPaymentRequests();
        },
        onError: () => {
          setIsSavingEdit(false);
          setPaymentEditError("Couldn't save changes. Please try again.");
        },
      },
    );
  };

  const handleToggleClaim = (itemId: number) => {
    if (claimingItemId === itemId) return;
    setClaimingItemId(itemId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleClaim(
      { eventId, itemId },
      {
        onSuccess: () => { refetch(); setClaimingItemId(null); },
        onError: () => {
          setClaimingItemId(null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Couldn't update", "Failed to update your claim. Please try again.");
        },
      },
    );
  };

  const handleSaveTotals = () => {
    setTotalsError(null);
    const subCents = Math.round(parseFloat(subtotalInput.trim() || "0") * 100);
    const serviceFeeSaveCents = Math.round(parseFloat(serviceFeeInput.trim() || "0") * 100);
    const taxSaveCents = Math.round(parseFloat(taxInput.trim() || "0") * 100);
    const tipSaveCents = Math.round(parseFloat(tipInput.trim() || "0") * 100);
    const computedTotalCents = subCents + serviceFeeSaveCents + taxSaveCents + tipSaveCents;
    const computedTotal = computedTotalCents > 0 ? (computedTotalCents / 100).toFixed(2) : null;
    if (computedTotal) setTotalInput(computedTotal);
    updateReceipt(
      {
        eventId,
        data: {
          subtotal: subtotalInput.trim() || null,
          serviceFee: serviceFeeInput.trim() || null,
          tax: taxInput.trim() || null,
          tip: tipInput.trim() || null,
          total: computedTotal,
        },
      },
      {
        onSuccess: () => refetch(),
        onError: () => setTotalsError("Failed to save. Check that all values are valid numbers."),
      },
    );
  };

  // Compress any image asset to JPEG ≤ 1920 px on the longest side at quality 0.7
  // before uploading. This keeps receipts fully readable for OCR while keeping
  // payload sizes well under the proxy's body-size limit (~200–400 KB vs 3–5 MB raw).
  const compressForUpload = async (
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<{ uri: string; type: string; name: string }> => {
    const MAX_PX = 1920;
    const { width, height } = asset;
    const actions: ImageManipulator.Action[] = [];
    if (width > MAX_PX || height > MAX_PX) {
      actions.push({ resize: width >= height ? { width: MAX_PX } : { height: MAX_PX } });
    }
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      actions,
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, type: "image/jpeg", name: "photo.jpg" };
  };

  const handlePickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library to upload photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    uploadPhoto(
      { eventId, asset },
      {
        onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); refetch(); },
        onError: () => Alert.alert("Upload failed", "Could not upload photo. Please try again."),
      },
    );
  };

  const handleTakePhoto = () => {
    setShowReceiptCameraGuide(true);
  };

  const handleOpenReceiptCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    const doUpload = () => {
      uploadPhoto(
        { eventId, asset },
        {
          onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); refetch(); },
          onError: () => Alert.alert("Upload failed", "Could not upload photo. Please try again."),
        },
      );
    };

    const pixelCount = asset.width > 0 && asset.height > 0 ? asset.width * asset.height : Infinity;
    const fileTooSmall = asset.fileSize !== undefined && asset.fileSize < 40_000;
    const qualityPoor = pixelCount < 640_000 || fileTooSmall;

    if (qualityPoor) {
      Alert.alert(
        "Receipt may be hard to scan",
        "This photo looks small or low quality. For best results, retake in better light with the receipt filling the frame.",
        [
          { text: "Retake", style: "cancel", onPress: () => { void handleOpenReceiptCamera(); } },
          { text: "Use Anyway", onPress: doUpload },
        ],
      );
      return;
    }

    doUpload();
  };

  const handleDeletePhoto = (photoId: number) => {
    deletePhoto(
      { eventId, photoId },
      { onSuccess: () => refetch() },
    );
  };

  const enterSelectMode = (itemId: number) => {
    setIsSelectMode(true);
    setSelectedItemIds(new Set([itemId]));
    setBulkError(null);
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItemIds(new Set());
    setBulkError(null);
  };

  const toggleItemSelected = (id: number) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkAction = (action: "assign_to_me" | "clear" | "assign_unclaimed_to_me") => {
    if (isBulkPending) return;
    const useAllItems = action === "assign_unclaimed_to_me";
    const itemIdsList = useAllItems ? items.map((i) => i.id) : Array.from(selectedItemIds);
    if (itemIdsList.length === 0) return;
    setIsBulkPending(true);
    setBulkError(null);
    bulkAssignMutate(
      { eventId, data: { itemIds: itemIdsList, action } },
      {
        onSuccess: () => { setIsBulkPending(false); exitSelectMode(); refetch(); },
        onError: () => { setIsBulkPending(false); setBulkError("Failed to apply. Please try again."); },
      },
    );
  };

  const handleBulkSplit = () => {
    if (isBulkPending || selectedItemIds.size === 0) return;
    setBulkSplitKeys(new Set());
    setBulkSplitModalVisible(true);
  };

  const confirmBulkSplit = () => {
    if (isBulkPending || bulkSplitKeys.size === 0) return;
    setIsBulkPending(true);
    setBulkError(null);
    const userIds = Array.from(bulkSplitKeys).filter((k) => k > 0);
    const guestParticipantIds = Array.from(bulkSplitKeys).filter((k) => k < 0).map((k) => Math.abs(k));
    bulkAssignMutate(
      { eventId, data: { itemIds: Array.from(selectedItemIds), action: "replace", userIds: userIds.length > 0 ? userIds : undefined, guestParticipantIds: guestParticipantIds.length > 0 ? guestParticipantIds : undefined } },
      {
        onSuccess: () => { setIsBulkPending(false); setBulkSplitModalVisible(false); exitSelectMode(); refetch(); },
        onError: () => { setIsBulkPending(false); setBulkError("Failed to apply. Please try again."); },
      },
    );
  };

  const handleResetBill = () => {
    Alert.alert(
      "Reset bill?",
      "This will delete the receipt photos, line items, assignments, totals, and payment requests for this bill. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Bill",
          style: "destructive",
          onPress: () => {
            setIsResettingBill(true);
            setResetBillError(null);
            resetBillMutate(
              { eventId },
              {
                onSuccess: () => {
                  setIsResettingBill(false);
                  refetch();
                  void refetchPaymentRequests();
                },
                onError: () => {
                  setIsResettingBill(false);
                  setResetBillError("Failed to reset the bill. Please try again.");
                },
              },
            );
          },
        },
      ],
    );
  };

  const clearScanErrorBanner = () => {
    if (scanErrorTimerRef.current) {
      clearTimeout(scanErrorTimerRef.current);
      scanErrorTimerRef.current = null;
    }
    scanErrorTimerStartRef.current = null;
    scanErrorTimerRemainingRef.current = null;
    setScanErrorBanner(null);
  };

  const startScanErrorTimer = (ms: number) => {
    if (scanErrorTimerRef.current) clearTimeout(scanErrorTimerRef.current);
    scanErrorTimerStartRef.current = Date.now();
    scanErrorTimerDurationRef.current = ms;
    scanErrorTimerRef.current = setTimeout(() => {
      scanErrorTimerRef.current = null;
      scanErrorTimerStartRef.current = null;
      scanErrorTimerRemainingRef.current = null;
      setScanErrorBanner(null);
    }, ms);
  };

  const showScanError = (message: string, onRetry?: () => void) => {
    setScanErrorBanner({ message, onRetry });
    startScanErrorTimer(6000);
  };

  // ── Stuck-scan warning — show a banner if scanning takes > 90 s ─────────────
  useEffect(() => {
    if (scanningPhotoId !== null) {
      setScanStuckWarning(false);
      if (scanStuckTimerRef.current) clearTimeout(scanStuckTimerRef.current);
      scanStuckTimerRef.current = setTimeout(() => {
        scanStuckTimerRef.current = null;
        setScanStuckWarning(true);
      }, 90_000);
    } else {
      if (scanStuckTimerRef.current) {
        clearTimeout(scanStuckTimerRef.current);
        scanStuckTimerRef.current = null;
      }
      setScanStuckWarning(false);
    }
    return () => {
      if (scanStuckTimerRef.current) {
        clearTimeout(scanStuckTimerRef.current);
        scanStuckTimerRef.current = null;
      }
    };
  }, [scanningPhotoId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        if (scanErrorTimerRef.current && scanErrorTimerStartRef.current !== null) {
          const elapsed = Date.now() - scanErrorTimerStartRef.current;
          const remaining = Math.max(0, scanErrorTimerDurationRef.current - elapsed);
          clearTimeout(scanErrorTimerRef.current);
          scanErrorTimerRef.current = null;
          scanErrorTimerStartRef.current = null;
          scanErrorTimerRemainingRef.current = remaining;
        }
        if (scanRetryTimerRef.current && scanRetryTimerStartRef.current !== null) {
          const elapsed = Date.now() - scanRetryTimerStartRef.current;
          const remaining = Math.max(0, 4000 - elapsed);
          clearTimeout(scanRetryTimerRef.current);
          scanRetryTimerRef.current = null;
          scanRetryTimerStartRef.current = null;
          scanRetryTimerRemainingRef.current = remaining;
        }
      } else if (nextState === "active") {
        if (scanErrorTimerRemainingRef.current !== null && scanErrorTimerRemainingRef.current > 0) {
          startScanErrorTimer(scanErrorTimerRemainingRef.current);
          scanErrorTimerRemainingRef.current = null;
        } else if (scanErrorTimerRemainingRef.current === 0) {
          scanErrorTimerRemainingRef.current = null;
          setScanErrorBanner(null);
        }
        if (scanRetryTimerRemainingRef.current !== null) {
          const remaining = scanRetryTimerRemainingRef.current;
          scanRetryTimerRemainingRef.current = null;
          if (remaining > 0) {
            scanRetryTimerStartRef.current = Date.now();
            scanRetryTimerRef.current = setTimeout(() => {
              scanRetryTimerRef.current = null;
              scanRetryTimerStartRef.current = null;
              handleScanPhoto(scanRetryPhotoIdRef.current!);
            }, remaining);
          } else {
            handleScanPhoto(scanRetryPhotoIdRef.current!);
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);

  const handleScanPhoto = (photoId: number) => {
    if (scanningPhotoId !== null || ocrDraft !== null) return;
    if (scanRetryTimerRef.current) {
      clearTimeout(scanRetryTimerRef.current);
      scanRetryTimerRef.current = null;
      scanRetryTimerStartRef.current = null;
      scanRetryPhotoIdRef.current = null;
    }
    if (scanErrorTimerRef.current) {
      clearTimeout(scanErrorTimerRef.current);
      scanErrorTimerRef.current = null;
    }
    setScanningPhotoId(photoId);
    clearScanErrorBanner();
    scanPhoto(
      { eventId, photoId },
      {
        onSuccess: (result) => {
          setScanningPhotoId(null);
          clearScanErrorBanner();
          // Immediately refresh so all participants see the completed scan
          // without waiting for the next poll tick.
          void refetch();
          setDraftPhotoId(photoId);
          setOcrDraft(result);
          const rawDraft: DraftItem[] = result.items.map((item, i) => ({
            localId: `${Date.now()}-${i}`,
            name: item.name,
            quantity: item.quantity != null ? String(item.quantity) : "1",
            priceStr: item.priceStr,
          }));
          setDraftItems(mergeDraftDuplicates(rawDraft));
          setIsDraftModalVisible(true);
        },
        onError: (err) => {
          setScanningPhotoId(null);
          const apiErr = err as { status?: number; data?: { code?: string } } | null;
          const status = apiErr?.status;
          const code = apiErr?.data?.code;

          if (status === 429) {
            showScanError("Scan limit reached. Please wait a moment and try again.");
          } else if (status === 409 && code === "scan_in_progress") {
            showScanError(
              "Someone is already scanning this receipt. Retrying in a moment\u2026",
              () => handleScanPhoto(photoId),
            );
            scanRetryPhotoIdRef.current = photoId;
            scanRetryTimerStartRef.current = Date.now();
            scanRetryTimerRef.current = setTimeout(() => {
              scanRetryTimerRef.current = null;
              scanRetryTimerStartRef.current = null;
              scanRetryPhotoIdRef.current = null;
              handleScanPhoto(photoId);
            }, 4000);
          } else if (status === 409) {
            showScanError("Already scanned. Review the items below or add any missing ones manually.");
          } else if (status === 404) {
            showScanError("Receipt photo not found. Try uploading a new one.");
          } else if (status === 422) {
            showScanError("Receipt too blurry to read. Try a sharper photo or add items manually.", () => handleScanPhoto(photoId));
          } else {
            showScanError("Scan failed. Try again or add items manually.", () => handleScanPhoto(photoId));
          }
        },
      },
    );
  };

  const handleCloseDraft = () => {
    openDraftCloseAlert(eventId, {
      setOcrDraft,
      setDraftItems,
      setDraftPhotoId,
      setDraftErrors,
      setIsDraftModalVisible,
    });
  };

  const handleDraftItemChange = (localId: string, field: "name" | "quantity" | "priceStr", value: string) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)),
    );
    setDraftErrors((prev) => {
      const rowErr = prev[localId];
      if (!rowErr) return prev;
      const updated = { ...rowErr };
      delete updated[field];
      if (Object.keys(updated).length === 0) {
        const { [localId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [localId]: updated };
    });
  };

  const handleDeleteDraftItem = (localId: string) => {
    setDraftItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const handleMergeDuplicates = () => {
    setDraftItems((prev) => mergeDraftDuplicates(prev));
  };

  const handleAddDraftItem = () => {
    const localId = `manual-${Date.now()}`;
    setDraftItems((prev) => [...prev, { localId, name: "", quantity: "1", priceStr: "" }]);
    setTimeout(() => ocrDraftScrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const scrollToFirstSuspicious = () => {
    const suspicious = draftItems.find((item) => {
      const qty = parseInt(item.quantity.trim(), 10);
      const price = parseFloat(item.priceStr.trim().replace(/^\$/, ""));
      return qty > 1 || isNaN(price) || price <= 0 || item.name.trim() === "";
    });
    if (suspicious !== undefined && draftItemLayouts.current[suspicious.localId] !== undefined) {
      ocrDraftScrollRef.current?.scrollTo({ y: draftItemLayouts.current[suspicious.localId], animated: true });
    }
  };

  const handleConfirmDraft = async () => {
    if (isConfirmingDraft) return;

    // ── local validation — runs before any API call ────────────────────────────
    const newErrors: Record<string, { name?: string; quantity?: string; priceStr?: string }> = {};
    for (const item of draftItems) {
      const errs: { name?: string; quantity?: string; priceStr?: string } = {};
      if (!item.name.trim()) {
        errs.name = "Item name is required";
      }
      const qtyTrimmed = item.quantity.trim();
      const qtyInt = parseInt(qtyTrimmed, 10);
      if (!qtyTrimmed || isNaN(qtyInt) || qtyInt < 1 || String(qtyInt) !== qtyTrimmed) {
        errs.quantity = "Quantity must be a whole number ≥ 1";
      }
      const cleanPrice = item.priceStr.trim().replace(/^\$/, "");
      const priceNum = parseFloat(cleanPrice);
      if (!cleanPrice || !Number.isFinite(priceNum) || priceNum <= 0) {
        errs.priceStr = "Price must be a valid number greater than 0";
      }
      if (Object.keys(errs).length > 0) newErrors[item.localId] = errs;
    }
    if (Object.keys(newErrors).length > 0) {
      setDraftErrors(newErrors);
      ocrDraftScrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    // ── save items ─────────────────────────────────────────────────────────────
    setIsConfirmingDraft(true);
    try {
      for (const item of draftItems) {
        const quantity = Math.max(1, parseInt(item.quantity.trim(), 10) || 1);
        const cleanPrice = item.priceStr.trim().replace(/^\$/, "");
        try {
          await new Promise<void>((resolve, reject) => {
            createReceiptItem(
              { eventId, data: { name: item.name.trim(), price: cleanPrice, quantity } },
              { onSuccess: () => resolve(), onError: () => reject() },
            );
          });
        } catch {
          console.warn("[OCR confirm] Item save failed:", { name: item.name.trim(), quantity, price: cleanPrice });
          setDraftErrors((prev) => ({
            ...prev,
            [item.localId]: { priceStr: "Could not save — check name and price and try again" },
          }));
          return;
        }
      }
    } finally {
      setIsConfirmingDraft(false);
    }

    // ── totals PATCH — separate; item saves already succeeded ─────────────────
    if (ocrDraft && (ocrDraft.subtotal || ocrDraft.serviceFee || ocrDraft.tax || ocrDraft.tip || ocrDraft.total)) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateReceipt(
            {
              eventId,
              data: {
                subtotal: ocrDraft.subtotal ?? null,
                serviceFee: ocrDraft.serviceFee ?? null,
                tax: ocrDraft.tax ?? null,
                tip: ocrDraft.tip ?? null,
                total: ocrDraft.total ?? null,
              },
            },
            { onSuccess: () => resolve(), onError: () => reject() },
          );
        });
        if (ocrDraft.subtotal) setSubtotalInput(ocrDraft.subtotal);
        if (ocrDraft.serviceFee) setServiceFeeInput(ocrDraft.serviceFee);
        if (ocrDraft.tax) setTaxInput(ocrDraft.tax);
        if (ocrDraft.tip) setTipInput(ocrDraft.tip);
        if (ocrDraft.total) setTotalInput(ocrDraft.total);
      } catch {
        Alert.alert(
          "Totals not saved",
          "Items were saved successfully, but receipt totals could not be updated. You can enter them manually.",
        );
      }
    }

    refetch();
    // Clear AsyncStorage draft now that items are successfully saved.
    void clearOcrDraft(eventId);
    // Bypass the discard-confirmation Alert — items are already on the server.
    setIsDraftModalVisible(false);
    setOcrDraft(null);
    setDraftItems([]);
    setDraftPhotoId(null);
    setDraftErrors({});
  };

  const handleTakeEventPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    uploadEventPhotoMutate(
      { eventId, asset },
      { onSuccess: () => refetch(), onError: () => Alert.alert("Upload failed", "Could not upload photo. Please try again.") },
    );
  };

  const handlePickEventPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library to upload photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;

    setIsUploadingEventPhotos(true);
    setPhotoUploadProgress({ current: 0, total: result.assets.length });
    let failed = 0;
    let uploaded = 0;
    for (const asset of result.assets) {
      try {
        await doPresignedEventPhotoUpload(eventId, asset);
        uploaded++;
      } catch {
        failed++;
      }
      setPhotoUploadProgress({ current: uploaded + failed, total: result.assets.length });
    }
    setIsUploadingEventPhotos(false);
    setPhotoUploadProgress({ current: 0, total: 0 });
    void refetch();
    if (failed > 0) {
      Alert.alert("Upload failed", `${failed} photo${failed > 1 ? "s" : ""} could not be uploaded. Please try again.`);
    }
  };

  const handleDeleteEventPhoto = (photoId: number) => {
    deleteEventPhotoMutate(
      { eventId, photoId },
      {
        onSuccess: () => refetch(),
        onError: () => Alert.alert("Delete failed", "Could not delete the photo. Please try again."),
      },
    );
  };

  const handleShareInvite = () => {
    generateJoinCode(
      { eventId },
      {
        onSuccess: (share) => {
          const code = share.joinCode;
          setEventJoinCode(code);
          const domain = process.env.EXPO_PUBLIC_DOMAIN;
          const deepLink = `owmo://join/${code}`;
          const webHint = domain ? ` (or go to https://${domain}/join/${code})` : "";
          void Share.share({
            message: `Join me at "${data?.title ?? "this event"}"!\n\nOpen the invite: ${deepLink}${webHint}\n\nOr enter code: ${code}`,
            title: `Join ${data?.title ?? "this event"}`,
          });
        },
        onError: () => {
          Alert.alert("Could not generate invite link", "Please try again.");
        },
      },
    );
  };

  const handleGenerateQRCode = () => {
    setIsGeneratingQR(true);
    generateJoinCode(
      { eventId },
      {
        onSuccess: (share) => {
          setEventJoinCode(share.joinCode);
          setIsGeneratingQR(false);
        },
        onError: () => {
          setIsGeneratingQR(false);
          Alert.alert("Could not generate invite link", "Please try again.");
        },
      },
    );
  };

  const handleShareQRImage = async () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!eventJoinCode) return;
    const linkUrl = domain ? `https://${domain}/join/${eventJoinCode}` : `owmo://join/${eventJoinCode}`;
    if (qrContainerRef.current) {
      try {
        const uri = await captureRef(qrContainerRef, { format: "png", quality: 1, result: "tmpfile" });
        const sharingAvailable = await Sharing.isAvailableAsync();
        if (sharingAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: `Invite to ${data?.title ?? "this event"}`,
          });
          return;
        }
      } catch {
        // fall through to link share
      }
    }
    await Share.share({ message: `Join me at "${data?.title ?? "this event"}"!\n${linkUrl}` });
  };

  const handleCopyJoinLink = async () => {
    if (!eventJoinCode) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}/join/${eventJoinCode}` : `owmo://join/${eventJoinCode}`;
    await Clipboard.setStringAsync(url);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleOpenScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera access needed",
          "Enable camera access in Settings to scan QR codes.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
    }
    setHasScanned(false);
    setShowScannerModal(true);
  };

  const handleQRCodeScanned = ({ data: qrData }: { type: string; data: string }) => {
    if (hasScanned) return;
    const codeMatch = qrData.match(/\/join\/([A-Z0-9]+)$/i) ?? qrData.match(/^invite:\/\/join\/([A-Z0-9]+)$/i);
    const code = codeMatch?.[1];
    if (code) {
      setHasScanned(true);
      setShowScannerModal(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/join/${code}` as Href);
    } else {
      setHasScanned(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Not an invite code",
        "This QR code isn't an invite for this app. Scan a different one.",
        [{ text: "Try again", onPress: () => setHasScanned(false) }],
      );
    }
  };

  const toggleInviteSelection = (userId: number) => {
    setSelectedInviteIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleBulkInvite = async () => {
    if (selectedInviteIds.size === 0) return;
    setIsBulkInviting(true);
    const ids = [...selectedInviteIds];
    await Promise.allSettled(
      ids.map((userId) => inviteToEventAsync({ eventId, data: { userId } })),
    );
    setIsBulkInviting(false);
    setSelectedInviteIds(new Set());
    setShowInviteModal(false);
    setInviteSearchQuery("");
    setContactAppUsers([]);
    refetch();
  };

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const { data: contactData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const withPhone = contactData.filter(
        (c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0,
      );
      withPhone.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

      // Build a hash -> contact mapping so we can correlate matches back to contacts
      const hashToContactKey = new Map<string, string>(); // hash -> contact key
      const contactKeyToHash = new Map<string, string>(); // contact key -> hash
      await Promise.all(
        withPhone.map(async (c) => {
          const rawPhone = c.phoneNumbers?.[0]?.number ?? "";
          if (!rawPhone) return;
          const hash = await hashPhone(rawPhone);
          if (!hash) return;
          const key = c.id ?? c.name ?? rawPhone;
          contactKeyToHash.set(key, hash);
          if (!hashToContactKey.has(hash)) {
            hashToContactKey.set(hash, key);
          }
        }),
      );

      const allHashes = [...hashToContactKey.keys()];
      if (allHashes.length > 0) {
        try {
          const result = await matchPhones({ hashes: allHashes });
          const matchedHashSet = new Set(result.matches.map((m) => m.phoneNumberHash));
          // Non-app contacts: those whose first-phone hash wasn't matched
          const nonApp = withPhone.filter((c) => {
            const key = c.id ?? c.name ?? (c.phoneNumbers?.[0]?.number ?? "");
            const hash = contactKeyToHash.get(key);
            return !hash || !matchedHashSet.has(hash);
          });
          setContacts(nonApp);
          setContactAppUsers(result.matches);
        } catch {
          setContacts(withPhone);
          setContactAppUsers([]);
        }
      } else {
        setContacts(withPhone);
        setContactAppUsers([]);
      }
    } catch {
      // ignore
    } finally {
      setContactsLoading(false);
    }
  };

  const handleRequestContactsPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setContactsPermission("granted");
      void loadContacts();
    } else {
      setContactsPermission("denied");
    }
  };

  const handleContactSmsInvite = async (contact: Contacts.ExistingContact) => {
    const phone = contact.phoneNumbers?.[0]?.number ?? "";
    const eventTitle = data?.title ?? "my event";
    const message = `Hey! I'm using Owmo to split bills — join my event "${eventTitle}" here: https://workspace.jluabena.replit.app`;
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([phone], message);
      } else {
        await Share.share({ message });
      }
    } catch {
      await Share.share({ message });
    }
  };

  useEffect(() => {
    if (!showInviteModal) return;
    Contacts.getPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        setContactsPermission("granted");
        void loadContacts();
      } else if (status === "denied") {
        setContactsPermission("denied");
      } else {
        setContactsPermission("undetermined");
      }
    });
  }, [showInviteModal]);

  useEffect(() => {
    if (isHost && showInviteModal && eventJoinCode) {
      setShowQRPanel(true);
    }
  }, [isHost, showInviteModal, eventJoinCode]);

  const handleRemoveParticipant = (userId: number | null, displayName: string, role: string, guestParticipantId?: number | null) => {
    const isGuest = role === "guest";
    const losesAccess = role === "accepted" || role === "participant";
    Alert.alert(
      "Remove participant",
      losesAccess
        ? `Remove ${displayName} from this event? This will revoke their access.`
        : isGuest
        ? `Remove ${displayName} from this event? Their bill assignments will be cleared.`
        : `Remove ${displayName} from this event?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (isGuest && guestParticipantId) {
              removeGuestMutate(
                { eventId, guestParticipantId },
                { onSuccess: () => refetch() },
              );
            } else if (userId !== null) {
              removeParticipant(
                { eventId, userId },
                { onSuccess: () => refetch() },
              );
            }
          },
        },
      ],
    );
  };

  const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  const handleRemindParticipant = (p: ParticipantSummary) => {
    const isGuest = p.role === "guest";
    const key = isGuest ? `guest-${p.guestParticipantId}` : String(p.userId);

    // Guard: within 24 h cooldown
    if (p.reminderSentAt) {
      const elapsed = Date.now() - new Date(p.reminderSentAt).getTime();
      if (elapsed < REMIND_COOLDOWN_MS) return;
    }

    setRemindingKey(key);

    if (isGuest && p.guestParticipantId != null) {
      remindGuestMutate(
        { eventId, guestParticipantId: p.guestParticipantId },
        {
          onSuccess: () => {
            setRemindingKey(null);
            refetch();
            Alert.alert("Reminder sent", `A reminder was sent to ${p.displayName}.`);
          },
          onError: () => {
            setRemindingKey(null);
            Alert.alert("Couldn't send reminder", "Please try again.");
          },
        },
      );
    } else if (p.userId != null) {
      remindParticipantMutate(
        { eventId, targetUserId: p.userId },
        {
          onSuccess: () => {
            setRemindingKey(null);
            refetch();
            Alert.alert("Reminder sent", `A reminder was sent to ${p.displayName}.`);
          },
          onError: () => {
            setRemindingKey(null);
            Alert.alert("Couldn't send reminder", "Please try again.");
          },
        },
      );
    } else {
      setRemindingKey(null);
    }
  };

  const handleRsvp = (action: "accept" | "decline") => {
    void Haptics.notificationAsync(
      action === "accept"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    respondToInvitation(
      { eventId, data: { action } },
      {
        onSuccess: () => refetch(),
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Failed to update RSVP.";
          Alert.alert("RSVP error", msg);
        },
      },
    );
  };

  const handleHostAssign = (itemId: number, participantKey: number, claimed: boolean) => {
    if (togglingUserId === participantKey) return;
    setTogglingUserId(participantKey);
    const data = participantKey < 0
      ? { guestParticipantId: -participantKey, claimed }
      : { userId: participantKey, claimed };
    hostAssignItem(
      { eventId, itemId, data },
      {
        onSuccess: () => { refetch(); setTogglingUserId(null); },
        onError: () => setTogglingUserId(null),
      },
    );
  };

  const openGuestPayInfoModal = (p: ParticipantSummary) => {
    setGuestPayInfoParticipant(p);
    setGuestPayInfoCashApp(p.cashAppHandle ?? "");
    setGuestPayInfoVenmo(p.venmoHandle ?? "");
    setGuestPayInfoPhone(p.phoneNumber ?? "");
    setGuestPayInfoError(null);
    setGuestPayInfoScanning(null);
  };

  const handleAddGuest = () => {
    const name = addGuestNameInput.trim();
    if (!name) { setAddGuestError("Please enter a name."); return; }
    setAddGuestError(null);
    setIsAddingGuest(true);
    addGuestMutate(
      { eventId, data: { name, saveGuest: addGuestSaveToggle } },
      {
        onSuccess: (result) => {
          setIsAddingGuest(false);
          setShowAddGuestModal(false);
          setAddGuestNameInput("");
          setAddGuestSaveToggle(false);
          refetch();
          const newGuest = result.participants
            .filter((p) => p.role === "guest" && p.guestParticipantId != null)
            .sort((a, b) => (b.guestParticipantId ?? 0) - (a.guestParticipantId ?? 0))[0];
          if (newGuest) setPostAddGuestParticipant(newGuest);
        },
        onError: () => {
          setIsAddingGuest(false);
          setAddGuestError("Failed to add person. Please try again.");
        },
      },
    );
  };

  const handleAddSavedContact = (contact: SavedContact) => {
    setIsAddingGuest(true);
    addGuestMutate(
      { eventId, data: { name: contact.name, savedGuestId: contact.id } },
      {
        onSuccess: (result) => {
          setIsAddingGuest(false);
          setShowAddGuestModal(false);
          refetch();
          const newGuest = result.participants
            .filter((p) => p.role === "guest" && p.guestParticipantId != null)
            .sort((a, b) => (b.guestParticipantId ?? 0) - (a.guestParticipantId ?? 0))[0];
          if (newGuest && !newGuest.cashAppHandle && !newGuest.venmoHandle) {
            setPostAddGuestParticipant(newGuest);
          }
        },
        onError: () => {
          setIsAddingGuest(false);
          setAddGuestError("Failed to add person. Please try again.");
        },
      },
    );
  };

  const handleSelectTipPercent = (pct: "15" | "18" | "20") => {
    if (!receipt) return;
    const base = dbSubtotalCents > 0 ? dbSubtotalCents : itemsSubtotalCents;
    const percentVal = pct === "15" ? 15 : pct === "18" ? 18 : 20;
    const newTipCents = Math.round(base * percentVal / 100);
    const newTip = (newTipCents / 100).toFixed(2);
    const newTotalCents = base + dbServiceFeeCents + dbTaxCents + newTipCents;
    const newTotal = (newTotalCents / 100).toFixed(2);
    setTipInput(newTip);
    setTotalInput(newTotal);
    setTipMode(pct);
    updateReceipt(
      { eventId, data: { subtotal: subtotalInput.trim() || null, serviceFee: serviceFeeInput.trim() || null, tax: taxInput.trim() || null, tip: newTip, total: newTotal } },
      { onSuccess: () => refetch() },
    );
  };

  const handleSendMessage = () => {
    const body = chatInput.trim();
    if (!body || isSendingMessage) return;
    setChatError(null);
    sendChatMessage(
      { eventId, data: { body } },
      {
        onSuccess: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setChatInput("");
          refetchChat();
          setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Failed to send message.";
          setChatError(msg);
        },
      },
    );
  };

  const handleCantPayQuickReply = (body: string) => {
    if (!body.trim() || cantPayReplySending) return;
    setCantPayReplySending(true);
    sendChatMessage(
      { eventId, data: { body: body.trim() } },
      {
        onSuccess: () => {
          setCantPayReplySending(false);
          setCantPayReplyMsgId(null);
          setCantPayReplyText("");
          refetchChat();
        },
        onError: () => {
          setCantPayReplySending(false);
        },
      },
    );
  };

  const handleCancelEvent = () => {
    Alert.alert(
      "Cancel this event?",
      "This will permanently cancel the event. Participants can no longer chat, claim items, or RSVP.",
      [
        { text: "Keep Event", style: "cancel" },
        {
          text: "Cancel Event",
          style: "destructive",
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            cancelEvent({ eventId }, { onSuccess: () => refetch() });
          },
        },
      ],
    );
  };

  const handleTransferHost = (targetUserId: number, targetName: string) => {
    Alert.alert(
      "Transfer host?",
      `Make ${targetName} the new host? You will become a regular participant and lose all host controls.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setTransferringTo(targetUserId);
            transferHostMutate(
              { eventId, targetUserId },
              {
                onSuccess: () => refetch(),
                onSettled: () => setTransferringTo(null),
              },
            );
          },
        },
      ],
    );
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const items = data?.items ?? [];
  const assignments = data?.assignments ?? [];
  const participants = data?.participants ?? [];
  const receipt = data?.receipt ?? null;

  // RSVP counts (host-only badge in the header)
  const rsvpGoingCount = participants.filter(
    (p) => p.role === "accepted" || p.role === "participant" || p.role === "guest",
  ).length;
  const rsvpDeclinedCount = participants.filter((p) => p.role === "declined").length;
  const rsvpAwaitingCount = participants.filter((p) => p.role === "invited").length;
  const photos = data?.photos ?? [];
  const eventPhotos = data?.eventPhotos ?? [];

  // A scan is "in progress" from the server's perspective when any receipt
  // photo has a non-null, non-stale scanLockedAt. Stale = older than 5 min
  // (mirrors SCAN_LOCK_TIMEOUT_MS on the server).
  const SCAN_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
  const isScanInProgress = photos.some((p) => {
    if (!p.scanLockedAt) return false;
    return Date.now() - new Date(p.scanLockedAt).getTime() < SCAN_LOCK_TIMEOUT_MS;
  });

  const activeParticipants = participants.filter((p) =>
    ["host", "participant", "accepted", "guest"].includes(p.role),
  );

  const itemsSubtotalCents = items.reduce(
    (sum, item) => sum + Math.round(parseFloat(item.price) * item.quantity * 100),
    0,
  );

  const dbSubtotalCents = parseCents(receipt?.subtotal);
  const dbServiceFeeCents = parseCents(receipt?.serviceFee);
  const dbTaxCents = parseCents(receipt?.tax);
  const dbTipCents = parseCents(receipt?.tip);
  const dbTotalCents = parseCents(receipt?.total);

  const totals = computeTotals(items, assignments, dbTaxCents, dbTipCents, dbTotalCents);

  // Items with no active claim — drives the Bill tab badge and the host send-requests CTA.
  const unassignedCount = items.filter(
    (item) => assignments.filter((a) => a.receiptItemId === item.id && a.claimed).length === 0,
  ).length;

  const myClaimFor = (itemId: number) =>
    assignments.find((a) => a.receiptItemId === itemId && a.userId === myUserId);

  const activeClaimersFor = (itemId: number) =>
    assignments.filter((a) => a.receiptItemId === itemId && a.claimed);

  const hasAnyDbTotals =
    receipt !== null &&
    (receipt.subtotal != null || receipt.serviceFee != null || receipt.tax != null || receipt.tip != null || receipt.total != null);

  // ── Payment request derived values ────────────────────────────────────────
  const paymentRequests = paymentRequestsData?.requests ?? [];

  // For guests: backend SQL-filters to only their own row, so first element is theirs
  const myPaymentRequest = !isHost ? (paymentRequests[0] ?? null) : null;

  // Host: true when every payment request has been confirmed received
  const isSettled = isHost && paymentRequests.length > 0 && paymentRequests.every((r) => r.status === "received");
  const totalSettledCents = isSettled ? paymentRequests.reduce((sum, r) => sum + r.amountCents, 0) : 0;

  // Haptic when the host's bill fully settles.
  const prevIsSettledRef = useRef(false);
  useEffect(() => {
    if (isSettled && !prevIsSettledRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevIsSettledRef.current = isSettled;
  }, [isSettled]);

  // Haptic when the guest's payment is confirmed by the host.
  const prevRequestStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!isHost && myPaymentRequest?.status === "received" && prevRequestStatusRef.current !== "received") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevRequestStatusRef.current = myPaymentRequest?.status;
  }, [isHost, myPaymentRequest?.status]);

  // Restore "can't pay" and "cash pay" states from AsyncStorage on mount / when PR loads.
  // Sets state both ways so that a new or reset PR id naturally clears stale true values.
  useEffect(() => {
    if (!myPaymentRequest?.id) return;
    const cantKey = `cant_pay_${eventId}_${myPaymentRequest.id}`;
    const cashKey = `cash_pay_${eventId}_${myPaymentRequest.id}`;
    AsyncStorage.getItem(cantKey).then((val) => setCantPaySent(val === "1"));
    AsyncStorage.getItem(cashKey).then((val) => setCashPaySent(val === "1"));
  }, [eventId, myPaymentRequest?.id]);

  // Clear both flags when the host re-issues the same payment request
  // (same PR id, bumped updatedAt means the host sent it again after resolving)
  useEffect(() => {
    if (!myPaymentRequest?.id || !myPaymentRequest?.updatedAt) return;
    const prev = prevPaymentRequestRef.current;
    prevPaymentRequestRef.current = { id: myPaymentRequest.id, updatedAt: myPaymentRequest.updatedAt };
    if (
      prev.id === myPaymentRequest.id &&
      prev.updatedAt !== null &&
      prev.updatedAt !== myPaymentRequest.updatedAt
    ) {
      const cantKey = `cant_pay_${eventId}_${myPaymentRequest.id}`;
      const cashKey = `cash_pay_${eventId}_${myPaymentRequest.id}`;
      void AsyncStorage.removeItem(cantKey);
      void AsyncStorage.removeItem(cashKey);
      setCantPaySent(false);
      setCashPaySent(false);
    }
  }, [eventId, myPaymentRequest?.id, myPaymentRequest?.updatedAt]);

  // Auto-copy full Zelle payment string the moment the Zelle panel becomes visible
  useEffect(() => {
    const zelleInfo = myPaymentRequest?.hostZelleInfo;
    if (!zelleInfo || !isValidZelleInfo(zelleInfo)) return;
    const amountDollars = ((myPaymentRequest?.amountCents ?? 0) / 100).toFixed(2);
    const noteText = myPaymentRequest?.note ?? data?.title ?? "";
    const parts = [`Send $${amountDollars} via Zelle to: ${zelleInfo}`];
    if (noteText) parts.push(`Memo: ${noteText}`);
    void Clipboard.setStringAsync(parts.join(" — "));
    setZelleCopied(true);
    if (zelleTimerRef.current) clearTimeout(zelleTimerRef.current);
    zelleTimerRef.current = setTimeout(() => setZelleCopied(false), 2000);
    return () => {
      if (zelleTimerRef.current) clearTimeout(zelleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPaymentRequest?.hostZelleInfo]);

  // Non-host participants owing > 0 (shown in review modal + gates the button)
  const guestAmountsForModal = activeParticipants
    .filter(
      (p) =>
        p.userId !== myUserId &&
        p.role !== "host" &&
        (totals.byParticipant[pKey(p)] ?? 0) > 0,
    )
    .map((p) => ({ ...p, amountCents: totals.byParticipant[pKey(p)] ?? 0 }));
  const hasGuestsToPay = guestAmountsForModal.length > 0;

  const participantUserIds = new Set(participants.map((p) => p.userId));
  const eligibleFriends = (friendsData?.friends ?? []).filter(
    (f) => !participantUserIds.has(f.user.id),
  );

  // Contact-recognized app users that aren't already friends or participants
  const friendUserIds = new Set((friendsData?.friends ?? []).map((f) => f.user.id));
  const eligibleContactAppUsers: PublicUserProfile[] = contactAppUsers
    .filter((u) => !participantUserIds.has(u.id) && !friendUserIds.has(u.id))
    .map(({ phoneNumberHash: _h, ...rest }) => rest);

  // Users shown in the invite modal: friends + contact app users when no query,
  // search results when typing
  const modalUsers: PublicUserProfile[] = inviteSearchDebounced.length >= 2
    ? (inviteSearchResults ?? []).filter((u) => !participantUserIds.has(u.id))
    : [...eligibleFriends.map((f) => f.user), ...eligibleContactAppUsers];

  // ── Edit event handlers ────────────────────────────────────────────────────

  const openEditModal = useCallback(() => {
    if (!data) return;
    setEditTitle(data.title);
    setEditDestinationQuery(data.restaurantName ?? "");
    setEditDestinationSelected(null);
    setEditDestinationResults([]);
    setEditCityOrZip("");
    setEditLocationDenied(false);
    setEditUserLatLng(null);
    editLocationRequestedRef.current = false;
    if (editSearchTimeoutRef.current) clearTimeout(editSearchTimeoutRef.current);
    if (data.startsAt) {
      const d = new Date(data.startsAt);
      if (!isNaN(d.getTime())) {
        setEditPickedDate(d);
        setEditHasPickedTime(true);
      } else {
        setEditPickedDate(null);
        setEditHasPickedTime(false);
      }
    } else {
      setEditPickedDate(null);
      setEditHasPickedTime(false);
    }
    setEditShowDatePicker(false);
    setEditShowTimePicker(false);
    setEditError(null);
    setShowEditModal(true);
  }, [data]);

  const handleEditDestinationChange = useCallback((text: string) => {
    setEditDestinationQuery(text);
    setEditDestinationSelected(null);
    setEditDestinationResults([]);
    if (editSearchTimeoutRef.current) clearTimeout(editSearchTimeoutRef.current);
    if (text.trim().length < 2) return;
    editSearchTimeoutRef.current = setTimeout(async () => {
      setEditDestinationLoading(true);
      try {
        const results = await searchPlaces(
          text.trim(),
          editUserLatLng?.lat,
          editUserLatLng?.lng,
          !editUserLatLng && editCityOrZip.trim() ? editCityOrZip.trim() : undefined,
        );
        setEditDestinationResults(results);
      } catch {
        // silent
      } finally {
        setEditDestinationLoading(false);
      }
    }, 300);
  }, [editUserLatLng, editCityOrZip]);

  const selectEditDestination = useCallback((result: PlaceResult) => {
    setEditDestinationSelected(result);
    setEditDestinationQuery(result.name);
    setEditDestinationResults([]);
    Keyboard.dismiss();
  }, []);

  const clearEditDestination = useCallback(() => {
    setEditDestinationSelected(null);
    setEditDestinationQuery("");
    setEditDestinationResults([]);
  }, []);

  const requestEditLocationOnce = useCallback(async () => {
    if (editLocationRequestedRef.current) return;
    editLocationRequestedRef.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setEditUserLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else {
        setEditLocationDenied(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveEdit = useCallback(() => {
    const trimmedTitle = editTitle.trim();
    const destQuery = editDestinationQuery.trim();
    if (!trimmedTitle) { setEditError("Title is required."); return; }
    if (!editDestinationSelected && !destQuery) { setEditError("Destination is required."); return; }
    if (!editPickedDate) { setEditError("Date is required."); return; }
    if (!editHasPickedTime) { setEditError("An explicit time is required."); return; }
    setEditError(null);
    updateEventMutate(
      {
        eventId,
        data: {
          title: trimmedTitle,
          restaurantName: editDestinationSelected?.name ?? (destQuery || null),
          destinationAddress: editDestinationSelected?.address ?? null,
          destinationLat: editDestinationSelected?.lat ?? null,
          destinationLng: editDestinationSelected?.lng ?? null,
          destinationPlaceId: editDestinationSelected?.placeId ?? null,
          startsAt: editPickedDate.toISOString(),
        },
      },
      {
        onSuccess: () => { setShowEditModal(false); refetch(); },
        onError: () => setEditError("Failed to save changes. Please try again."),
      },
    );
  }, [editTitle, editDestinationQuery, editDestinationSelected, editPickedDate, editHasPickedTime, eventId, updateEventMutate, refetch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Back bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.back()}
          testID="back-button"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        {isHost && !isCancelled && (
          <Pressable
            style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={openEditModal}
            testID="edit-event-button"
          >
            <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit</Text>
          </Pressable>
        )}
      </View>

      {isLoading || (isFetching && !data) ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            Could not load event.
          </Text>
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.retryBtn, { marginTop: 8 }]}>
            <Text style={[styles.retryText, { color: colors.mutedForeground }]}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* ── Event header (always visible above tabs) ───────────────────── */}
          <View
            style={[
              styles.eventHeaderFixed,
              { borderBottomColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <View style={styles.eventTitleRow}>
              <Text
                style={[styles.eventTitle, { color: colors.foreground, flex: 1 }]}
                testID="event-detail-title"
              >
                {data.title}
              </Text>
              {data.isPrivate && (
                <View style={[styles.privateBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.privateBadgeText, { color: colors.mutedForeground }]}>Private</Text>
                </View>
              )}
            </View>
            {(data.restaurantName || data.destinationAddress) ? (
              <View style={{ gap: 2 }}>
                {data.restaurantName ? (
                  <Text style={[styles.eventRestaurant, { color: colors.mutedForeground }]}>
                    {data.restaurantName}
                  </Text>
                ) : null}
                {data.destinationAddress ? (
                  <Text style={[styles.destinationAddress, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {data.destinationAddress}
                  </Text>
                ) : null}
              </View>
            ) : data.destinationRequired === false ? (
              <View style={{ gap: 2 }}>
                {data.votingOpenedAt && data.votingDeadline && new Date(data.votingDeadline) <= new Date() ? (
                  isTied ? (
                    <View style={[styles.votingClosedBadge, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b" }]}>
                      <Text style={[styles.votingClosedBadgeText, { color: "#b45309" }]}>
                        {isHost ? "🤝 Tied — host picks" : "⏳ Waiting for host to decide"}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.votingClosedBadge}>
                      <Text style={styles.votingClosedBadgeText}>🔒 Voting closed</Text>
                    </View>
                  )
                ) : data.votingOpenedAt ? (
                  <Pressable
                    onPress={() => {
                      pendingScrollToVoting.current = true;
                      if (activeTab !== "overview") {
                        setActiveTab("overview");
                      } else {
                        pendingScrollToVoting.current = false;
                        overviewScrollRef.current?.scrollTo({ y: suggestionsSectionY.current, animated: true });
                        highlightSuggestionsAnim.value = withSequence(
                          withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }),
                          withTiming(0, { duration: 700, easing: Easing.in(Easing.ease) }),
                        );
                      }
                    }}
                    hitSlop={8}
                    testID="vote-badge-btn"
                  >
                    <View style={styles.venueTbdBadge}>
                      <Text style={styles.venueTbdBadgeText}>🗳️ Vote open</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.venueTbdBadge}>
                    <Text style={styles.venueTbdBadgeText}>📍 TBD</Text>
                  </View>
                )}
                {votingCountdown && votingCountdown !== "Voting closed" ? (
                  <Text style={styles.votingCountdownText}>{votingCountdown}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                {formatEventDate(data.startsAt, data.createdAt)}
              </Text>
              {!isCancelled && data.startsAt && new Date(data.startsAt) < new Date() && (
                <View style={[styles.completedBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.completedBadgeText, { color: colors.mutedForeground }]}>Completed</Text>
                </View>
              )}
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: isHost ? colors.primary : colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: isHost ? colors.primaryForeground : colors.foreground },
                  ]}
                  testID="role-badge"
                >
                  {roleBadgeLabel(data.role)}
                </Text>
              </View>
            </View>

            {/* RSVP count badge row — host only */}
            {isHost && (rsvpGoingCount + rsvpDeclinedCount + rsvpAwaitingCount) > 0 && (
              <View style={styles.rsvpCountRow} testID="rsvp-count-row">
                {rsvpGoingCount > 0 && (
                  <View style={styles.rsvpCountBadge}>
                    <Text style={[styles.rsvpCountDot, { color: "#16A34A" }]}>●</Text>
                    <Text style={[styles.rsvpCountText, { color: colors.mutedForeground }]}>
                      {rsvpGoingCount} accepted
                    </Text>
                  </View>
                )}
                {rsvpDeclinedCount > 0 && (
                  <View style={styles.rsvpCountBadge}>
                    <Text style={[styles.rsvpCountDot, { color: "#EF4444" }]}>●</Text>
                    <Text style={[styles.rsvpCountText, { color: colors.mutedForeground }]}>
                      {rsvpDeclinedCount} declined
                    </Text>
                  </View>
                )}
                {rsvpAwaitingCount > 0 && (
                  <View style={styles.rsvpCountBadge}>
                    <Text style={[styles.rsvpCountDot, { color: "#94A3B8" }]}>●</Text>
                    <Text style={[styles.rsvpCountText, { color: colors.mutedForeground }]}>
                      {rsvpAwaitingCount} awaiting
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Cancelled banner ──────────────────────────────────────────── */}
          {isCancelled && (
            <View style={styles.cancelledBanner} testID="cancelled-banner">
              <Text style={styles.cancelledBannerText}>
                {"Event cancelled"}
                {data.cancelledAt
                  ? ` · ${new Date(data.cancelledAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
                  : ""}
              </Text>
            </View>
          )}

          {/* ── Tab bar ───────────────────────────────────────────────────── */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tabItem,
                    isActive && { borderBottomColor: colors.primary },
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                  testID={`tab-${tab.key}`}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: isActive ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {tab.key === "chat" && chatHasNew && (
                      <View style={[styles.chatLiveDot, { backgroundColor: "#22C55E" }]} />
                    )}
                    {tab.key === "bill" && unassignedCount > 0 && (
                      <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.tabBadgeText}>{unassignedCount}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <ScrollView
              ref={overviewScrollRef}
              contentContainerStyle={[
                styles.tabContent,
                { paddingBottom: insets.bottom + 40 },
              ]}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />}
              testID="tab-content-overview"
            >
              {/* RSVP card (invited / declined) */}
              {(data.role === "invited" || data.role === "declined") && !isCancelled && (
                <View
                  style={[styles.rsvpCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  testID="rsvp-card"
                >
                  {data.role === "invited" && (
                    <>
                      <Text style={[styles.rsvpCardTitle, { color: colors.foreground }]}>
                        You've been invited
                      </Text>
                      <Text style={[styles.rsvpCardSubtitle, { color: colors.mutedForeground }]}>
                        Accept to join the event and access all details.
                      </Text>
                      <View style={styles.rsvpButtonRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.rsvpAcceptBtn,
                            { backgroundColor: colors.primary, opacity: pressed || isRsvpPending ? 0.75 : 1 },
                          ]}
                          onPress={() => handleRsvp("accept")}
                          disabled={isRsvpPending}
                          testID="rsvp-accept-btn"
                        >
                          {isRsvpPending ? (
                            <ActivityIndicator color={colors.primaryForeground} size="small" />
                          ) : (
                            <Text style={[styles.rsvpAcceptBtnText, { color: colors.primaryForeground }]}>
                              Accept
                            </Text>
                          )}
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.rsvpDeclineBtn,
                            { borderColor: colors.border, opacity: pressed || isRsvpPending ? 0.75 : 1 },
                          ]}
                          onPress={() => handleRsvp("decline")}
                          disabled={isRsvpPending}
                          testID="rsvp-decline-btn"
                        >
                          <Text style={[styles.rsvpDeclineBtnText, { color: colors.mutedForeground }]}>
                            Decline
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                  {data.role === "declined" && (
                    <>
                      <Text style={[styles.rsvpCardTitle, { color: colors.foreground }]}>
                        You declined this invite
                      </Text>
                      <Text style={[styles.rsvpCardSubtitle, { color: colors.mutedForeground }]}>
                        Changed your mind? You can still accept.
                      </Text>
                      <Pressable
                        style={({ pressed }) => [
                          styles.rsvpAcceptBtn,
                          { backgroundColor: colors.primary, opacity: pressed || isRsvpPending ? 0.75 : 1, alignSelf: "flex-start" },
                        ]}
                        onPress={() => handleRsvp("accept")}
                        disabled={isRsvpPending}
                        testID="rsvp-reaccept-btn"
                      >
                        {isRsvpPending ? (
                          <ActivityIndicator color={colors.primaryForeground} size="small" />
                        ) : (
                          <Text style={[styles.rsvpAcceptBtnText, { color: colors.primaryForeground }]}>
                            Accept Invite
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              {/* Change response (accepted users) */}
              {data.role === "accepted" && !isCancelled && (
                <Pressable
                  style={({ pressed }) => [
                    styles.changeResponseBtn,
                    { opacity: pressed || isRsvpPending ? 0.6 : 1 },
                  ]}
                  onPress={() => handleRsvp("decline")}
                  disabled={isRsvpPending}
                  testID="change-response-btn"
                >
                  <Text style={[styles.changeResponseText, { color: colors.mutedForeground }]}>
                    {isRsvpPending ? "Updating…" : "Change response → Decline"}
                  </Text>
                </Pressable>
              )}

              {/* ── Payment setup nudge (host, no payment methods yet) ── */}
              {isHost && !isCancelled && !(myProfile?.cashAppHandle || myProfile?.venmoHandle || hasValidZelle) && (
                <Pressable
                  style={({ pressed }) => [
                    styles.paymentNudgeCard,
                    { backgroundColor: colors.card, borderColor: "#f97316", opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => setShowRequestPaymentModal(true)}
                  testID="payment-setup-nudge"
                >
                  <Ionicons name="wallet-outline" size={20} color="#f97316" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentNudgeTitle, { color: colors.foreground }]}>
                      Add a payment method
                    </Text>
                    <Text style={[styles.paymentNudgeSubtitle, { color: colors.mutedForeground }]}>
                      Guests need somewhere to send money. Tap to set up Cash App, Venmo, or Zelle.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}

              {/* ── Venue Card ─────────────────────────────────────────── */}
              {!!data.destinationPlaceId && (
                <VenueCard placeId={data.destinationPlaceId} />
              )}

              {/* ── Venue Suggestions & Voting (destination-less events) ─ */}
              {!data.destinationRequired && !isCancelled && (() => {
                const suggestions = data.suggestions ?? [];
                const activeSuggestions = suggestions.filter((s) => !s.rescinded);
                const votingOpen = !!data.votingOpenedAt;
                const votingDeadlineStr = data.votingDeadline;
                const destinationDecided = !!data.destinationDecidedAt;
                const votingDeadline = votingDeadlineStr ? new Date(votingDeadlineStr) : null;
                const deadlinePassed = votingDeadline ? new Date() > votingDeadline : false;
                const myVoted = activeSuggestions.some((s) => s.myVote);
                const maxVotes = activeSuggestions.length > 0 ? Math.max(...activeSuggestions.map((s) => s.voteCount)) : 0;
                const leaders = activeSuggestions.filter((s) => s.voteCount === maxVotes);

                const handleRunDiscovery = async () => {
                  setDiscoveryLoading(true);
                  setDiscoveryError(null);
                  try {
                    let lat = discoveryDeviceCoords?.lat;
                    let lng = discoveryDeviceCoords?.lng;
                    // Try to get device location if no ZIP or coords yet
                    if (!discoveryZip && !lat) {
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === "granted") {
                          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                          lat = pos.coords.latitude;
                          lng = pos.coords.longitude;
                          setDiscoveryDeviceCoords({ lat, lng });
                        }
                      } catch { /* ignore, will fallback to error */ }
                    }
                    if (!discoveryZip && !lat) {
                      setDiscoveryError("Enter a ZIP code or allow location access to discover venues");
                      setDiscoveryLoading(false);
                      return;
                    }
                    const res = await discoverPlaces({
                      zip: discoveryZip || undefined,
                      lat,
                      lng,
                      cuisines: discoveryCuisines.length > 0 ? discoveryCuisines : undefined,
                      radius: discoveryRadius,
                    });
                    if (Array.isArray(res)) setDiscoveryResults(res as typeof discoveryResults);
                    else setDiscoveryError("No results found");
                  } catch {
                    setDiscoveryError("Discovery unavailable. Try again or enter a ZIP code.");
                  } finally {
                    setDiscoveryLoading(false);
                  }
                };

                const handleAddSuggestion = (place: { placeId: string; name: string; address: string; lat: number; lng: number; rating: number | null; photoUrl: string | null }) => {
                  addSuggestion(
                    { eventId, data: { placeId: place.placeId } },
                    { onSuccess: () => { refetch(); setShowDiscovery(false); setDiscoveryResults([]); }, onError: (e: unknown) => Alert.alert("Error", (e as { message?: string })?.message ?? "Could not add suggestion") },
                  );
                };

                const handleManualAddSuggestion = () => {
                  setManualEntryError(null);
                  if (!manualVenueName.trim()) { setManualEntryError("Venue name is required"); return; }
                  const trimmedName = manualVenueName.trim().toLowerCase();
                  const isDuplicate = suggestions.some(
                    (s) => s.placeId?.startsWith("manual-") && s.placeName?.toLowerCase() === trimmedName,
                  );
                  if (isDuplicate) { setManualEntryError("A venue with that name has already been suggested"); return; }
                  const manualPlaceId = "manual-" + Date.now().toString(36) + Math.random().toString(36).substring(2);
                  addSuggestion(
                    { eventId, data: { placeId: manualPlaceId, placeName: manualVenueName.trim(), placeAddress: manualVenueAddress.trim() || undefined } },
                    {
                      onSuccess: () => {
                        refetch();
                        setShowDiscovery(false);
                        setDiscoveryResults([]);
                        setShowManualEntry(false);
                        setManualVenueName("");
                        setManualVenueAddress("");
                        setManualEntryError(null);
                      },
                      onError: (e: unknown) => setManualEntryError((e as { message?: string })?.message ?? "Could not add suggestion"),
                    },
                  );
                };

                const handleVenueSearchChange = (text: string) => {
                  setVenueSearchQuery(text);
                  if (venueSearchTimerRef.current) clearTimeout(venueSearchTimerRef.current);
                  if (!text.trim()) { setVenueSearchResults([]); setVenueSearchLoading(false); return; }
                  setVenueSearchLoading(true);
                  venueSearchTimerRef.current = setTimeout(async () => {
                    try {
                      const bias = discoveryDeviceCoords ? `circle:5000@${discoveryDeviceCoords.lat},${discoveryDeviceCoords.lng}` : undefined;
                      const results = await searchPlaces(text.trim(), discoveryDeviceCoords?.lat, discoveryDeviceCoords?.lng, bias);
                      setVenueSearchResults(results ?? []);
                    } catch { setVenueSearchResults([]); }
                    finally { setVenueSearchLoading(false); }
                  }, 300);
                };

                const handleRescind = (suggestionId: number) => {
                  rescindSuggestion({ eventId, suggestionId }, { onSuccess: () => refetch(), onError: () => Alert.alert("Error", "Could not rescind suggestion") });
                };

                const handleVote = (suggestionId: number) => {
                  void Haptics.selectionAsync();
                  setVotingError(null);
                  voteOnSuggestion(
                    { eventId, suggestionId },
                    { onSuccess: () => refetch(), onError: (e: unknown) => setVotingError((e as { message?: string })?.message ?? "Could not vote") },
                  );
                };

                const handleOpenVoting = () => {
                  setVotingError(null);
                  openVoting(
                    { eventId, data: { durationHours: openVotingDuration } },
                    { onSuccess: () => { refetch(); setVotingError(null); }, onError: (e: unknown) => setVotingError((e as { message?: string })?.message ?? "Could not open voting") },
                  );
                };

                const handleCloseVoting = (tId?: number) => {
                  setVotingError(null);
                  closeVoting(
                    { eventId, data: tId != null ? { suggestionId: tId } : {} },
                    {
                      onSuccess: (result) => {
                        refetch();
                        if (result.status === "tied") {
                          setServerReportedTied(true);
                          setVotingError("It's a tie! Pick a tiebreaker below.");
                          setTiebreakerId(null);
                        } else {
                          setServerReportedTied(false);
                          setVotingError(null);
                          setTiebreakerId(null);
                        }
                      },
                      onError: (e: unknown) => setVotingError((e as { message?: string })?.message ?? "Could not close voting"),
                    },
                  );
                };

                const CUISINE_OPTIONS = [
                  { label: "American", emoji: "🍔", value: "american" },
                  { label: "Barbecue", emoji: "🔥", value: "barbecue" },
                  { label: "Chinese", emoji: "🥡", value: "chinese" },
                  { label: "French", emoji: "🥐", value: "french" },
                  { label: "Indian", emoji: "🍛", value: "indian" },
                  { label: "Italian", emoji: "🍝", value: "italian" },
                  { label: "Japanese", emoji: "🍱", value: "japanese" },
                  { label: "Mexican", emoji: "🌮", value: "mexican" },
                  { label: "Pizza", emoji: "🍕", value: "pizza" },
                  { label: "Seafood", emoji: "🦞", value: "seafood" },
                  { label: "Steak", emoji: "🥩", value: "steak" },
                  { label: "Sushi", emoji: "🍣", value: "sushi" },
                  { label: "Thai", emoji: "🌿", value: "thai" },
                ];

                return (
                  <View
                    style={[styles.suggestionsSection, { borderColor: colors.border }]}
                    onLayout={(e) => {
                      const y = e.nativeEvent.layout.y;
                      suggestionsSectionY.current = y;
                      if (pendingScrollToVoting.current) {
                        pendingScrollToVoting.current = false;
                        overviewScrollRef.current?.scrollTo({ y, animated: true });
                        setTimeout(() => {
                          highlightSuggestionsAnim.value = withSequence(
                            withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }),
                            withTiming(0, { duration: 700, easing: Easing.in(Easing.ease) }),
                          );
                        }, 350);
                      }
                    }}
                  >
                    <Animated.View style={suggestionHighlightStyle}>
                      <Text style={[styles.suggestionsSectionTitle, { color: colors.foreground }]}>
                        {destinationDecided ? "✅ Destination Decided" : votingOpen ? "🗳️ Voting Open" : "📍 Venue Suggestions"}
                      </Text>
                    </Animated.View>

                    {votingOpen && votingDeadline && (
                      <Text style={[styles.votingDeadlineText, { color: colors.mutedForeground }]}>
                        {deadlinePassed ? "⏰ Deadline passed" : `Deadline: ${votingDeadline.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                      </Text>
                    )}

                    {isTied && (
                      <View style={styles.tieBanner} testID="tie-banner">
                        {isHost ? (
                          <>
                            <Text style={styles.tieBannerTitle}>🤝 Voting closed — it's a tie!</Text>
                            <Text style={styles.tieBannerBody}>Pick a venue below to break the tie.</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.tieBannerTitle}>🤝 Voting closed — it's a tie!</Text>
                            <Text style={styles.tieBannerBody}>Waiting for the host to break the tie.</Text>
                          </>
                        )}
                      </View>
                    )}

                    {votingError && (
                      <Text style={[styles.votingError, { color: colors.destructive ?? "#ef4444" }]}>{votingError}</Text>
                    )}

                    {/* Suggestion cards */}
                    {activeSuggestions.length === 0 && !showDiscovery && (
                      <Text style={[styles.noSuggestionsText, { color: colors.mutedForeground }]}>
                        No suggestions yet — be the first to suggest a venue!
                      </Text>
                    )}

                    {(() => {
                      const sorted = isTied
                        ? [...activeSuggestions].sort((a, b) => {
                            const aL = leaders.some((l) => l.id === a.id) ? 0 : 1;
                            const bL = leaders.some((l) => l.id === b.id) ? 0 : 1;
                            return aL - bL;
                          })
                        : activeSuggestions;

                      return sorted.map((s, idx) => {
                        const isLeader = leaders.some((l) => l.id === s.id);
                        const isTiedLeader = isTied && isLeader;
                        const showDivider = isTied && idx > 0 && !isLeader && leaders.some((l) => l.id === sorted[idx - 1].id);

                        return (
                          <View key={s.id}>
                            {showDivider && (
                              <View style={styles.tiedDivider}>
                                <View style={[styles.tiedDividerLine, { backgroundColor: colors.border }]} />
                                <Text style={[styles.tiedDividerLabel, { color: colors.mutedForeground }]}>Other venues</Text>
                                <View style={[styles.tiedDividerLine, { backgroundColor: colors.border }]} />
                              </View>
                            )}
                            <View
                              style={[
                                styles.suggestionCard,
                                isTiedLeader
                                  ? styles.tiedLeaderCard
                                  : { borderColor: isLeader && votingOpen ? colors.primary : colors.border },
                                { backgroundColor: colors.card },
                              ]}
                              testID={`suggestion-card-${s.id}`}
                            >
                              {isTiedLeader && (
                                <View style={styles.tiedLeaderBadge}>
                                  <Text style={styles.tiedLeaderBadgeText}>🏅 Tied</Text>
                                </View>
                              )}
                              {s.photoUrl ? (
                                <Image source={{ uri: s.photoUrl }} style={styles.suggestionPhoto} contentFit="cover" />
                              ) : null}
                              <View style={styles.suggestionCardBody}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <Text style={[styles.suggestionName, { color: colors.foreground, flexShrink: 1 }]} numberOfLines={1}>{s.placeName}</Text>
                                  {s.placeId?.startsWith("manual-") && (
                                    <View style={[styles.customVenueBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                                      <Text style={[styles.customVenueBadgeText, { color: colors.mutedForeground }]}>Custom</Text>
                                    </View>
                                  )}
                                </View>
                                {s.placeAddress ? (
                                  <Text style={[styles.suggestionAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{s.placeAddress}</Text>
                                ) : null}
                                {s.rating != null ? (
                                  <Text style={[styles.suggestionRating, { color: colors.mutedForeground }]}>⭐ {s.rating.toFixed(1)}</Text>
                                ) : null}
                                <Text style={[styles.suggestionProposer, { color: colors.mutedForeground }]}>
                                  Suggested by {s.proposerUserId === myUserId ? "you" : s.proposerDisplayName}
                                </Text>
                              </View>
                              <View style={styles.suggestionActions}>
                                {votingOpen && !deadlinePassed && !myVoted && (
                                  <Pressable
                                    style={({ pressed }) => [styles.voteBtn, { backgroundColor: colors.primary, opacity: pressed || isVoting ? 0.7 : 1 }]}
                                    onPress={() => handleVote(s.id)}
                                    disabled={isVoting}
                                    testID={`vote-btn-${s.id}`}
                                  >
                                    <Text style={[styles.voteBtnText, { color: colors.primaryForeground }]}>
                                      👍 {s.voteCount}
                                    </Text>
                                  </Pressable>
                                )}
                                {(!votingOpen || deadlinePassed) && (
                                  <View style={[styles.voteCount, { backgroundColor: colors.secondary }]}>
                                    <Text style={[styles.voteCountText, { color: s.myVote ? colors.primary : colors.mutedForeground }]}>
                                      {s.myVote ? "👍" : "👍"} {s.voteCount}
                                    </Text>
                                  </View>
                                )}
                                {votingOpen && myVoted && (
                                  <View style={[styles.voteCount, { backgroundColor: colors.secondary }]}>
                                    <Text style={[styles.voteCountText, { color: s.myVote ? colors.primary : colors.mutedForeground }]}>
                                      {s.myVote ? "✅" : "👍"} {s.voteCount}
                                    </Text>
                                  </View>
                                )}
                                {!votingOpen && s.proposerUserId === myUserId && (
                                  <Pressable
                                    style={({ pressed }) => [styles.rescindBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                                    onPress={() => handleRescind(s.id)}
                                    testID={`rescind-btn-${s.id}`}
                                  >
                                    <Text style={[styles.rescindBtnText, { color: colors.destructive ?? "#ef4444" }]}>Remove</Text>
                                  </Pressable>
                                )}
                                {/* Tiebreaker pick for host — only on tied leaders */}
                                {isHost && isTied && isLeader && (
                                  <Pressable
                                    style={({ pressed }) => [
                                      styles.voteBtn,
                                      { backgroundColor: tiebreakerId === s.id ? "#d97706" : "#fef3c7", opacity: pressed ? 0.7 : 1 },
                                    ]}
                                    onPress={() => setTiebreakerId(s.id)}
                                  >
                                    <Text style={[styles.voteBtnText, { color: tiebreakerId === s.id ? "#fff" : "#92400e" }]}>
                                      {tiebreakerId === s.id ? "✓ Pick" : "Pick"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      });
                    })()}

                    {/* Tiebreaker confirm */}
                    {isHost && isTied && tiebreakerId != null && (
                      <Pressable
                        style={({ pressed }) => [styles.openVotingBtn, { backgroundColor: colors.primary, opacity: pressed || isClosingVoting ? 0.7 : 1 }]}
                        onPress={() => handleCloseVoting(tiebreakerId)}
                        disabled={isClosingVoting}
                      >
                        <Text style={[styles.openVotingBtnText, { color: colors.primaryForeground }]}>
                          {isClosingVoting ? "Deciding…" : "Confirm Tiebreaker"}
                        </Text>
                      </Pressable>
                    )}

                    {/* Host controls */}
                    {isHost && !votingOpen && !destinationDecided && (
                      <>
                        {activeSuggestions.length >= 2 && (
                          <View style={styles.openVotingRow}>
                            <View style={styles.durationToggle}>
                              {([24, 48] as const).map((h) => (
                                <Pressable
                                  key={h}
                                  style={[styles.durationBtn, { borderColor: openVotingDuration === h ? colors.primary : colors.border, backgroundColor: openVotingDuration === h ? colors.primary + "22" : colors.background }]}
                                  onPress={() => setOpenVotingDuration(h)}
                                >
                                  <Text style={[styles.durationBtnText, { color: openVotingDuration === h ? colors.primary : colors.mutedForeground }]}>{h}h</Text>
                                </Pressable>
                              ))}
                            </View>
                            <Pressable
                              style={({ pressed }) => [styles.openVotingBtn, { backgroundColor: colors.primary, opacity: pressed || isOpeningVoting ? 0.7 : 1, flex: 1 }]}
                              onPress={handleOpenVoting}
                              disabled={isOpeningVoting}
                              testID="open-voting-btn"
                            >
                              <Text style={[styles.openVotingBtnText, { color: colors.primaryForeground }]}>
                                {isOpeningVoting ? "Opening…" : "Open Vote"}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </>
                    )}

                    {/* Host close voting */}
                    {isHost && votingOpen && !destinationDecided && (deadlinePassed || activeSuggestions.length >= 1) && (
                      <Pressable
                        style={({ pressed }) => [styles.openVotingBtn, { backgroundColor: colors.foreground, opacity: pressed || isClosingVoting ? 0.7 : 1 }]}
                        onPress={() => handleCloseVoting()}
                        disabled={isClosingVoting}
                        testID="close-voting-btn"
                      >
                        <Text style={[styles.openVotingBtnText, { color: colors.background }]}>
                          {isClosingVoting ? "Deciding…" : "Decide Winner"}
                        </Text>
                      </Pressable>
                    )}

                    {/* Extend deadline (host) */}
                    {isHost && votingOpen && !destinationDecided && !deadlinePassed && (
                      <Pressable
                        style={({ pressed }) => [styles.extendDeadlineBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => extendDeadline({ eventId, data: { durationHours: 24 } }, { onSuccess: () => refetch() })}
                        testID="extend-deadline-btn"
                      >
                        <Text style={[styles.extendDeadlineBtnText, { color: colors.mutedForeground }]}>+24h</Text>
                      </Pressable>
                    )}

                    {/* Add suggestion (participants, no vote open) */}
                    {!votingOpen && !destinationDecided && activeSuggestions.length < 4 && (
                      <>
                        {!showDiscovery ? (
                          <Pressable
                            style={({ pressed }) => [styles.addSuggestionBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                            onPress={() => setShowDiscovery(true)}
                            testID="add-suggestion-btn"
                          >
                            <Text style={[styles.addSuggestionBtnText, { color: colors.primary }]}>＋ Suggest a venue</Text>
                          </Pressable>
                        ) : (
                          <View style={[styles.discoveryPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                            <Text style={[styles.discoveryTitle, { color: colors.foreground }]}>Discover Venues</Text>
                            <TextInput
                              style={[styles.discoveryZipInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={discoveryZip}
                              onChangeText={setDiscoveryZip}
                              placeholder="ZIP code (optional)"
                              placeholderTextColor={colors.mutedForeground}
                              keyboardType="numeric"
                              testID="discovery-zip-input"
                            />
                            <View style={[styles.cuisineGrid, { marginBottom: 8 }]}>
                              {CUISINE_OPTIONS.map(({ label, emoji, value }) => {
                                const selected = discoveryCuisines.includes(value);
                                return (
                                  <Pressable
                                    key={value}
                                    style={[styles.cuisineGridCell, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background }]}
                                    onPress={() => setDiscoveryCuisines((prev) => selected ? prev.filter((x) => x !== value) : [...prev, value])}
                                  >
                                    <Text style={styles.cuisineGridEmoji}>{emoji}</Text>
                                    <Text style={[styles.cuisineGridLabel, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <Text style={[styles.discoveryRadiusLabel, { color: colors.mutedForeground }]}>Search radius</Text>
                            <View style={styles.radiusChipsRow}>
                              {([805, 1609, 4828, 8047] as const).map((r) => {
                                const mi = Math.round(r / 1609.34 * 10) / 10;
                                const label = `${mi === Math.floor(mi) ? mi.toFixed(0) : mi.toFixed(1)}mi`;
                                const selected = discoveryRadius === r;
                                return (
                                  <Pressable
                                    key={r}
                                    style={[styles.cuisineChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "22" : colors.background }]}
                                    onPress={() => setDiscoveryRadius(r)}
                                  >
                                    <Text style={[styles.cuisineChipText, { color: selected ? colors.primary : colors.mutedForeground }]}>{label}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            <View style={styles.discoveryActions}>
                              <Pressable
                                style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => { setShowDiscovery(false); setDiscoveryResults([]); setDiscoveryError(null); }}
                              >
                                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, flex: 2, height: 40, opacity: pressed || discoveryLoading ? 0.7 : 1 }]}
                                onPress={handleRunDiscovery}
                                disabled={discoveryLoading}
                                testID="run-discovery-btn"
                              >
                                {discoveryLoading ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Search</Text>}
                              </Pressable>
                            </View>
                            {discoveryError && (
                              <Text style={[styles.votingError, { color: colors.destructive ?? "#ef4444" }]}>{discoveryError}</Text>
                            )}
                            {discoveryResults.map((place) => (
                              <Pressable
                                key={place.placeId}
                                style={({ pressed }) => [styles.discoveryResultCard, { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : colors.background }]}
                                onPress={() => handleAddSuggestion(place)}
                                disabled={isAddingSuggestion}
                                testID={`discovery-result-${place.placeId}`}
                              >
                                <View style={styles.discoveryResultBody}>
                                  <Text style={[styles.discoveryResultName, { color: colors.foreground }]} numberOfLines={1}>{place.name}</Text>
                                  <Text style={[styles.discoveryResultAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{place.address}</Text>
                                  {(place.rating != null || place.priceLevel) && (
                                    <Text style={[styles.discoveryResultMeta, { color: colors.mutedForeground }]}>
                                      {place.rating != null ? `⭐ ${place.rating.toFixed(1)}` : ""}
                                      {place.rating != null && place.priceLevel ? "  " : ""}
                                      {place.priceLevel ?? ""}
                                    </Text>
                                  )}
                                </View>
                                <Text style={[styles.discoveryResultAdd, { color: colors.primary }]}>Add</Text>
                              </Pressable>
                            ))}

                            {/* Venue search / manual entry */}
                            {!showManualEntry ? (
                              <View style={{ marginTop: 8 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
                                  <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>🔍</Text>
                                  <TextInput
                                    style={{ flex: 1, fontSize: 15, color: colors.foreground }}
                                    value={venueSearchQuery}
                                    onChangeText={handleVenueSearchChange}
                                    placeholder="Search for a place…"
                                    placeholderTextColor={colors.mutedForeground}
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    testID="venue-search-input"
                                  />
                                  {venueSearchLoading && <ActivityIndicator size="small" color={colors.mutedForeground} />}
                                  {venueSearchQuery.length > 0 && !venueSearchLoading && (
                                    <Pressable onPress={() => { setVenueSearchQuery(""); setVenueSearchResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                      <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>✕</Text>
                                    </Pressable>
                                  )}
                                </View>
                                {venueSearchResults.length > 0 && (
                                  <View style={{ marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
                                    {venueSearchResults.map((place, idx) => (
                                      <Pressable
                                        key={place.placeId}
                                        style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: pressed ? colors.secondary : colors.card, borderTopWidth: idx === 0 ? 0 : 1, borderColor: colors.border })}
                                        onPress={() => {
                                          handleAddSuggestion({ ...place, rating: null, photoUrl: null });
                                          setVenueSearchQuery("");
                                          setVenueSearchResults([]);
                                        }}
                                        disabled={isAddingSuggestion}
                                        testID={`venue-search-result-${idx}`}
                                      >
                                        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }} numberOfLines={1}>{place.name}</Text>
                                        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>{place.address}</Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                )}
                                <Pressable
                                  style={({ pressed }) => [styles.manualEntryToggle, { opacity: pressed ? 0.6 : 1 }]}
                                  onPress={() => { setShowManualEntry(true); setManualEntryError(null); setVenueSearchQuery(""); setVenueSearchResults([]); }}
                                  testID="manual-entry-toggle"
                                >
                                  <Text style={[styles.manualEntryToggleText, { color: colors.mutedForeground }]}>Can't find it? Add manually</Text>
                                </Pressable>
                              </View>
                            ) : (
                              <View style={[styles.manualEntryForm, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                <Text style={[styles.manualEntryFormTitle, { color: colors.foreground }]}>Add venue manually</Text>
                                <TextInput
                                  style={[styles.discoveryZipInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                                  value={manualVenueName}
                                  onChangeText={setManualVenueName}
                                  placeholder="Venue name *"
                                  placeholderTextColor={colors.mutedForeground}
                                  autoFocus
                                  testID="manual-venue-name-input"
                                />
                                <TextInput
                                  style={[styles.discoveryZipInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                                  value={manualVenueAddress}
                                  onChangeText={setManualVenueAddress}
                                  placeholder="Address (optional)"
                                  placeholderTextColor={colors.mutedForeground}
                                  testID="manual-venue-address-input"
                                />
                                {manualEntryError && (
                                  <Text style={[styles.votingError, { color: colors.destructive ?? "#ef4444" }]}>{manualEntryError}</Text>
                                )}
                                <View style={styles.discoveryActions}>
                                  <Pressable
                                    style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                                    onPress={() => { setShowManualEntry(false); setManualVenueName(""); setManualVenueAddress(""); setManualEntryError(null); }}
                                  >
                                    <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                                  </Pressable>
                                  <Pressable
                                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, flex: 2, height: 40, opacity: pressed || isAddingSuggestion ? 0.7 : 1 }]}
                                    onPress={handleManualAddSuggestion}
                                    disabled={isAddingSuggestion}
                                    testID="manual-entry-submit-btn"
                                  >
                                    {isAddingSuggestion ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Add Venue</Text>}
                                  </Pressable>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })()}

              {/* Participants */}
              {isHost && !isCancelled && (
                <View style={styles.participantsActionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.participantActionBtn,
                      { backgroundColor: colors.primary, opacity: pressed || isSharingLink ? 0.75 : 1 },
                    ]}
                    onPress={handleShareInvite}
                    disabled={isSharingLink}
                    testID="share-invite-link-btn"
                  >
                    {isSharingLink ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.inviteBtnText, { color: colors.primaryForeground }]}>Share Link</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.participantActionBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => { setAddGuestNameInput(""); setAddGuestError(null); setShowAddGuestModal(true); }}
                    testID="add-guest-btn"
                  >
                    <Text style={[styles.inviteBtnText, { color: colors.foreground }]}>+ Add Person</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.participantActionBtn,
                      { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => setShowInviteModal(true)}
                    testID="invite-friends-btn"
                  >
                    <Text style={[styles.inviteBtnText, { color: colors.foreground }]}>+ Invite</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.participantsSectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Participants
                </Text>
              </View>

              <View
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
                testID="participants-list"
              >
                {participants.map((p, idx) => {
                  const isGuest = p.role === "guest";
                  const canRemove = isHost && !isCancelled &&
                    p.role !== "host" &&
                    p.userId !== myUserId;
                  const badgeColor = roleBadgeColor(p.role);
                  const rowKey = isGuest ? `guest-${p.guestParticipantId}` : String(p.userId);
                  return (
                    <View
                      key={rowKey}
                      style={[
                        styles.participantRow,
                        idx < participants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                      testID={isGuest ? `participant-row-guest-${p.guestParticipantId}` : `participant-row-${p.userId}`}
                    >
                      <View style={[
                        styles.participantAvatar,
                        isGuest
                          ? { backgroundColor: avatarBg(pKey(p)), borderWidth: 1.5, borderStyle: "dashed" as const, borderColor: colors.mutedForeground + "80" }
                          : { backgroundColor: avatarBg(pKey(p)) },
                      ]}>
                        {!isGuest && p.avatarUrl ? (
                          <Image source={{ uri: p.avatarUrl }} style={styles.participantAvatarImg} contentFit="cover" />
                        ) : (
                          <Text style={styles.participantAvatarText}>{initials(p.displayName)}</Text>
                        )}
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={[styles.participantName, { color: colors.foreground }]} numberOfLines={1}>
                          {p.userId === myUserId ? "You" : p.displayName}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.participantHandle, { color: colors.mutedForeground }]}>
                            {isGuest ? "guest (no app account)" : `@${p.handle}`}
                          </Text>
                          {isGuest && p.cashAppHandle && (
                            <View style={{ backgroundColor: "#00d63220", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, color: "#00d632", fontWeight: "600" }}>$CA</Text>
                            </View>
                          )}
                          {isGuest && p.venmoHandle && (
                            <View style={{ backgroundColor: "#3d95ce20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, color: "#3d95ce", fontWeight: "600" }}>V</Text>
                            </View>
                          )}
                        </View>
                        {isHost && !!p.reminderSentAt && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
                            <Ionicons name="time-outline" size={10} color="#6366f1" />
                            <Text style={{ fontSize: 10, color: "#6366f1", fontWeight: "500" }}>Nudged</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: badgeColor + "22", borderColor: badgeColor + "55" }]}>
                        <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                          {roleBadgeLabel(p.role)}
                        </Text>
                      </View>
                      {canRemove && (
                        <Pressable
                          style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.5 : 1 }]}
                          onPress={() => handleRemoveParticipant(p.userId, p.displayName, p.role, p.guestParticipantId)}
                          testID={isGuest ? `remove-guest-${p.guestParticipantId}` : `remove-participant-${p.userId}`}
                        >
                          <Text style={[styles.removeBtnText, { color: colors.destructive ?? "#ef4444" }]}>×</Text>
                        </Pressable>
                      )}
                      {isHost && !isCancelled && (p.role === "invited" || p.role === "guest") && (() => {
                        const rKey = isGuest
                          ? `guest-${p.guestParticipantId}`
                          : String(p.userId);
                        const isSending = remindingKey === rKey;
                        const onCooldown = !!p.reminderSentAt &&
                          Date.now() - new Date(p.reminderSentAt).getTime() < 24 * 60 * 60 * 1000;
                        return (
                          <Pressable
                            style={({ pressed }) => [
                              styles.makeHostBtn,
                              {
                                borderColor: onCooldown ? colors.border + "55" : "#6366f1",
                                opacity: pressed || isSending || onCooldown ? 0.5 : 1,
                              },
                            ]}
                            onPress={() => handleRemindParticipant(p)}
                            disabled={isSending || onCooldown}
                            testID={isGuest
                              ? `remind-guest-${p.guestParticipantId}`
                              : `remind-participant-${p.userId}`}
                          >
                            {isSending ? (
                              <ActivityIndicator size="small" color="#6366f1" />
                            ) : (
                              <Text style={[styles.makeHostBtnText, { color: onCooldown ? colors.mutedForeground : "#6366f1" }]}>
                                {onCooldown ? "Reminded" : "Remind"}
                              </Text>
                            )}
                          </Pressable>
                        );
                      })()}
                      {isHost && !isCancelled && isGuest && p.guestParticipantId != null && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.makeHostBtn,
                            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                          ]}
                          onPress={() => openGuestPayInfoModal(p)}
                          testID={`guest-pay-info-btn-${p.guestParticipantId}`}
                        >
                          <Text style={[styles.makeHostBtnText, { color: colors.mutedForeground }]}>
                            {p.cashAppHandle || p.venmoHandle ? "Edit Pay Info" : "Set Pay Info"}
                          </Text>
                        </Pressable>
                      )}
                      {isHost && !isCancelled && p.userId !== myUserId &&
                        (p.role === "accepted" || p.role === "participant") && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.makeHostBtn,
                            {
                              borderColor: colors.border,
                              opacity: pressed || transferringTo === p.userId ? 0.6 : 1,
                            },
                          ]}
                          onPress={() => handleTransferHost(p.userId!, p.displayName)}
                          disabled={transferringTo !== null}
                          testID={`transfer-host-btn-${p.userId}`}
                        >
                          {transferringTo === p.userId ? (
                            <ActivityIndicator size="small" color={colors.mutedForeground} />
                          ) : (
                            <Text style={[styles.makeHostBtnText, { color: colors.mutedForeground }]}>
                              Make Host
                            </Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* ── Notification mute toggle ──────────────────────────── */}
              {!isCancelled && (
                <View style={[styles.notifMuteRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons
                    name={data.notificationsMuted ? "notifications-off-outline" : "notifications-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifMuteLabel, { color: colors.foreground }]}>Event notifications</Text>
                    <Text style={[styles.notifMuteHint, { color: colors.mutedForeground }]}>
                      {data.notificationsMuted ? "Muted — you won't be notified" : "On — you'll get updates for this event"}
                    </Text>
                  </View>
                  <Switch
                    value={!data.notificationsMuted}
                    onValueChange={(enabled) => {
                      updateNotifications(
                        { eventId, data: { muted: !enabled } },
                        { onSuccess: () => void refetch() },
                      );
                    }}
                    trackColor={{ false: colors.border, true: colors.primary + "80" }}
                    thumbColor={!data.notificationsMuted ? colors.primary : colors.mutedForeground}
                    testID="notifications-toggle"
                  />
                </View>
              )}

              {/* Cancel event — host only, active events only */}
              {isHost && !isCancelled && (
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelEventBtn,
                    { opacity: pressed || isCancellingEvent ? 0.65 : 1 },
                  ]}
                  onPress={handleCancelEvent}
                  disabled={isCancellingEvent}
                  testID="cancel-event-btn"
                >
                  {isCancellingEvent ? (
                    <ActivityIndicator color="#dc2626" size="small" />
                  ) : (
                    <Text style={styles.cancelEventBtnText}>Cancel Event</Text>
                  )}
                </Pressable>
              )}
            </ScrollView>
          )}

          {/* ══ CHAT TAB ══════════════════════════════════════════════════════ */}
          {activeTab === "chat" && (
            isLimited ? (
              <ScrollView
                contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
                testID="tab-content-chat"
              >
                <View
                  style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
                  testID="chat-notice"
                >
                  <View style={styles.chatNoticeBox}>
                    <Text style={[styles.chatNoticeText, { color: colors.mutedForeground }]}>
                      Accept the invite to join the chat.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.chatNoticeAcceptBtn,
                        { backgroundColor: colors.primary, opacity: pressed || isRsvpPending ? 0.75 : 1 },
                      ]}
                      onPress={() => handleRsvp("accept")}
                      disabled={isRsvpPending}
                      testID="chat-notice-accept-btn"
                    >
                      {isRsvpPending ? (
                        <ActivityIndicator color={colors.primaryForeground} size="small" />
                      ) : (
                        <Text style={[styles.chatNoticeAcceptBtnText, { color: colors.primaryForeground }]}>
                          Accept Invite
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.flex} testID="tab-content-chat">
                <ScrollView
                  ref={chatScrollRef}
                  style={styles.flex}
                  contentContainerStyle={[styles.tabContent, { paddingBottom: 8 }]}
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
                    testID="chat-messages-list"
                  >
                    {(chatMessages ?? []).length === 0 ? (
                      <View style={styles.chatEmptyBox}>
                        <Ionicons name="chatbubbles-outline" size={36} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
                        <Text style={[styles.chatEmptyText, { color: colors.foreground, fontWeight: "600", fontSize: 15, marginTop: 8, marginBottom: 2 }]}>No messages yet</Text>
                        <Text style={[styles.chatEmptyText, { color: colors.mutedForeground }]}>Be the first to say hello!</Text>
                      </View>
                    ) : (
                      (chatMessages ?? []).map((msg: ChatMessage, msgIndex: number) => {
                        const isMe = msg.userId === myUserId;
                        const prevMsg = msgIndex > 0 ? (chatMessages ?? [])[msgIndex - 1] : null;
                        const isGrouped = !!(prevMsg && prevMsg.userId === msg.userId);
                        const isCantPayMsg = !isMe && isHost && msg.body.includes("not able to pay via");
                        const isQuickReplyOpen = cantPayReplyMsgId === msg.id;
                        const QUICK_SUGGESTIONS = [
                          "Let's do cash 💵",
                          "I'll send you a different link",
                          "Let's sort it out in person",
                        ];
                        return (
                          <View
                            key={msg.id}
                            style={[styles.chatMessageRow, { justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "flex-start", paddingVertical: isGrouped ? 1 : 4 }]}
                            testID={`chat-message-${msg.id}`}
                          >
                            {!isMe && (
                              isGrouped ? (
                                <View style={{ width: 32, flexShrink: 0 }} />
                              ) : (
                                <View style={[styles.chatAvatar, { backgroundColor: avatarBg(msg.userId) }]}>
                                  {msg.avatarUrl ? (
                                    <Image
                                      source={{ uri: msg.avatarUrl }}
                                      style={styles.chatAvatarImg}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <Text style={styles.chatAvatarText}>{initials(msg.displayName)}</Text>
                                  )}
                                </View>
                              )
                            )}
                            <View style={[styles.chatBubbleWrapper, isCantPayMsg ? { maxWidth: "85%" } : undefined]}>
                              {!isMe && !isGrouped && (
                                <Text style={[styles.chatSenderLine, { color: colors.mutedForeground }]} numberOfLines={1}>
                                  {msg.displayName}{"  "}@{msg.handle}
                                </Text>
                              )}
                              <View
                                style={[
                                  styles.chatBubble,
                                  isMe
                                    ? { backgroundColor: colors.primary }
                                    : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                                ]}
                              >
                                <Text style={[styles.chatBubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
                                  {msg.body}
                                </Text>
                              </View>
                              <Text style={[styles.chatTimestampBelow, { color: colors.mutedForeground, textAlign: isMe ? "right" : "left" }]}>
                                {formatMessageTime(msg.createdAt)}
                              </Text>

                              {/* ── Host quick-reply affordance for "can't pay" messages ── */}
                              {isCantPayMsg && !isQuickReplyOpen && (
                                <Pressable
                                  onPress={() => { setCantPayReplyMsgId(msg.id); setCantPayReplyText(""); }}
                                  style={({ pressed }) => [styles.cantPayReplyBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                                  testID={`cant-pay-reply-btn-${msg.id}`}
                                >
                                  <Text style={[styles.cantPayReplyBtnText, { color: colors.mutedForeground }]}>↩ Reply</Text>
                                </Pressable>
                              )}

                              {isCantPayMsg && isQuickReplyOpen && (
                                <View
                                  style={[styles.cantPayReplyPanel, { borderColor: colors.border, backgroundColor: colors.card }]}
                                  testID={`cant-pay-reply-panel-${msg.id}`}
                                >
                                  <Text style={[styles.cantPayReplyPanelLabel, { color: colors.mutedForeground }]}>Quick replies</Text>
                                  <View style={styles.cantPaySuggestionRow}>
                                    {QUICK_SUGGESTIONS.map((suggestion) => (
                                      <Pressable
                                        key={suggestion}
                                        onPress={() => handleCantPayQuickReply(suggestion)}
                                        disabled={cantPayReplySending}
                                        style={({ pressed }) => [
                                          styles.cantPaySuggestionChip,
                                          { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || cantPayReplySending ? 0.6 : 1 },
                                        ]}
                                        testID={`cant-pay-suggestion-${suggestion}`}
                                      >
                                        <Text style={[styles.cantPaySuggestionText, { color: colors.foreground }]}>{suggestion}</Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                  <View style={[styles.cantPayReplyInputRow, { borderColor: colors.border }]}>
                                    <TextInput
                                      style={[styles.cantPayReplyInput, { color: colors.foreground }]}
                                      placeholder="Or type a custom reply…"
                                      placeholderTextColor={colors.mutedForeground}
                                      value={cantPayReplyText}
                                      onChangeText={setCantPayReplyText}
                                      maxLength={500}
                                      editable={!cantPayReplySending}
                                      returnKeyType="send"
                                      onSubmitEditing={() => handleCantPayQuickReply(cantPayReplyText)}
                                      testID="cant-pay-reply-input"
                                    />
                                    <Pressable
                                      onPress={() => handleCantPayQuickReply(cantPayReplyText)}
                                      disabled={cantPayReplySending || !cantPayReplyText.trim()}
                                      style={({ pressed }) => [
                                        styles.cantPayReplySendBtn,
                                        { backgroundColor: colors.primary, opacity: pressed || cantPayReplySending || !cantPayReplyText.trim() ? 0.5 : 1 },
                                      ]}
                                      testID="cant-pay-reply-send-btn"
                                    >
                                      {cantPayReplySending ? (
                                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                                      ) : (
                                        <Text style={[styles.cantPayReplySendBtnText, { color: colors.primaryForeground }]}>Send</Text>
                                      )}
                                    </Pressable>
                                  </View>
                                  <Pressable
                                    onPress={() => { setCantPayReplyMsgId(null); setCantPayReplyText(""); }}
                                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "center", paddingVertical: 4 })}
                                    testID="cant-pay-reply-cancel"
                                  >
                                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" }}>Cancel</Text>
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </ScrollView>

                {isCancelled ? (
                  <View
                    style={[
                      styles.chatClosedBar,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        marginHorizontal: 20,
                        marginBottom: insets.bottom + 12,
                      },
                    ]}
                    testID="chat-closed-notice"
                  >
                    <Text style={[styles.chatClosedText, { color: colors.mutedForeground }]}>
                      Chat is closed — this event has been cancelled.
                    </Text>
                  </View>
                ) : (
                  <>
                    {chatError ? (
                      <Text style={[styles.chatErrorText, { color: colors.destructive ?? "#ef4444", marginHorizontal: 20 }]}>
                        {chatError}
                      </Text>
                    ) : null}

                    <View
                      style={[
                        styles.chatInputRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          marginHorizontal: 20,
                          marginBottom: insets.bottom + 12,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.chatInput, { color: colors.foreground, borderColor: colors.border }]}
                        placeholder="Message…"
                        placeholderTextColor={colors.mutedForeground}
                        value={chatInput}
                        onChangeText={(t) => { setChatInput(t); setChatError(null); }}
                        maxLength={500}
                        returnKeyType="send"
                        onSubmitEditing={handleSendMessage}
                        editable={!isSendingMessage}
                        blurOnSubmit={false}
                        testID="chat-input"
                      />
                      <Pressable
                        style={({ pressed }) => [
                          styles.chatSendBtn,
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed || isSendingMessage || !chatInput.trim() ? 0.5 : 1,
                          },
                        ]}
                        onPress={handleSendMessage}
                        disabled={isSendingMessage || !chatInput.trim()}
                        testID="send-message-btn"
                      >
                        {isSendingMessage ? (
                          <ActivityIndicator color={colors.primaryForeground} size="small" />
                        ) : (
                          <Text style={[styles.chatSendBtnText, { color: colors.primaryForeground }]}>
                            Send
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )
          )}

          {/* ══ BILL TAB ══════════════════════════════════════════════════════ */}
          {activeTab === "bill" && (
            isLimited ? (
              <ScrollView
                contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
                testID="tab-content-bill"
              >
                <View
                  style={[styles.lockedCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                  testID="bill-locked-notice"
                >
                  <View style={[styles.lockedIconCircle, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={styles.lockedIconEmoji}>🔒</Text>
                  </View>
                  <Text style={[styles.lockedTitle, { color: colors.foreground }]}>Bill is locked</Text>
                  <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
                    Accept your invite to view the bill and claim items.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.rsvpAcceptBtn,
                      { backgroundColor: colors.primary, opacity: pressed || isRsvpPending ? 0.75 : 1 },
                    ]}
                    onPress={() => handleRsvp("accept")}
                    disabled={isRsvpPending}
                    testID="bill-locked-accept-btn"
                  >
                    {isRsvpPending ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <Text style={[styles.rsvpAcceptBtnText, { color: colors.primaryForeground }]}>
                        Accept Invite
                      </Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <ScrollView
                contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />}
                testID="tab-content-bill"
              >
                {/* ── 1. Receipt Photos ──────────────────────────────────────── */}
                <View style={styles.receiptPhotosSection}>
                  {photos.length > 0 && (
                    <View style={[styles.receiptStripCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.receiptStripLabel, { color: colors.mutedForeground }]}>Receipt</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.photoScroll}
                      >
                        {photos.map((photo, photoIdx) => (
                          <View key={photo.id} style={styles.photoThumbContainer}>
                            <View style={styles.photoThumbWrap}>
                              <Pressable
                                style={{ flex: 1 }}
                                onPress={() => {
                                  receiptTranslateY.value = 0;
                                  receiptScale.value = 1;
                                  receiptBgOpacity.value = 1;
                                  setCurrentReceiptViewerPage(photoIdx);
                                  setReceiptViewerIndex(photoIdx);
                                }}
                                testID={`bill-photo-view-${photo.id}`}
                              >
                                <Image
                                  source={{ uri: photo.signedImageUrl ?? undefined }}
                                  style={styles.photoThumbImage}
                                  contentFit="cover"
                                  testID={`bill-photo-thumbnail-${photo.id}`}
                                />
                              </Pressable>
                              {isHost && !isCancelled && (
                                <Pressable
                                  style={({ pressed }) => [styles.photoDeleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                                  onPress={() => handleDeletePhoto(photo.id)}
                                  testID={`bill-delete-photo-${photo.id}`}
                                >
                                  <Text style={styles.photoDeleteText}>×</Text>
                                </Pressable>
                              )}
                            </View>
                            {isHost && !isCancelled && (
                              <Pressable
                                style={({ pressed }) => [
                                  styles.scanPhotoBtn,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor: colors.background,
                                    opacity: pressed || scanningPhotoId !== null || ocrDraft !== null ? 0.5 : 1,
                                  },
                                ]}
                                onPress={() => handleScanPhoto(photo.id)}
                                disabled={scanningPhotoId !== null || ocrDraft !== null}
                                testID={`bill-scan-photo-${photo.id}`}
                              >
                                {scanningPhotoId === photo.id ? (
                                  <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                  <Text style={[styles.scanPhotoBtnText, { color: colors.primary }]}>Scan</Text>
                                )}
                              </Pressable>
                            )}
                          </View>
                        ))}
                        {isHost && !isCancelled && (
                          <Pressable
                            style={({ pressed }) => [
                              styles.addMoreTile,
                              { borderColor: colors.border, opacity: pressed || isUploadingPhoto ? 0.6 : 1 },
                            ]}
                            onPress={handlePickAndUpload}
                            disabled={isUploadingPhoto}
                            testID="bill-add-more-photo-btn"
                          >
                            {isUploadingPhoto ? (
                              <ActivityIndicator color={colors.primary} />
                            ) : (
                              <>
                                <Text style={[styles.addMoreTileIcon, { color: colors.mutedForeground }]}>+</Text>
                                <Text style={[styles.addMoreTileText, { color: colors.mutedForeground }]}>Add More</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </ScrollView>
                    </View>
                  )}

                  {(scanningPhotoId !== null || isScanInProgress) && (
                    <View style={[styles.scanProgressBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scanProgressText, { color: colors.mutedForeground }]}>
                          {scanningPhotoId !== null
                            ? (() => {
                                const photoIdx = photos.findIndex((p) => p.id === scanningPhotoId);
                                const label = photoIdx >= 0
                                  ? `Scanning photo ${photoIdx + 1} of ${photos.length}…`
                                  : "Scanning receipt and calculating totals…";
                                return label;
                              })()
                            : "Scan in progress…"}
                        </Text>
                        {scanStuckWarning && (
                          <Text style={[styles.scanProgressText, { color: "#b45309", marginTop: 2, fontSize: 12 }]}>
                            This is taking longer than usual. You can add items manually if needed.
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {scanErrorBanner !== null && (
                    <View style={[styles.scanErrorBanner, { backgroundColor: colors.card, borderColor: "#f87171" }]}>
                      <Ionicons name="alert-circle-outline" size={16} color="#ef4444" style={{ marginTop: 1 }} />
                      <Text style={[styles.scanErrorBannerText, { color: colors.foreground }]}>
                        {scanErrorBanner.message}
                      </Text>
                      <View style={styles.scanErrorBannerActions}>
                        {scanErrorBanner.onRetry && (
                          <Pressable
                            onPress={() => {
                              if (scanRetryTimerRef.current) { clearTimeout(scanRetryTimerRef.current); scanRetryTimerRef.current = null; scanRetryTimerStartRef.current = null; scanRetryPhotoIdRef.current = null; }
                              clearScanErrorBanner();
                              scanErrorBanner.onRetry!();
                            }}
                          >
                            <Text style={[styles.scanErrorBannerRetry, { color: colors.primary }]}>Try Again</Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => {
                            if (scanRetryTimerRef.current) { clearTimeout(scanRetryTimerRef.current); scanRetryTimerRef.current = null; scanRetryTimerStartRef.current = null; scanRetryPhotoIdRef.current = null; }
                            clearScanErrorBanner();
                          }}
                          accessibilityLabel="Dismiss scan error"
                          accessibilityRole="button"
                        >
                          <Ionicons name="close" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {photos.length === 0 ? (
                    isHost && !isCancelled ? (
                      <View style={[styles.emptyBillCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.emptyBillIconCircle, { backgroundColor: colors.primary + "18" }]}>
                          <Ionicons name="receipt-outline" size={28} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyBillTitle, { color: colors.foreground }]}>Start the bill</Text>
                        <Text style={[styles.emptyBillSubtitle, { color: colors.mutedForeground }]}>
                          Upload or scan a receipt to begin splitting items.
                        </Text>
                        <View style={styles.receiptPhotoUploadRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.receiptPhotoUploadBtn,
                              { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || isUploadingPhoto ? 0.65 : 1 },
                            ]}
                            onPress={handleTakePhoto}
                            disabled={isUploadingPhoto}
                            testID="bill-take-photo-btn"
                          >
                            <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>Take Photo</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.receiptPhotoUploadBtn,
                              { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || isUploadingPhoto ? 0.65 : 1 },
                            ]}
                            onPress={handlePickAndUpload}
                            disabled={isUploadingPhoto}
                            testID="bill-library-photo-btn"
                          >
                            <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>Choose from Library</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.emptyBillCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.emptyBillIconCircle, { backgroundColor: colors.primary + "18" }]}>
                          <Ionicons name="time-outline" size={28} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyBillTitle, { color: colors.foreground }]}>Receipt on the way</Text>
                        <Text style={[styles.emptyBillSubtitle, { color: colors.mutedForeground }]}>
                          The host will upload a receipt — you'll be able to claim items once it's ready.
                        </Text>
                      </View>
                    )
                  ) : (
                    isHost && !isCancelled ? (
                      <View style={{ gap: 6 }}>
                        <Text style={[styles.addReceiptHint, { color: colors.mutedForeground }]}>
                          Add another receipt photo to scan
                        </Text>
                        <View style={styles.receiptPhotoUploadRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.receiptPhotoUploadBtn,
                              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || isUploadingPhoto ? 0.65 : 1 },
                            ]}
                            onPress={handleTakePhoto}
                            disabled={isUploadingPhoto}
                            testID="bill-take-photo-btn"
                          >
                            <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>Take Photo</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [
                              styles.receiptPhotoUploadBtn,
                              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || isUploadingPhoto ? 0.65 : 1 },
                            ]}
                            onPress={handlePickAndUpload}
                            disabled={isUploadingPhoto}
                            testID="bill-library-photo-btn"
                          >
                            <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>Choose from Library</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null
                  )}
                </View>

                {/* ── Guest owed-amount card ─────────────────────────────────── */}
                {!isHost && !isCancelled && myPaymentRequest && (() => {
                  const pr = myPaymentRequest;
                  const amountDollars = (pr.amountCents / 100).toFixed(2);
                  const noteText = pr.note ?? data?.title ?? "";
                  const encodedNote = encodeURIComponent(noteText);
                  const pref = pr.hostPreferredPaymentMethod;
                  // Guest's own payment preference (used to surface their preferred method first)
                  const guestPref = (myProfile?.preferredPaymentMethod ?? null) as "cash_app" | "venmo" | "zelle" | null;

                  const hasCashApp = !!pr.hostCashAppHandle;
                  const hasVenmo = !!pr.hostVenmoHandle;
                  const hasZelle = isValidZelleInfo(pr.hostZelleInfo);
                  const zelleInfoUnavailable = !!pr.hostZelleInfo && !hasZelle;
                  const hasAnyMethod = hasCashApp || hasVenmo || hasZelle || zelleInfoUnavailable;

                  const handleCashApp = () => {
                    const cashtag = pr.hostCashAppHandle!;
                    const tag = cashtag.startsWith("$") ? cashtag : `$${cashtag}`;
                    const tagEncoded = encodeURIComponent(tag);
                    openWithFallback(
                      `cashapp://pay/${tagEncoded}?amount=${amountDollars}&note=${encodedNote}`,
                      `https://cash.app/${tagEncoded}`,
                    );
                  };

                  const handleVenmo = () => {
                    const handle = pr.hostVenmoHandle!;
                    const webParams = `recipients=${encodeURIComponent(handle)}&amount=${amountDollars}&note=${encodedNote}`;
                    openWithFallback(
                      `venmo://paycharge?txn=pay&${webParams}`,
                      `https://account.venmo.com/payment-link?${webParams}`,
                    );
                  };

                  const handleOpenZelle = async () => {
                    const parts = [`Send $${amountDollars} via Zelle to: ${pr.hostZelleInfo!}`];
                    if (noteText) parts.push(`Memo: ${noteText}`);
                    await Clipboard.setStringAsync(parts.join(" — "));
                    setZelleCopied(true);
                    if (zelleTimerRef.current) clearTimeout(zelleTimerRef.current);
                    zelleTimerRef.current = setTimeout(() => setZelleCopied(false), 2000);
                    try {
                      await Linking.openURL("zellepay://");
                      setZelleOpenFailed(false);
                    } catch {
                      setZelleOpenFailed(true);
                      setTimeout(() => setZelleOpenFailed(false), 5000);
                    }
                  };

                  const handleCantPayThisWay = () => {
                    if (cantPaySending || cantPaySent) return;
                    const methodNames: string[] = [];
                    if (hasCashApp) methodNames.push("Cash App");
                    if (hasVenmo) methodNames.push("Venmo");
                    if (hasZelle) methodNames.push("Zelle");
                    let methodStr: string;
                    if (methodNames.length === 0) methodStr = "this payment method";
                    else if (methodNames.length === 1) methodStr = methodNames[0];
                    else if (methodNames.length === 2) methodStr = `${methodNames[0]} or ${methodNames[1]}`;
                    else methodStr = `${methodNames.slice(0, -1).join(", ")}, or ${methodNames[methodNames.length - 1]}`;
                    const body = `Hey, I'm not able to pay via ${methodStr} — can we arrange another way?`;
                    setCantPaySending(true);
                    sendChatMessage(
                      { eventId, data: { body } },
                      {
                        onSuccess: () => {
                          setCantPaySending(false);
                          setCantPaySent(true);
                          void AsyncStorage.setItem(`cant_pay_${eventId}_${pr.id}`, "1");
                          refetchChat();
                        },
                        onError: () => {
                          setCantPaySending(false);
                        },
                      },
                    );
                  };

                  const handleCashPay = () => {
                    if (cashPaySending || cashPaySent) return;
                    setCashPaySending(true);
                    sendChatMessage(
                      { eventId, data: { body: "I'll pay you in cash 💵 — let me know when you've got it!" } },
                      {
                        onSuccess: () => {
                          setCashPaySending(false);
                          setCashPaySent(true);
                          void AsyncStorage.setItem(`cash_pay_${eventId}_${pr.id}`, "1");
                          refetchChat();
                        },
                        onError: () => {
                          setCashPaySending(false);
                        },
                      },
                    );
                  };

                  return (
                    <View
                      style={[styles.paymentOwedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      testID="guest-payment-card"
                    >
                      {/* Header */}
                      <View style={styles.paymentOwedCardHeader}>
                        <Text style={[styles.paymentOwedTitle, { color: colors.foreground }]}>
                          Payment Request
                        </Text>
                        <View
                          style={[
                            styles.paymentStatusBadge,
                            {
                              backgroundColor:
                                pr.status === "received"
                                  ? "#ccfbf1"
                                  : pr.status === "paid"
                                    ? "#dcfce7"
                                    : "#fef3c7",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.paymentStatusBadgeText,
                              {
                                color:
                                  pr.status === "received"
                                    ? "#0f766e"
                                    : pr.status === "paid"
                                      ? "#16a34a"
                                      : "#d97706",
                              },
                            ]}
                          >
                            {pr.status === "received"
                              ? "Received"
                              : pr.status === "paid"
                                ? "Awaiting Confirmation"
                                : "Requested"}
                          </Text>
                        </View>
                      </View>

                      {/* Amount */}
                      <Text style={[styles.paymentOwedAmount, { color: colors.foreground }]}>
                        You owe {formatCents(pr.amountCents)}
                      </Text>

                      {/* Note */}
                      {pr.note ? (
                        <Text style={[styles.paymentOwedNote, { color: colors.mutedForeground }]}>
                          {pr.note}
                        </Text>
                      ) : null}

                      {/* Payment methods (only while unpaid) */}
                      {pr.status === "requested" && (
                        <>
                          {hasAnyMethod && (
                            <View style={[styles.payMethodDivider, { backgroundColor: colors.border }]} />
                          )}

                          {/* Methods ordered by guest preference: guest's preferred first, others secondary */}
                          {(() => {
                            type MethodKey = "cash_app" | "venmo" | "zelle";
                            const ordered: MethodKey[] = [];
                            // Guest's preferred goes first — only if host actually has it configured
                            if (
                              (guestPref === "cash_app" && hasCashApp) ||
                              (guestPref === "venmo" && hasVenmo) ||
                              (guestPref === "zelle" && (hasZelle || zelleInfoUnavailable))
                            ) {
                              ordered.push(guestPref!);
                            }
                            if (!ordered.includes("cash_app") && hasCashApp) ordered.push("cash_app");
                            if (!ordered.includes("venmo") && hasVenmo) ordered.push("venmo");
                            if (!ordered.includes("zelle") && (hasZelle || zelleInfoUnavailable)) ordered.push("zelle");

                            const hasMultiple = ordered.length > 1;
                            const topIsGuestPref = ordered[0] === guestPref;

                            return ordered.map((method) => {
                              const isGuestPreferred =
                                method === guestPref &&
                                ((method === "cash_app" && hasCashApp) ||
                                  (method === "venmo" && hasVenmo) ||
                                  (method === "zelle" && hasZelle));
                              // Dim non-preferred methods when guest has a clear preferred one
                              const isSecondary = hasMultiple && topIsGuestPref && !isGuestPreferred;

                              if (method === "cash_app") {
                                return (
                                  <Pressable
                                    key="cash_app"
                                    style={({ pressed }) => [
                                      styles.payMethodBtn,
                                      {
                                        borderColor: isGuestPreferred ? colors.primary : colors.border,
                                        backgroundColor: colors.background,
                                        opacity: pressed ? 0.75 : isSecondary ? 0.6 : 1,
                                      },
                                    ]}
                                    onPress={handleCashApp}
                                    testID="cashapp-pay-button"
                                  >
                                    <Text style={styles.payMethodBtnEmoji}>💚</Text>
                                    <Text style={[styles.payMethodBtnLabel, { color: isSecondary ? colors.mutedForeground : colors.foreground }]}>
                                      Pay with Cash App
                                    </Text>
                                    {isGuestPreferred && (
                                      <View style={styles.guestPreferredBadge}>
                                        <Text style={styles.guestPreferredBadgeText}>Your preferred</Text>
                                      </View>
                                    )}
                                  </Pressable>
                                );
                              }

                              if (method === "venmo") {
                                return (
                                  <Pressable
                                    key="venmo"
                                    style={({ pressed }) => [
                                      styles.payMethodBtn,
                                      {
                                        borderColor: isGuestPreferred ? colors.primary : colors.border,
                                        backgroundColor: colors.background,
                                        opacity: pressed ? 0.75 : isSecondary ? 0.6 : 1,
                                      },
                                    ]}
                                    onPress={handleVenmo}
                                    testID="venmo-pay-button"
                                  >
                                    <Text style={styles.payMethodBtnEmoji}>💙</Text>
                                    <Text style={[styles.payMethodBtnLabel, { color: isSecondary ? colors.mutedForeground : colors.foreground }]}>
                                      Pay with Venmo
                                    </Text>
                                    {isGuestPreferred && (
                                      <View style={styles.guestPreferredBadge}>
                                        <Text style={styles.guestPreferredBadgeText}>Your preferred</Text>
                                      </View>
                                    )}
                                  </Pressable>
                                );
                              }

                              if (method === "zelle") {
                                if (hasZelle) {
                                  return (
                                    <View
                                      key="zelle"
                                      style={[
                                        styles.zellePanel,
                                        {
                                          borderColor: isGuestPreferred ? colors.primary : colors.border,
                                          backgroundColor: colors.background,
                                          opacity: isSecondary ? 0.6 : 1,
                                        },
                                      ]}
                                      testID="zelle-panel"
                                    >
                                      {/* Header */}
                                      <View style={styles.zellePanelHeader}>
                                        <Text style={styles.zellePanelEmoji}>🏦</Text>
                                        <Text style={[styles.zellePanelTitle, { color: colors.foreground }]}>
                                          Pay with Zelle
                                        </Text>
                                        {zelleCopied && (
                                          <View style={[styles.zelleCopiedBadge, { backgroundColor: "#d1fae5" }]}>
                                            <Text style={[styles.zelleCopiedBadgeText, { color: "#065f46" }]}>✓ Copied!</Text>
                                          </View>
                                        )}
                                        {isGuestPreferred && !zelleCopied && (
                                          <View style={styles.guestPreferredBadge}>
                                            <Text style={styles.guestPreferredBadgeText}>Your preferred</Text>
                                          </View>
                                        )}
                                      </View>

                                      {/* Open Zelle App button */}
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.zelleOpenBtn,
                                          { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                                        ]}
                                        onPress={handleOpenZelle}
                                        testID="zelle-open-app-btn"
                                      >
                                        <Ionicons name="arrow-forward-circle-outline" size={17} color="#fff" />
                                        <Text style={styles.zelleOpenBtnText}>
                                          {zelleCopied ? "Payment info copied — opening Zelle…" : "Open Zelle App"}
                                        </Text>
                                      </Pressable>

                                      {/* Fallback message when zellepay:// fails */}
                                      {zelleOpenFailed && (
                                        <View style={[styles.zelleFallbackMsg, { backgroundColor: "rgba(194,65,12,0.07)", borderColor: colors.primary }]}>
                                          <Text style={[styles.zelleFallbackMsgText, { color: colors.primary }]}>
                                            Payment info copied to clipboard — open Zelle in your banking app and paste into the "Send to" field.
                                          </Text>
                                        </View>
                                      )}

                                      {/* Recipient row */}
                                      <View style={styles.zelleRow}>
                                        <Text style={[styles.zelleRowLabel, { color: colors.mutedForeground }]}>
                                          Send to
                                        </Text>
                                        <Text style={[styles.zelleRowValue, { color: colors.foreground }]} numberOfLines={1}>
                                          {maskZelle(pr.hostZelleInfo!)}
                                        </Text>
                                        <Pressable
                                          style={({ pressed }) => [styles.copyBtn, { opacity: pressed ? 0.6 : 1 }]}
                                          onPress={() => handleCopyZelle("recipient", pr.hostZelleInfo!)}
                                          testID="zelle-copy-recipient"
                                        >
                                          <Text style={[styles.copyBtnText, { color: colors.primary }]}>
                                            {copiedField === "recipient" ? "Copied!" : "Copy"}
                                          </Text>
                                        </Pressable>
                                      </View>

                                      {/* Amount row */}
                                      <View style={styles.zelleRow}>
                                        <Text style={[styles.zelleRowLabel, { color: colors.mutedForeground }]}>
                                          Amount
                                        </Text>
                                        <Text style={[styles.zelleRowValue, { color: colors.foreground }]}>
                                          ${amountDollars}
                                        </Text>
                                        <Pressable
                                          style={({ pressed }) => [styles.copyBtn, { opacity: pressed ? 0.6 : 1 }]}
                                          onPress={() => handleCopyZelle("amount", amountDollars)}
                                          testID="zelle-copy-amount"
                                        >
                                          <Text style={[styles.copyBtnText, { color: colors.primary }]}>
                                            {copiedField === "amount" ? "Copied!" : "Copy"}
                                          </Text>
                                        </Pressable>
                                      </View>

                                      {/* Memo row */}
                                      {noteText ? (
                                        <View style={styles.zelleRow}>
                                          <Text style={[styles.zelleRowLabel, { color: colors.mutedForeground }]}>
                                            Memo
                                          </Text>
                                          <Text style={[styles.zelleRowValue, { color: colors.foreground }]} numberOfLines={2}>
                                            {noteText}
                                          </Text>
                                          <Pressable
                                            style={({ pressed }) => [styles.copyBtn, { opacity: pressed ? 0.6 : 1 }]}
                                            onPress={() => handleCopyZelle("memo", noteText)}
                                            testID="zelle-copy-memo"
                                          >
                                            <Text style={[styles.copyBtnText, { color: colors.primary }]}>
                                              {copiedField === "memo" ? "Copied!" : "Copy"}
                                            </Text>
                                          </Pressable>
                                        </View>
                                      ) : null}

                                      {/* Copy all button */}
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.zelleCopyAllBtn,
                                          {
                                            backgroundColor: copiedField === "all" ? colors.primary : colors.card,
                                            borderColor: copiedField === "all" ? colors.primary : colors.border,
                                            opacity: pressed ? 0.75 : 1,
                                          },
                                        ]}
                                        onPress={() => {
                                          const parts = [`Send $${amountDollars} via Zelle to: ${pr.hostZelleInfo}`];
                                          if (noteText) parts.push(`Memo: ${noteText}`);
                                          handleCopyZelle("all", parts.join(" — "));
                                        }}
                                        testID="zelle-copy-all"
                                      >
                                        <Ionicons
                                          name={copiedField === "all" ? "checkmark" : "copy-outline"}
                                          size={15}
                                          color={copiedField === "all" ? "#fff" : colors.primary}
                                        />
                                        <Text style={[
                                          styles.zelleCopyAllText,
                                          { color: copiedField === "all" ? "#fff" : colors.primary },
                                        ]}>
                                          {copiedField === "all" ? "Copied!" : "Copy all payment info"}
                                        </Text>
                                      </Pressable>

                                      {/* Bank app callout */}
                                      <View style={[styles.zelleBankCallout, { backgroundColor: "rgba(148,163,184,0.07)", borderColor: colors.border }]}>
                                        <Text style={[styles.zelleBankCalloutTitle, { color: colors.mutedForeground }]}>
                                          🏛 Zelle is built into most major bank apps
                                        </Text>
                                        <Text style={[styles.zelleBankCalloutList, { color: colors.mutedForeground }]}>
                                          Chase · Bank of America · Wells Fargo · Citi · US Bank · and more
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                }

                                // Zelle info on file but unreadable
                                return (
                                  <View
                                    key="zelle-unavailable"
                                    style={[styles.zellePanel, { borderColor: colors.border, backgroundColor: colors.background }]}
                                    testID="zelle-unavailable-panel"
                                  >
                                    <View style={styles.zellePanelHeader}>
                                      <Text style={styles.zellePanelEmoji}>🏦</Text>
                                      <Text style={[styles.zellePanelTitle, { color: colors.foreground }]}>
                                        Pay with Zelle
                                      </Text>
                                    </View>
                                    <Text style={[styles.zelleRowLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
                                      Payment info unavailable — contact the host
                                    </Text>
                                  </View>
                                );
                              }

                              return null;
                            });
                          })()}

                          {/* No methods configured */}
                          {!hasAnyMethod && (
                            <Text style={[styles.noMethodsText, { color: colors.mutedForeground }]}>
                              The host hasn't added payment info yet.
                            </Text>
                          )}

                          <View style={[styles.payMethodDivider, { backgroundColor: colors.border }]} />

                          {/* Trust & privacy reassurance */}
                          <Text style={[styles.trustReassuranceText, { color: colors.mutedForeground }]}>
                            Invite never handles your money directly. Payments happen through Venmo, Cash App, or Zelle.
                          </Text>
                          <Text style={[styles.trustReassuranceText, { color: colors.mutedForeground }]}>
                            Only event participants can view this bill and payment status.
                          </Text>

                          {/* Pay with cash */}
                          {cashPaySent ? (
                            <Text
                              style={{ color: "#16a34a", fontSize: 13, textAlign: "center", marginTop: 2 }}
                              testID="cash-pay-sent-confirmation"
                            >
                              ✓ Cash payment arranged — host will confirm
                            </Text>
                          ) : !cantPaySent ? (
                            <Pressable
                              onPress={handleCashPay}
                              disabled={cashPaySending}
                              testID="pay-cash-button"
                              style={({ pressed }) => [
                                styles.cashPayBtn,
                                { borderColor: colors.border, opacity: pressed || cashPaySending ? 0.7 : 1 },
                              ]}
                            >
                              <Text style={[styles.cashPayBtnText, { color: colors.foreground }]}>
                                {cashPaySending ? "Sending…" : "💵  Pay with cash"}
                              </Text>
                            </Pressable>
                          ) : null}

                          {/* Can't pay this way */}
                          {cantPaySent ? (
                            <Text
                              style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", marginTop: 2 }}
                              testID="cant-pay-sent-confirmation"
                            >
                              ✓ Message sent to host
                            </Text>
                          ) : !cashPaySent ? (
                            <Pressable
                              onPress={handleCantPayThisWay}
                              disabled={cantPaySending}
                              testID="cant-pay-link"
                              style={({ pressed }) => ({ opacity: pressed || cantPaySending ? 0.55 : 1, alignItems: "center", marginTop: 2 })}
                            >
                              <Text style={{ color: colors.mutedForeground, fontSize: 13, textDecorationLine: "underline" }}>
                                {cantPaySending ? "Sending…" : "Can't pay this way?"}
                              </Text>
                            </Pressable>
                          ) : null}

                          {/* I Paid */}
                          <Pressable
                            style={({ pressed }) => [
                              styles.iPaidBtn,
                              { backgroundColor: colors.primary, opacity: pressed || markingPaidId === pr.id ? 0.8 : 1 },
                            ]}
                            onPress={() => handleMarkPaid(pr.id)}
                            disabled={markingPaidId === pr.id}
                            testID="i-paid-button"
                          >
                            {markingPaidId === pr.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={[styles.iPaidBtnText, { color: colors.primaryForeground }]}>
                                I Paid
                              </Text>
                            )}
                          </Pressable>
                          {iPaidError && markingPaidId !== pr.id && (
                            <Text style={[styles.inlineErrorText, { color: colors.destructive ?? "#ef4444" }]} testID="i-paid-error">
                              {iPaidError}
                            </Text>
                          )}
                        </>
                      )}

                      {pr.status === "paid" && (
                        <Text style={[styles.paymentMarkedPaidText, { color: "#d97706" }]}>
                          Marked as paid — waiting for host confirmation
                        </Text>
                      )}

                      {pr.status === "received" && (
                        <View style={[styles.guestSettledCard, { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }]} testID="guest-settled-card">
                          <Ionicons name="checkmark-circle" size={22} color="#059669" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.guestSettledTitle, { color: "#065f46" }]}>Payment confirmed ✓</Text>
                            <Text style={[styles.guestSettledSub, { color: "#047857" }]}>
                              Your host confirmed receipt of {formatCents(pr.amountCents)}. You're all done!
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* ── 2. Line Items ──────────────────────────────────────────── */}
                {!receipt ? (
                  isHost && !isCancelled ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.createReceiptBtn,
                        { backgroundColor: colors.primary, opacity: pressed || isCreatingReceipt ? 0.75 : 1 },
                      ]}
                      onPress={handleCreateReceipt}
                      disabled={isCreatingReceipt}
                      testID="create-receipt-btn"
                    >
                      {isCreatingReceipt ? (
                        <ActivityIndicator color={colors.primaryForeground} />
                      ) : (
                        <Text style={[styles.createReceiptText, { color: colors.primaryForeground }]}>
                          Start Receipt
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                        No receipt yet. The host is setting up the bill.
                      </Text>
                    </View>
                  )
                ) : (
                  <>
                    {items.length === 0 ? (
                      <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                          {isHost
                            ? "No items yet. Add items using the tool below."
                            : "No items yet. The host will add items to split."}
                        </Text>
                      </View>
                    ) : (
                      <View testID="receipt-items-list" style={{ gap: 12 }}>
                        {!isCancelled && (
                          <View style={[styles.assignHintPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
                            <Text style={[styles.itemsAssignHint, { color: colors.mutedForeground }]}>
                              {isSelectMode
                                ? "Tap items to select, then use the toolbar below."
                                : isHost
                                ? "Tap names to assign. Long press an item to bulk select."
                                : "Tap your name on each item you had. Multiple people can select the same item to split it."}
                            </Text>
                          </View>
                        )}
                        {items.map((item) => {
                          const claimers = activeClaimersFor(item.id);
                          const itemTotalCents = Math.round(parseFloat(item.price) * item.quantity * 100);
                          const perPersonCents = claimers.length > 1 ? Math.round(itemTotalCents / claimers.length) : 0;
                          const isThisItemLoading = claimingItemId === item.id;
                          const isItemSelected = selectedItemIds.has(item.id);

                          return (
                            <Pressable
                              key={item.id}
                              style={({ pressed }) => [
                                styles.itemCard,
                                { borderColor: isSelectMode && isItemSelected ? colors.primary : colors.border, backgroundColor: colors.card },
                                isSelectMode && isItemSelected && { backgroundColor: colors.primary + "08" },
                                isSelectMode && pressed && isHost && !isCancelled && { opacity: 0.7 },
                              ]}
                              onLongPress={isHost && !isCancelled && !isSelectMode ? () => enterSelectMode(item.id) : undefined}
                              onPress={isSelectMode && isHost && !isCancelled ? () => toggleItemSelected(item.id) : undefined}
                              testID={`item-row-${item.id}`}
                            >
                              {/* Top: name + price */}
                              <View style={styles.itemCardTop}>
                                {isHost && !isCancelled && isSelectMode && (
                                  <View style={[styles.selectCircle, { borderColor: isItemSelected ? colors.primary : colors.border, backgroundColor: isItemSelected ? colors.primary : "transparent" }]}>
                                    {isItemSelected && <Text style={styles.selectCheckmark}>✓</Text>}
                                  </View>
                                )}
                                <View style={styles.itemCardNameCol}>
                                  <Text
                                    style={[styles.itemCardName, { color: colors.foreground }]}
                                    numberOfLines={2}
                                    testID={`item-name-${item.id}`}
                                  >
                                    {item.name}
                                  </Text>
                                  {perPersonCents > 0 && (
                                    <Text style={[styles.itemCardSplit, { color: colors.primary }]}>
                                      {formatCents(perPersonCents)} / person
                                    </Text>
                                  )}
                                </View>
                                <View style={styles.itemCardPriceCol}>
                                  <Text
                                    style={[styles.itemCardPrice, { color: colors.foreground }]}
                                    testID={`item-price-${item.id}`}
                                  >
                                    {formatCents(itemTotalCents)}
                                  </Text>
                                  {item.quantity > 1 && (
                                    <Text style={[styles.itemCardQtyBreakdown, { color: colors.mutedForeground }]}>
                                      {item.quantity} × {formatCents(Math.round(parseFloat(item.price) * 100))}
                                    </Text>
                                  )}
                                  {isHost && !isCancelled && !isSelectMode && (
                                    <Pressable
                                      style={({ pressed }) => [styles.itemCardMoreBtn, { opacity: pressed ? 0.5 : 1 }]}
                                      onPress={() => setAssigningItemId(item.id)}
                                      testID={`item-more-${item.id}`}
                                    >
                                      <Text style={[styles.itemCardMoreText, { color: colors.mutedForeground }]}>···</Text>
                                    </Pressable>
                                  )}
                                </View>
                              </View>

                              {/* Chips: horizontally scrollable, all participants */}
                              {activeParticipants.length > 0 && !isSelectMode && (
                                <View style={[styles.itemCardChipsSection, { borderTopColor: colors.border }]}>
                                  <Text style={[styles.assignToLabel, { color: colors.mutedForeground }]}>Split with</Text>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.chipsScrollContent}
                                    testID={`claimers-${item.id}`}
                                  >
                                    {activeParticipants.map((p) => {
                                      const pk = pKey(p);
                                      const isAssigned = claimers.some((c) => aKey(c) === pk);
                                      const isMe = p.userId === myUserId;
                                      const isGuest = p.role === "guest";
                                      const canInteract = (isHost || isMe) && !isCancelled;
                                      const isLoadingMe = isMe && isThisItemLoading;
                                      const isLoadingOther = !isMe && togglingUserId === pk;
                                      const isLoading = isLoadingMe || isLoadingOther;

                                      return (
                                        <Pressable
                                          key={pk}
                                          style={({ pressed }) => [
                                            styles.participantChip,
                                            isAssigned
                                              ? { borderColor: colors.primary + "B3", backgroundColor: colors.primary + "0f" }
                                              : { borderColor: colors.border, backgroundColor: colors.background },
                                            isGuest && !isAssigned && { borderStyle: "dashed" as const },
                                            !canInteract && { opacity: 0.45 },
                                            pressed && canInteract && !isLoading && { opacity: 0.65 },
                                          ]}
                                          onPress={() => {
                                            if (!canInteract || isLoading) return;
                                            if (isMe) handleToggleClaim(item.id);
                                            else if (isHost) handleHostAssign(item.id, pk, !isAssigned);
                                          }}
                                          disabled={!canInteract || isLoading}
                                          testID={isMe ? `claim-btn-${item.id}` : undefined}
                                        >
                                          <View style={styles.chipAvatarWrapper}>
                                            <View style={[styles.chipAvatar, { backgroundColor: avatarBg(pk) }]}>
                                              {isLoading ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                              ) : (
                                                <Text style={styles.chipAvatarText}>{initials(p.displayName)}</Text>
                                              )}
                                            </View>
                                            {isAssigned && !isLoading && (
                                              <View style={[styles.chipCheckBadge, { backgroundColor: colors.primary + "D9", borderColor: colors.card }]}>
                                                <Text style={styles.chipCheckText}>✓</Text>
                                              </View>
                                            )}
                                          </View>
                                          <Text
                                            style={[
                                              styles.chipName,
                                              {
                                                color: isAssigned ? colors.primary : colors.mutedForeground,
                                                fontFamily: isAssigned ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular",
                                              },
                                            ]}
                                            numberOfLines={1}
                                            testID={isMe ? `claim-btn-label-${item.id}` : undefined}
                                          >
                                            {isMe ? "You" : firstName(p.displayName)}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </ScrollView>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                        {/* ── 2b. Bulk action bar ─────────────────────────────── */}
                        {isHost && !isCancelled && isSelectMode && (
                          <View style={[styles.bulkBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.bulkBarHeader}>
                              <Text style={[styles.bulkBarCount, { color: colors.foreground }]}>
                                {selectedItemIds.size} {selectedItemIds.size === 1 ? "item" : "items"} selected
                              </Text>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <Pressable
                                  style={({ pressed }) => [styles.bulkBarPill, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                                  onPress={() => setSelectedItemIds(new Set(items.map((i) => i.id)))}
                                  testID="bulk-select-all"
                                >
                                  <Text style={[styles.bulkBarPillText, { color: colors.foreground }]}>Select All</Text>
                                </Pressable>
                                <Pressable
                                  style={({ pressed }) => [styles.bulkBarPill, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                                  onPress={exitSelectMode}
                                  testID="bulk-cancel"
                                >
                                  <Text style={[styles.bulkBarPillText, { color: colors.mutedForeground }]}>Cancel</Text>
                                </Pressable>
                              </View>
                            </View>
                            <View style={styles.bulkBarActions}>
                              <Pressable
                                style={({ pressed }) => [styles.bulkActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed || isBulkPending || selectedItemIds.size === 0 ? 0.5 : 1 }]}
                                onPress={handleBulkSplit}
                                disabled={isBulkPending || selectedItemIds.size === 0}
                                testID="bulk-split-btn"
                              >
                                <Text style={[styles.bulkActionBtnText, { color: colors.primaryForeground }]}>Split with people</Text>
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.bulkActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed || isBulkPending || selectedItemIds.size === 0 ? 0.5 : 1 }]}
                                onPress={() => handleBulkAction("assign_to_me")}
                                disabled={isBulkPending || selectedItemIds.size === 0}
                                testID="bulk-assign-me-btn"
                              >
                                {isBulkPending
                                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                                  : <Text style={[styles.bulkActionBtnText, { color: colors.primaryForeground }]}>Assign to me</Text>}
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.bulkActionBtn, { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || isBulkPending || selectedItemIds.size === 0 ? 0.5 : 1 }]}
                                onPress={() => handleBulkAction("clear")}
                                disabled={isBulkPending || selectedItemIds.size === 0}
                                testID="bulk-clear-btn"
                              >
                                {isBulkPending
                                  ? <ActivityIndicator size="small" color={colors.foreground} />
                                  : <Text style={[styles.bulkActionBtnText, { color: colors.foreground }]}>Clear</Text>}
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.bulkActionBtn, { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed || isBulkPending ? 0.5 : 1 }]}
                                onPress={() => handleBulkAction("assign_unclaimed_to_me")}
                                disabled={isBulkPending}
                                testID="bulk-unclaimed-btn"
                              >
                                {isBulkPending
                                  ? <ActivityIndicator size="small" color={colors.foreground} />
                                  : <Text style={[styles.bulkActionBtnText, { color: colors.foreground }]}>All unclaimed → me</Text>}
                              </Pressable>
                            </View>
                            {bulkError && (
                              <Text style={[styles.bulkErrorText, { color: colors.destructive }]}>{bulkError}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    {/* ── 3. Tip Selector (host only) ────────────────────────── */}
                    {items.length > 0 && isHost && !isCancelled && (
                      <View style={[styles.tipSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.tipSectionLabel, { color: colors.foreground }]}>Tip</Text>
                        <View style={styles.tipButtonRow}>
                          {(["15", "18", "20"] as const).map((pct) => (
                            <Pressable
                              key={pct}
                              style={[
                                styles.tipButton,
                                { borderColor: tipMode === pct ? colors.primary : colors.border },
                                tipMode === pct && { backgroundColor: colors.primary },
                              ]}
                              onPress={() => handleSelectTipPercent(pct)}
                              disabled={isSavingTotals}
                            >
                              <Text style={[styles.tipButtonText, { color: tipMode === pct ? colors.primaryForeground : colors.foreground }]}>
                                {pct}%
                              </Text>
                            </Pressable>
                          ))}
                          <Pressable
                            style={[
                              styles.tipButton,
                              { borderColor: tipMode === "custom" ? colors.primary : colors.border },
                              tipMode === "custom" && { backgroundColor: colors.primary },
                            ]}
                            onPress={() => setTipMode("custom")}
                          >
                            <Text style={[styles.tipButtonText, { color: tipMode === "custom" ? colors.primaryForeground : colors.foreground }]}>
                              Custom
                            </Text>
                          </Pressable>
                        </View>
                        {tipMode === "custom" && (
                          <View style={styles.tipCustomRow}>
                            <Text style={[styles.tipCustomPrefix, { color: colors.foreground }]}>$</Text>
                            <TextInput
                              style={[styles.tipCustomInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={tipInput}
                              onChangeText={setTipInput}
                              placeholder="0.00"
                              placeholderTextColor={colors.mutedForeground}
                              keyboardType="decimal-pad"
                              returnKeyType="done"
                              onSubmitEditing={() => Keyboard.dismiss()}
                              testID="tip-custom-input"
                            />
                            <Pressable
                              style={[styles.tipSaveBtn, { backgroundColor: colors.primary, opacity: isSavingTotals ? 0.65 : 1 }]}
                              onPress={handleSaveTotals}
                              disabled={isSavingTotals}
                              testID="save-tip-btn"
                            >
                              {isSavingTotals ? (
                                <ActivityIndicator size="small" color={colors.primaryForeground} />
                              ) : (
                                <Text style={[styles.tipSaveBtnText, { color: colors.primaryForeground }]}>Save</Text>
                              )}
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}

                    {/* ── 4. Totals Card ─────────────────────────────────────── */}
                    {items.length > 0 && (
                      <View
                        style={[styles.totalsCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                        testID="participant-totals"
                      >
                        <View style={[styles.totalsCardTitleRow, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.totalsCardTitle, { color: colors.foreground }]}>Totals</Text>
                        </View>
                        <View style={styles.totalsCardBody}>
                          <View style={styles.totalsLeftCol}>
                            <View style={styles.totalsLineRow}>
                              <Text style={[styles.totalsLineLabel, { color: colors.mutedForeground }]}>Items Subtotal</Text>
                              <Text style={[styles.totalsLineValue, { color: colors.mutedForeground }]} testID="items-subtotal">
                                {formatCents(itemsSubtotalCents)}
                              </Text>
                            </View>
                            {dbServiceFeeCents > 0 && (
                              <View style={styles.totalsLineRow}>
                                <Text style={[styles.totalsLineLabel, { color: colors.mutedForeground }]}>Service Fee</Text>
                                <Text style={[styles.totalsLineValue, { color: colors.mutedForeground }]} testID="receipt-service-fee">
                                  {formatCents(dbServiceFeeCents)}
                                </Text>
                              </View>
                            )}
                            {dbTaxCents > 0 && (
                              <View style={styles.totalsLineRow}>
                                <Text style={[styles.totalsLineLabel, { color: colors.mutedForeground }]}>Tax</Text>
                                <Text style={[styles.totalsLineValue, { color: colors.mutedForeground }]} testID="receipt-tax">
                                  {formatCents(dbTaxCents)}
                                </Text>
                              </View>
                            )}
                            {dbTipCents > 0 && (
                              <View style={styles.totalsLineRow}>
                                <Text style={[styles.totalsLineLabel, { color: colors.mutedForeground }]}>Tip</Text>
                                <Text style={[styles.totalsLineValue, { color: colors.mutedForeground }]} testID="receipt-tip">
                                  {formatCents(dbTipCents)}
                                </Text>
                              </View>
                            )}
                            <View style={[styles.totalsLineRow, styles.totalsBoldLine, { borderTopColor: colors.border }]}>
                              <Text style={[styles.totalsBoldLabel, { color: colors.foreground }]}>Grand Total</Text>
                              <Text style={[styles.totalsBoldValue, { color: colors.foreground }]} testID="receipt-grand-total">
                                {dbTotalCents > 0
                                  ? formatCents(dbTotalCents)
                                  : formatCents(itemsSubtotalCents + dbServiceFeeCents + dbTaxCents + dbTipCents)}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.totalsColSeparator, { backgroundColor: colors.border }]} />

                          <View style={styles.totalsRightCol}>
                            <Text style={[styles.totalsRightColLabel, { color: colors.mutedForeground }]}>Split by person</Text>
                            {activeParticipants.map((p: ParticipantSummary) => {
                              const pk = pKey(p);
                              const owedCents = totals.byParticipant[pk] ?? 0;
                              const isMe = p.userId === myUserId;
                              const rowTestId = p.guestParticipantId ? `participant-total-guest-${p.guestParticipantId}` : `participant-total-${p.userId}`;
                              return (
                                <View key={pk} style={styles.personRow} testID={rowTestId}>
                                  <View style={[styles.personAvatar, { backgroundColor: avatarBg(pk) }]}>
                                    <Text style={styles.personAvatarText}>{initials(p.displayName)}</Text>
                                  </View>
                                  <Text
                                    style={[styles.personName, { color: colors.foreground, fontFamily: isMe ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular" }]}
                                    numberOfLines={1}
                                    testID={p.guestParticipantId ? undefined : `participant-total-name-${p.userId}`}
                                  >
                                    {isMe ? "You" : firstName(p.displayName)}
                                  </Text>
                                  <Text
                                    style={[styles.personAmount, { color: owedCents > 0 ? colors.foreground : colors.mutedForeground, fontFamily: isMe ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular" }]}
                                    testID={p.guestParticipantId ? undefined : `participant-amount-${p.userId}`}
                                  >
                                    {formatCents(owedCents)}
                                  </Text>
                                </View>
                              );
                            })}
                            {totals.unallocatedCents > 0 && (
                              <View style={styles.personRow} testID="unallocated-row">
                                <View style={[styles.personAvatar, { backgroundColor: "#9ca3af" }]}>
                                  <Text style={styles.personAvatarText}>?</Text>
                                </View>
                                <Text style={[styles.personName, { color: colors.mutedForeground, fontFamily: "PlusJakartaSans_400Regular" }]}>
                                  Unallocated
                                </Text>
                                <Text style={[styles.personAmount, { color: colors.mutedForeground, fontFamily: "PlusJakartaSans_400Regular" }]} testID="unallocated-amount">
                                  {formatCents(totals.unallocatedCents)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ── Host payment request section ───────────────────────── */}
                    {isHost && !isCancelled && (items.length > 0 || dbTotalCents > 0) && hasGuestsToPay && (
                      <View style={styles.paymentRequestSection} testID="host-payment-section">
                        {paymentRequests.length > 0 ? (
                          <>
                            <View style={{ gap: 2 }}>
                              <Text
                                style={[styles.paymentRequestSectionLabel, { color: colors.foreground }]}
                              >
                                Payment Requests
                              </Text>
                              <Text style={[styles.paymentRequestSectionSubtitle, { color: colors.mutedForeground }]}>
                                Track who has sent payment.
                              </Text>
                            </View>
                            <View
                              style={[styles.paymentStatusList, { backgroundColor: colors.card, borderColor: colors.border }]}
                              testID="payment-status-list"
                            >
                              {paymentRequests.map((req, index) => (
                                <View key={req.id}>
                                  {index > 0 && (
                                    <View style={[styles.paymentStatusDivider, { backgroundColor: colors.border }]} />
                                  )}
                                  <View
                                    style={styles.paymentStatusRow}
                                    testID={`payment-status-row-${req.guestUserId}`}
                                  >
                                    <View
                                      style={[styles.paymentStatusAvatar, { backgroundColor: avatarBg(req.guestUserId) }]}
                                    >
                                      <Text style={styles.paymentStatusAvatarText}>
                                        {initials(req.guestDisplayName)}
                                      </Text>
                                    </View>
                                    <Text
                                      style={[styles.paymentStatusName, { color: colors.foreground }]}
                                      numberOfLines={1}
                                    >
                                      {firstName(req.guestDisplayName)}
                                    </Text>
                                    <Text style={[styles.paymentStatusAmount, { color: colors.foreground }]}>
                                      {formatCents(req.amountCents)}
                                    </Text>
                                    {req.status === "received" ? (
                                      <View
                                        style={[
                                          styles.paymentStatusBadge,
                                          { backgroundColor: "#ccfbf1" },
                                        ]}
                                      >
                                        <Text
                                          style={[styles.paymentStatusBadgeText, { color: "#0f766e" }]}
                                          testID={`payment-status-badge-${req.guestUserId}`}
                                        >
                                          ✓ Received
                                        </Text>
                                      </View>
                                    ) : req.status === "paid" ? (
                                      <View style={styles.markReceivedWrap}>
                                        <View
                                          style={[
                                            styles.paymentStatusBadge,
                                            { backgroundColor: "#dcfce7" },
                                          ]}
                                        >
                                          <Text
                                            style={[styles.paymentStatusBadgeText, { color: "#16a34a" }]}
                                            testID={`payment-status-badge-${req.guestUserId}`}
                                          >
                                            ✓ Paid
                                          </Text>
                                        </View>
                                        <Pressable
                                          style={({ pressed }) => [
                                            styles.markReceivedBtn,
                                            { opacity: pressed || markingReceivedId === req.id ? 0.7 : 1 },
                                          ]}
                                          onPress={() => handleMarkReceived(req.id)}
                                          disabled={markingReceivedId === req.id}
                                          testID={`mark-received-button-${req.guestUserId}`}
                                        >
                                          {markingReceivedId === req.id ? (
                                            <ActivityIndicator size="small" color="#0f766e" />
                                          ) : (
                                            <Text style={styles.markReceivedBtnText}>
                                              Mark Received
                                            </Text>
                                          )}
                                        </Pressable>
                                        {markReceivedError && markingReceivedId !== req.id && (
                                          <Text style={[styles.inlineErrorText, { color: colors.destructive ?? "#ef4444" }]} testID={`mark-received-error-${req.guestUserId}`}>
                                            {markReceivedError}
                                          </Text>
                                        )}
                                      </View>
                                    ) : (
                                      <View style={styles.requestedBadgeRow}>
                                        <View
                                          style={[
                                            styles.paymentStatusBadge,
                                            { backgroundColor: "#fef3c7" },
                                          ]}
                                        >
                                          <Text
                                            style={[styles.paymentStatusBadgeText, { color: "#d97706" }]}
                                            testID={`payment-status-badge-${req.guestUserId}`}
                                          >
                                            Requested
                                          </Text>
                                        </View>
                                        <Pressable
                                          style={({ pressed }) => [styles.editPaymentBtn, { opacity: pressed ? 0.6 : 1 }]}
                                          onPress={() => {
                                            setEditingRequest({ id: req.id, guestDisplayName: req.guestDisplayName, amountCents: req.amountCents, note: req.note });
                                            setEditAmountText((req.amountCents / 100).toFixed(2));
                                            setEditNoteText(req.note ?? "");
                                            setPaymentEditError(null);
                                          }}
                                          testID={`edit-payment-button-${req.guestUserId}`}
                                        >
                                          <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
                                        </Pressable>
                                        <Pressable
                                          style={({ pressed }) => [styles.editPaymentBtn, { opacity: pressed ? 0.6 : 1 }]}
                                          testID={`share-payment-reminder-${req.guestUserId}`}
                                          onPress={async () => {
                                            const eventTitle = data?.title ?? "the event";
                                            const message = buildPaymentSmsBody({
                                              guestFirstName: req.guestDisplayName?.split(" ")[0] ?? "there",
                                              amountCents: req.amountCents,
                                              eventTitle,
                                              hostVenmoHandle: req.hostVenmoHandle ?? null,
                                              hostCashAppHandle: req.hostCashAppHandle ?? null,
                                              hostZelleInfo: req.hostZelleInfo && isValidZelleInfo(req.hostZelleInfo) ? req.hostZelleInfo : null,
                                              hostPreferredMethod: req.hostPreferredPaymentMethod ?? null,
                                              guestPreferredMethod: req.guestPreferredPaymentMethod ?? null,
                                              itemLines: buildItemizedLines({
                                                items,
                                                assignments,
                                                participantKey: req.guestUserId,
                                                owedCents: req.amountCents,
                                              }),
                                              receiptUrl: `owmo://event/${eventId}`,
                                            });
                                            if (req.guestPhoneNumber) {
                                              try {
                                                const available = await SMS.isAvailableAsync();
                                                if (available) { await SMS.sendSMSAsync([req.guestPhoneNumber], message); return; }
                                              } catch { /* fall through */ }
                                            }
                                            Share.share({ message });
                                          }}
                                        >
                                          <Ionicons name={req.guestPhoneNumber ? "chatbubble-outline" : "share-outline"} size={14} color={colors.mutedForeground} />
                                        </Pressable>
                                        {req.guestPhoneNumber ? (
                                          <Pressable
                                            style={({ pressed }) => [styles.smsPaymentBtn, { opacity: pressed ? 0.6 : 1 }]}
                                            onPress={() => {
                                              const body = buildPaymentSmsBody({
                                                guestFirstName: req.guestDisplayName?.split(" ")[0] ?? "there",
                                                amountCents: req.amountCents,
                                                eventTitle: req.note ?? data?.title ?? "your event",
                                                hostVenmoHandle: req.hostVenmoHandle ?? null,
                                                hostCashAppHandle: req.hostCashAppHandle ?? null,
                                                hostZelleInfo: req.hostZelleInfo ?? null,
                                                hostPreferredMethod: req.hostPreferredPaymentMethod ?? null,
                                                guestPreferredMethod: req.guestPreferredPaymentMethod ?? null,
                                                itemLines: buildItemizedLines({
                                                  items,
                                                  assignments,
                                                  participantKey: req.guestUserId,
                                                  owedCents: req.amountCents,
                                                }),
                                                receiptUrl: `owmo://event/${eventId}`,
                                              });
                                              const phone = req.guestPhoneNumber!.replace(/\D/g, "");
                                              Linking.openURL(`sms:${phone}?body=${encodeURIComponent(body)}`).catch(() => {});
                                            }}
                                            testID={`sms-payment-button-${req.guestUserId}`}
                                          >
                                            <Text style={styles.smsPaymentBtnText}>📱</Text>
                                          </Pressable>
                                        ) : (
                                          <View style={styles.noPhoneIndicator} testID={`no-phone-indicator-${req.guestUserId}`}>
                                            <Ionicons name="phone-portrait-outline" size={13} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                                          </View>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                            {isSettled ? (
                              <View style={[styles.settlementBanner, { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }]} testID="settlement-banner">
                                <Text style={styles.settlementBannerEmoji}>🎉</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.settlementBannerTitle, { color: "#065f46" }]}>
                                    All settled!
                                  </Text>
                                  <Text style={[styles.settlementBannerSub, { color: "#047857" }]}>
                                    You collected {formatCents(totalSettledCents)} from {paymentRequests.length} {paymentRequests.length === 1 ? "guest" : "guests"}.
                                  </Text>
                                </View>
                              </View>
                            ) : (
                              <Pressable
                                style={({ pressed }) => [
                                  styles.resendRequestsBtn,
                                  { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                                ]}
                                onPress={() => setShowRequestPaymentModal(true)}
                                testID="resend-payment-requests-button"
                              >
                                <Text style={[styles.resendRequestsBtnText, { color: colors.mutedForeground }]}>
                                  Re-send Requests
                                </Text>
                              </Pressable>
                            )}
                          </>
                        ) : (
                          <>
                            <Text style={[styles.paymentRequestHint, { color: colors.mutedForeground }]} testID="payment-request-hint">
                              {unassignedCount === 0 && items.length > 0
                                ? "All items assigned — ready to send payment requests to your guests."
                                : "Totals are ready. Send requests when you're done reviewing."}
                            </Text>
                            <Pressable
                              style={({ pressed }) => [
                                styles.requestPaymentBtn,
                                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                              ]}
                              onPress={() => setShowRequestPaymentModal(true)}
                              testID="request-payment-button"
                            >
                              <Text style={[styles.requestPaymentBtnText, { color: colors.primaryForeground }]}>
                                Request Payment from Guests →
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    )}

                    {/* ── 4b. Guest Payment Tracking (app-less guests, host only) */}
                    {isHost && !isCancelled && (() => {
                      const appLessGuests = activeParticipants.filter(
                        (p: ParticipantSummary) => p.role === "guest" && !!p.guestParticipantId
                      );
                      const guestsWithAmounts = appLessGuests.filter(
                        (p: ParticipantSummary) => (totals.byParticipant[pKey(p)] ?? 0) > 0
                      );
                      if (guestsWithAmounts.length === 0) return null;
                      const guestPayments: GuestPaymentRecord[] = data?.guestPayments ?? [];
                      const paymentByParticipantId = new Map<number, GuestPaymentRecord>(
                        guestPayments.map((gp) => [gp.eventParticipantId, gp])
                      );
                      const hostHandle = myProfile?.cashAppHandle;
                      return (
                        <View style={[styles.paymentRequestSection, { marginTop: 0 }]} testID="guest-payment-section">
                          <Text style={[styles.paymentRequestSectionTitle, { color: colors.foreground }]}>
                            Guest Payment Tracking
                          </Text>
                          <Text style={[styles.paymentRequestHint, { color: colors.mutedForeground, marginBottom: 10 }]}>
                            Track payments for guests without the app. Save their Cash App or Venmo handle for quick access.
                          </Text>
                          {guestsWithAmounts.map((p: ParticipantSummary) => {
                            const owedCents = totals.byParticipant[pKey(p)] ?? 0;
                            const record = paymentByParticipantId.get(p.guestParticipantId!);
                            const isPaid = !!record?.paidAt;
                            const isRequested = !!record?.requestedAt && !isPaid;
                            const isUnpaid = !record;
                            const statusBadgeColor = isPaid ? "#16a34a" : isRequested ? "#d97706" : "#64748b";
                            const statusLabel = isPaid ? "Paid" : isRequested ? "Requested" : "Unpaid";
                            const isMarkingPaid = markingGuestPaidId === (record?.id ?? null);
                            const isRequesting = requestingGuestPayId === p.guestParticipantId;
                            const guestCashApp = p.cashAppHandle ?? null;
                            const guestVenmo = p.venmoHandle ?? null;
                            const hasPayInfo = !!(guestCashApp || guestVenmo);
                            const existingUrl = record?.summaryToken
                              ? `${getBaseUrl()}/api/guest-summary/${record.summaryToken}/view`
                              : guestSummaryUrls.get(p.guestParticipantId!) ?? null;
                            return (
                              <View
                                key={p.guestParticipantId}
                                style={[
                                  styles.paymentStatusList,
                                  { borderColor: colors.border, backgroundColor: colors.card, padding: 10 },
                                ]}
                                testID={`guest-payment-row-${p.guestParticipantId}`}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <View style={[styles.paymentStatusAvatar, { backgroundColor: avatarBg(pKey(p)) }]}>
                                      <Text style={styles.paymentStatusAvatarText}>{initials(p.displayName)}</Text>
                                    </View>
                                    <View>
                                      <Text style={[styles.paymentStatusName, { color: colors.foreground }]}>
                                        {p.displayName}
                                      </Text>
                                      <Text style={[styles.paymentStatusAmount, { color: colors.mutedForeground }]}>
                                        {formatCents(owedCents)}
                                      </Text>
                                      {hasPayInfo && (
                                        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                                          {guestCashApp && (
                                            <Text style={{ fontSize: 11, color: "#00d632", fontWeight: "600" }}>
                                              {guestCashApp}
                                            </Text>
                                          )}
                                          {guestVenmo && (
                                            <Text style={{ fontSize: 11, color: "#3d95ce", fontWeight: "600" }}>
                                              @{guestVenmo}
                                            </Text>
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <Pressable
                                      onPress={() => openGuestPayInfoModal(p)}
                                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                                      testID={`guest-pay-info-edit-${p.guestParticipantId}`}
                                    >
                                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{hasPayInfo ? "edit" : "add pay info"}</Text>
                                    </Pressable>
                                    <View
                                      style={[
                                        styles.paymentStatusBadge,
                                        { backgroundColor: statusBadgeColor + "22", borderColor: statusBadgeColor + "55" },
                                      ]}
                                      testID={`guest-payment-badge-${p.guestParticipantId}`}
                                    >
                                      <Text style={[styles.paymentStatusBadgeText, { color: statusBadgeColor }]}>
                                        {statusLabel}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                                {/* Deep link buttons — open guest's handle in Cash App / Venmo */}
                                {hasPayInfo && !isPaid && (
                                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                    {guestCashApp && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          { backgroundColor: "#00d632", borderColor: "#00d632", opacity: pressed ? 0.7 : 1, flex: 1 },
                                        ]}
                                        testID={`guest-payment-cashapp-open-${p.guestParticipantId}`}
                                        onPress={async () => {
                                          const handle = guestCashApp.startsWith("$") ? guestCashApp : `$${guestCashApp}`;
                                          const amountDollars = (owedCents / 100).toFixed(2);
                                          const note = encodeURIComponent(data?.title ?? "Bill Split");
                                          setRequestingGuestPayId(p.guestParticipantId!);
                                          try {
                                            await openWithFallback(`cashapp://pay/${handle}?amount=${amountDollars}&note=${note}`, `https://cash.app/${handle}`);
                                            if (isUnpaid) {
                                              await new Promise<void>((resolve, reject) => {
                                                createGuestPaymentMutate(
                                                  { eventId, data: { guestParticipantId: p.guestParticipantId!, action: "mark_requested" } },
                                                  { onSuccess: () => resolve(), onError: () => reject() },
                                                );
                                              });
                                              refetch();
                                            }
                                          } catch {
                                            Alert.alert("Error", "Could not open Cash App. Please try again.");
                                          } finally {
                                            setRequestingGuestPayId(null);
                                          }
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: "#fff" }]}>
                                          {isRequested ? "Open Cash App Again" : "Open in Cash App"}
                                        </Text>
                                      </Pressable>
                                    )}
                                    {guestVenmo && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          { backgroundColor: "#3d95ce", borderColor: "#3d95ce", opacity: pressed ? 0.7 : 1, flex: 1 },
                                        ]}
                                        testID={`guest-payment-venmo-open-${p.guestParticipantId}`}
                                        onPress={async () => {
                                          const handle = guestVenmo.startsWith("@") ? guestVenmo.slice(1) : guestVenmo;
                                          const amountDollars = (owedCents / 100).toFixed(2);
                                          const note = encodeURIComponent(data?.title ?? "Bill Split");
                                          const webParams = `recipients=${encodeURIComponent(handle)}&amount=${amountDollars}&note=${note}`;
                                          setRequestingGuestPayId(p.guestParticipantId!);
                                          try {
                                            await openWithFallback(`venmo://paycharge?txn=pay&${webParams}`, `https://account.venmo.com/payment-link?${webParams}`);
                                            if (isUnpaid) {
                                              await new Promise<void>((resolve, reject) => {
                                                createGuestPaymentMutate(
                                                  { eventId, data: { guestParticipantId: p.guestParticipantId!, action: "mark_requested" } },
                                                  { onSuccess: () => resolve(), onError: () => reject() },
                                                );
                                              });
                                              refetch();
                                            }
                                          } catch {
                                            Alert.alert("Error", "Could not open Venmo. Please try again.");
                                          } finally {
                                            setRequestingGuestPayId(null);
                                          }
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: "#fff" }]}>
                                          {isRequested ? "Open Venmo Again" : "Open in Venmo"}
                                        </Text>
                                      </Pressable>
                                    )}
                                  </View>
                                )}
                                {/* Fallback: no payment info set — show prompt + legacy host Cash App flow */}
                                {!hasPayInfo && !isPaid && (
                                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                    <Pressable
                                      style={({ pressed }) => [
                                        styles.cashAppTrackBtn,
                                        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1, flex: 1 },
                                      ]}
                                      onPress={() => openGuestPayInfoModal(p)}
                                      testID={`guest-payment-set-info-${p.guestParticipantId}`}
                                    >
                                      <Text style={[styles.cashAppTrackBtnText, { color: colors.foreground }]}>Set Payment Info</Text>
                                    </Pressable>
                                    {hostHandle && (isUnpaid || isRequested) && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          {
                                            backgroundColor: isRequested ? colors.card : "#00d632",
                                            borderColor: isRequested ? colors.border : "#00d632",
                                            opacity: pressed || isRequesting ? 0.7 : 1,
                                            flex: 1,
                                          },
                                        ]}
                                        disabled={isRequesting}
                                        testID={`guest-payment-cashapp-btn-${p.guestParticipantId}`}
                                        onPress={async () => {
                                          if (!isUnpaid && !isRequested) return;
                                          setRequestingGuestPayId(p.guestParticipantId!);
                                          try {
                                            const amountDollars = (owedCents / 100).toFixed(2);
                                            const note = encodeURIComponent(data?.title ?? "Bill Split");
                                            const cashAppUrl = `cashapp://pay/$${hostHandle}?amount=${amountDollars}&note=${note}`;
                                            await openWithFallback(cashAppUrl, "https://cash.app");
                                            if (isUnpaid) {
                                              await new Promise<void>((resolve, reject) => {
                                                createGuestPaymentMutate(
                                                  { eventId, data: { guestParticipantId: p.guestParticipantId!, action: "mark_requested" } },
                                                  { onSuccess: () => resolve(), onError: () => reject() },
                                                );
                                              });
                                              refetch();
                                            }
                                          } catch {
                                            Alert.alert("Error", "Could not record request. Please try again.");
                                          } finally {
                                            setRequestingGuestPayId(null);
                                          }
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: isRequested ? colors.mutedForeground : "#fff" }]}>
                                          {isRequested ? "Open Cash App Again" : "Send via Cash App"}
                                        </Text>
                                      </Pressable>
                                    )}
                                  </View>
                                )}
                                {/* Mark paid / mark paid direct buttons */}
                                {!isPaid && (
                                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                    {isRequested && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          {
                                            backgroundColor: colors.primary,
                                            borderColor: colors.primary,
                                            opacity: pressed || isMarkingPaid ? 0.7 : 1,
                                            flex: 1,
                                          },
                                        ]}
                                        disabled={isMarkingPaid}
                                        testID={`guest-payment-mark-paid-btn-${p.guestParticipantId}`}
                                        onPress={() => {
                                          if (!record) return;
                                          setMarkingGuestPaidId(record.id);
                                          patchGuestPaymentMutate(
                                            { id: record.id, data: { action: "mark_paid" } },
                                            {
                                              onSuccess: () => { setMarkingGuestPaidId(null); refetch(); },
                                              onError: () => { setMarkingGuestPaidId(null); Alert.alert("Error", "Could not mark as paid. Please try again."); },
                                            },
                                          );
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: colors.primaryForeground }]}>Mark Paid</Text>
                                      </Pressable>
                                    )}
                                    {isUnpaid && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            opacity: pressed || isRequesting ? 0.7 : 1,
                                            flex: 1,
                                          },
                                        ]}
                                        disabled={isRequesting}
                                        testID={`guest-payment-mark-paid-direct-btn-${p.guestParticipantId}`}
                                        onPress={() => {
                                          Alert.alert(
                                            "Mark as Paid?",
                                            `Mark ${p.displayName} as paid ${formatCents(owedCents)} in cash or other method?`,
                                            [
                                              { text: "Cancel", style: "cancel" },
                                              {
                                                text: "Mark Paid",
                                                onPress: () => {
                                                  createGuestPaymentMutate(
                                                    { eventId, data: { guestParticipantId: p.guestParticipantId!, action: "mark_paid" } },
                                                    {
                                                      onSuccess: () => refetch(),
                                                      onError: () => Alert.alert("Error", "Could not save. Please try again."),
                                                    },
                                                  );
                                                },
                                              },
                                            ],
                                          );
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: colors.mutedForeground }]}>Mark Paid (cash)</Text>
                                      </Pressable>
                                    )}
                                  </View>
                                )}
                                {/* Payment summary link — shown inline once generated */}
                                {existingUrl && (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 8,
                                      marginTop: 8,
                                      paddingVertical: 7,
                                      paddingHorizontal: 10,
                                      backgroundColor: colors.muted,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                    testID={`guest-payment-summary-link-${p.guestParticipantId}`}
                                  >
                                    <Text
                                      style={{ flex: 1, fontSize: 11, color: colors.mutedForeground }}
                                      numberOfLines={1}
                                      ellipsizeMode="middle"
                                    >
                                      {existingUrl}
                                    </Text>
                                    <Pressable
                                      onPress={async () => {
                                        await Clipboard.setStringAsync(existingUrl);
                                        setCopiedGuestLinkId(p.guestParticipantId!);
                                        setTimeout(() => setCopiedGuestLinkId(null), 2000);
                                      }}
                                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                                      testID={`guest-payment-copy-link-${p.guestParticipantId}`}
                                    >
                                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primary }}>
                                        {copiedGuestLinkId === p.guestParticipantId ? "Copied!" : "Copy"}
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}
                                {/* Send Link — share a no-login payment summary URL with the guest */}
                                {!isPaid && (
                                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                    <Pressable
                                      style={({ pressed }) => [
                                        styles.cashAppTrackBtn,
                                        {
                                          backgroundColor: colors.background,
                                          borderColor: colors.border,
                                          opacity: pressed || sendingGuestLinkId === p.guestParticipantId ? 0.7 : 1,
                                          flex: 1,
                                        },
                                      ]}
                                      disabled={sendingGuestLinkId === p.guestParticipantId}
                                      testID={`guest-payment-send-link-${p.guestParticipantId}`}
                                      onPress={() => {
                                        if (existingUrl) {
                                          Share.share({
                                            message: `Hi ${p.displayName}! Here's your payment summary for ${data?.title ?? "the event"}: ${existingUrl}`,
                                            url: existingUrl,
                                          });
                                          return;
                                        }
                                        setSendingGuestLinkId(p.guestParticipantId!);
                                        generateGuestSummaryLinkMutate(
                                          { eventId, guestParticipantId: p.guestParticipantId! },
                                          {
                                            onSuccess: ({ summaryUrl }) => {
                                              setSendingGuestLinkId(null);
                                              setGuestSummaryUrls((prev) => new Map(prev).set(p.guestParticipantId!, summaryUrl));
                                              Share.share({
                                                message: `Hi ${p.displayName}! Here's your payment summary for ${data?.title ?? "the event"}: ${summaryUrl}`,
                                                url: summaryUrl,
                                              });
                                            },
                                            onError: () => {
                                              setSendingGuestLinkId(null);
                                              Alert.alert("Error", "Could not generate link. Please try again.");
                                            },
                                          },
                                        );
                                      }}
                                    >
                                      <Text style={[styles.cashAppTrackBtnText, { color: colors.foreground }]}>
                                        {sendingGuestLinkId === p.guestParticipantId ? "Generating…" : existingUrl ? "Share Link" : "Send Link"}
                                      </Text>
                                    </Pressable>
                                    {p.phoneNumber && (
                                      <Pressable
                                        style={({ pressed }) => [
                                          styles.cashAppTrackBtn,
                                          {
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                            opacity: pressed || sendingGuestLinkId === p.guestParticipantId ? 0.7 : 1,
                                            flex: 1,
                                          },
                                        ]}
                                        disabled={sendingGuestLinkId === p.guestParticipantId}
                                        testID={`guest-payment-text-link-${p.guestParticipantId}`}
                                        onPress={async () => {
                                          const sendText = async (url: string) => {
                                            // Non-app guests have no stored payment preference; infer it
                                            // from the handles the host saved for them.
                                            const guestPreferredMethod = guestVenmo ? "venmo" : guestCashApp ? "cash_app" : null;
                                            const message = buildPaymentSmsBody({
                                              guestFirstName: firstName(p.displayName),
                                              amountCents: owedCents,
                                              eventTitle: data?.title ?? "the event",
                                              hostVenmoHandle: myProfile?.venmoHandle ?? null,
                                              hostCashAppHandle: myProfile?.cashAppHandle ?? null,
                                              hostZelleInfo: myProfile?.zelleInfo && isValidZelleInfo(myProfile.zelleInfo) ? myProfile.zelleInfo : null,
                                              hostPreferredMethod: myProfile?.preferredPaymentMethod ?? null,
                                              guestPreferredMethod,
                                              itemLines: buildItemizedLines({
                                                items,
                                                assignments,
                                                participantKey: -p.guestParticipantId!,
                                                owedCents,
                                              }),
                                              receiptUrl: url,
                                            });
                                            try {
                                              const isAvailable = await SMS.isAvailableAsync();
                                              if (isAvailable) {
                                                await SMS.sendSMSAsync([p.phoneNumber!], message);
                                              } else {
                                                await Share.share({ message });
                                              }
                                            } catch {
                                              await Share.share({ message });
                                            }
                                          };
                                          if (existingUrl) {
                                            await sendText(existingUrl);
                                            return;
                                          }
                                          setSendingGuestLinkId(p.guestParticipantId!);
                                          generateGuestSummaryLinkMutate(
                                            { eventId, guestParticipantId: p.guestParticipantId! },
                                            {
                                              onSuccess: async ({ summaryUrl }) => {
                                                setSendingGuestLinkId(null);
                                                setGuestSummaryUrls((prev) => new Map(prev).set(p.guestParticipantId!, summaryUrl));
                                                await sendText(summaryUrl);
                                              },
                                              onError: () => {
                                                setSendingGuestLinkId(null);
                                                Alert.alert("Error", "Could not generate link. Please try again.");
                                              },
                                            },
                                          );
                                        }}
                                      >
                                        <Text style={[styles.cashAppTrackBtnText, { color: colors.foreground }]}>
                                          💬 Text Link
                                        </Text>
                                      </Pressable>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}

                    {/* ── 5. Host Tools ──────────────────────────────────────── */}
                    {isHost && !isCancelled && (
                      <View style={styles.hostToolsSection}>
                        <Text style={[styles.hostToolsSectionLabel, { color: colors.mutedForeground }]}>
                          Host Tools  (Only visible to hosts)
                        </Text>
                        <Pressable
                          style={({ pressed }) => [
                            styles.hostToolHeader,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.card,
                              borderBottomLeftRadius: showEditTotals ? 0 : 12,
                              borderBottomRightRadius: showEditTotals ? 0 : 12,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          onPress={() => setShowEditTotals((v) => !v)}
                          testID="toggle-edit-totals"
                        >
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text style={[styles.hostToolHeaderText, { color: colors.foreground }]}>Edit Totals</Text>
                            <Text style={[styles.hostToolSubtitle, { color: colors.mutedForeground }]}>Adjust subtotal, tax, tip</Text>
                          </View>
                          <Text style={[styles.hostToolChevron, { color: colors.mutedForeground }]}>
                            {showEditTotals ? "▾" : "▸"}
                          </Text>
                        </Pressable>
                        {showEditTotals && (
                          <View
                            style={[styles.hostToolBody, { borderColor: colors.border, backgroundColor: colors.card }]}
                            testID="receipt-totals-form"
                          >
                            <View style={styles.totalsInputGrid}>
                              <View style={styles.totalsInputCell}>
                                <Text style={[styles.totalsInputLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                                <TextInput
                                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                  value={subtotalInput}
                                  onChangeText={setSubtotalInput}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.mutedForeground}
                                  keyboardType="decimal-pad"
                                  returnKeyType="done"
                                  onSubmitEditing={() => Keyboard.dismiss()}
                                  testID="subtotal-input"
                                />
                              </View>
                              <View style={styles.totalsInputCell}>
                                <Text style={[styles.totalsInputLabel, { color: colors.mutedForeground }]}>Service Fee</Text>
                                <TextInput
                                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                  value={serviceFeeInput}
                                  onChangeText={setServiceFeeInput}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.mutedForeground}
                                  keyboardType="decimal-pad"
                                  returnKeyType="done"
                                  onSubmitEditing={() => Keyboard.dismiss()}
                                  testID="service-fee-input"
                                />
                              </View>
                              <View style={styles.totalsInputCell}>
                                <Text style={[styles.totalsInputLabel, { color: colors.mutedForeground }]}>Tax</Text>
                                <TextInput
                                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                  value={taxInput}
                                  onChangeText={setTaxInput}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.mutedForeground}
                                  keyboardType="decimal-pad"
                                  returnKeyType="done"
                                  onSubmitEditing={() => Keyboard.dismiss()}
                                  testID="tax-input"
                                />
                              </View>
                              <View style={styles.totalsInputCell}>
                                <Text style={[styles.totalsInputLabel, { color: colors.mutedForeground }]}>Tip</Text>
                                <TextInput
                                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                  value={tipInput}
                                  onChangeText={setTipInput}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.mutedForeground}
                                  keyboardType="decimal-pad"
                                  returnKeyType="done"
                                  onSubmitEditing={() => Keyboard.dismiss()}
                                  testID="tip-input"
                                />
                              </View>
                              <View style={styles.totalsInputCell}>
                                <Text style={[styles.totalsInputLabel, { color: colors.mutedForeground }]}>Total</Text>
                                <TextInput
                                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                  value={totalInput}
                                  onChangeText={setTotalInput}
                                  placeholder="0.00"
                                  placeholderTextColor={colors.mutedForeground}
                                  keyboardType="decimal-pad"
                                  returnKeyType="done"
                                  onSubmitEditing={() => Keyboard.dismiss()}
                                  testID="total-input"
                                />
                              </View>
                            </View>
                            {totalsError && (
                              <Text style={[styles.addErrorText, { color: colors.destructive }]}>{totalsError}</Text>
                            )}
                            <Pressable
                              style={({ pressed }) => [
                                styles.addBtn,
                                { backgroundColor: colors.primary, opacity: pressed || isSavingTotals ? 0.65 : 1 },
                              ]}
                              onPress={handleSaveTotals}
                              disabled={isSavingTotals}
                              testID="save-totals-btn"
                            >
                              {isSavingTotals ? (
                                <ActivityIndicator color={colors.primaryForeground} />
                              ) : (
                                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Save Totals</Text>
                              )}
                            </Pressable>
                          </View>
                        )}
                        <Pressable
                          style={({ pressed }) => [
                            styles.hostToolHeader,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.card,
                              borderBottomLeftRadius: showAddItem ? 0 : 12,
                              borderBottomRightRadius: showAddItem ? 0 : 12,
                              marginTop: 10,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          onPress={() => setShowAddItem((v) => !v)}
                          testID="toggle-add-item"
                        >
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text style={[styles.hostToolHeaderText, { color: colors.foreground }]}>Add Item</Text>
                            <Text style={[styles.hostToolSubtitle, { color: colors.mutedForeground }]}>Manually add a missing item</Text>
                          </View>
                          <Text style={[styles.hostToolChevron, { color: colors.mutedForeground }]}>
                            {showAddItem ? "▾" : "▸"}
                          </Text>
                        </Pressable>
                        {showAddItem && (
                          <View
                            style={[styles.hostToolBody, { borderColor: colors.border, backgroundColor: colors.card }]}
                            testID="add-item-form"
                          >
                            <TextInput
                              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={itemName}
                              onChangeText={setItemName}
                              placeholder="Item name"
                              placeholderTextColor={colors.mutedForeground}
                              returnKeyType="next"
                              maxLength={80}
                              onSubmitEditing={() => itemPriceRef.current?.focus()}
                              testID="item-name-input"
                            />
                            {itemName.length > 60 && (
                              <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", textAlign: "right", color: itemName.length >= 80 ? (colors.destructive ?? "#ef4444") : colors.mutedForeground, marginTop: 2 }}>
                                {80 - itemName.length} chars left
                              </Text>
                            )}
                            <View style={styles.priceQtyRow}>
                              <TextInput
                                ref={itemPriceRef}
                                style={[styles.input, styles.priceInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={itemPrice}
                                onChangeText={setItemPrice}
                                placeholder="Price"
                                placeholderTextColor={colors.mutedForeground}
                                keyboardType="decimal-pad"
                                returnKeyType="next"
                                onSubmitEditing={() => itemQtyRef.current?.focus()}
                                testID="item-price-input"
                              />
                              <TextInput
                                ref={itemQtyRef}
                                style={[styles.input, styles.qtyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={itemQty}
                                onChangeText={setItemQty}
                                placeholder="Qty"
                                placeholderTextColor={colors.mutedForeground}
                                keyboardType="number-pad"
                                returnKeyType="done"
                                onSubmitEditing={handleAddItem}
                                testID="item-qty-input"
                              />
                            </View>
                            {addError && (
                              <Text style={[styles.addErrorText, { color: colors.destructive }]}>{addError}</Text>
                            )}
                            <Pressable
                              style={({ pressed }) => [
                                styles.addBtn,
                                {
                                  backgroundColor: colors.primary,
                                  opacity: pressed || !itemName.trim() || !itemPrice.trim() || isAddingItem ? 0.6 : 1,
                                },
                              ]}
                              onPress={handleAddItem}
                              disabled={!itemName.trim() || !itemPrice.trim() || isAddingItem}
                              testID="add-item-btn"
                            >
                              {isAddingItem ? (
                                <ActivityIndicator color={colors.primaryForeground} />
                              ) : (
                                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add Item</Text>
                              )}
                            </Pressable>
                          </View>
                        )}
                        {/* ── Scan Health ───────────────────────────────────── */}
                        <Pressable
                          style={({ pressed }) => [
                            styles.hostToolHeader,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.card,
                              borderBottomLeftRadius: showScanHealth ? 0 : 12,
                              borderBottomRightRadius: showScanHealth ? 0 : 12,
                              marginTop: 10,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          onPress={() => {
                            const next = !showScanHealth;
                            setShowScanHealth(next);
                            if (next) { refetchScanHealth(); refetchGlobalErrorSummary(); }
                          }}
                          testID="toggle-scan-health"
                        >
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text style={[styles.hostToolHeaderText, { color: colors.foreground }]}>Scan Health</Text>
                            <Text style={[styles.hostToolSubtitle, { color: colors.mutedForeground }]}>Retry rates by variant</Text>
                          </View>
                          <Text style={[styles.hostToolChevron, { color: colors.mutedForeground }]}>
                            {showScanHealth ? "▾" : "▸"}
                          </Text>
                        </Pressable>
                        {showScanHealth && (
                          <View
                            style={[styles.hostToolBody, { borderColor: colors.border, backgroundColor: colors.card }]}
                            testID="scan-health-panel"
                          >
                            {isScanHealthLoading ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : isScanHealthError || !scanHealthData ? (
                              <Text style={[styles.addErrorText, { color: colors.destructive }]}>
                                Could not load scan health data.
                              </Text>
                            ) : (() => {
                              const total = scanHealthData.byVariant.reduce((s: number, r: { enhancementVariant: string | null; count: number }) => s + r.count, 0);
                              const retryRow = scanHealthData.byVariant.find((r: { enhancementVariant: string | null; count: number }) => r.enhancementVariant === "binarized_retry");
                              const enhancedRow = scanHealthData.byVariant.find((r: { enhancementVariant: string | null; count: number }) => r.enhancementVariant === "enhanced");
                              const retryCount = retryRow?.count ?? 0;
                              const enhancedCount = enhancedRow?.count ?? 0;
                              // Retry rate: % of all scan errors that occurred during a binarized retry attempt
                              const retryPct = total > 0 ? Math.round((retryCount / total) * 100) : 0;
                              // Improvement rate: how much fewer errors the retry produced vs the first pass.
                              // Formula: (enhancedCount - retryCount) / enhancedCount × 100
                              // Positive means the retry had fewer errors than the first pass (good).
                              // Only meaningful when both variants have errors.
                              const improvementPct = enhancedCount > 0
                                ? Math.round(((enhancedCount - retryCount) / enhancedCount) * 100)
                                : null;

                              type ErrorTypeRow = { errorType: string | null; enhancementVariant: string | null; count: number };
                              const errorTypeRows: ErrorTypeRow[] = scanHealthData.byErrorType ?? [];

                              const errorTypeLabel = (et: string | null): string => {
                                if (et === "binarized_retry_failed") return "Retry failed";
                                if (!et) return "Unknown";
                                return et.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                              };
                              const errorTypeColor = (et: string | null): string => {
                                if (et === "binarized_retry_failed") return colors.warning ?? "#D97706";
                                return colors.foreground;
                              };

                              return (
                                <View style={{ gap: 10 }}>
                                  {total === 0 ? (
                                    <Text style={[{ fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", color: colors.mutedForeground }]}>
                                      No scan errors recorded for this event.
                                    </Text>
                                  ) : (
                                    <>
                                      <View style={styles.scanHealthRow}>
                                        <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>Total scan errors</Text>
                                        <Text style={[styles.scanHealthValue, { color: colors.foreground }]}>{total}</Text>
                                      </View>
                                      <View style={styles.scanHealthRow}>
                                        <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>Enhanced (first pass)</Text>
                                        <Text style={[styles.scanHealthValue, { color: colors.foreground }]}>{enhancedCount}</Text>
                                      </View>
                                      <View style={styles.scanHealthRow}>
                                        <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>Binarized retry</Text>
                                        <Text style={[styles.scanHealthValue, { color: colors.foreground }]}>{retryCount}</Text>
                                      </View>
                                      <View style={[styles.scanHealthDivider, { backgroundColor: colors.border }]} />
                                      <View style={styles.scanHealthRow}>
                                        <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>
                                          Retry rate
                                        </Text>
                                        <Text style={[styles.scanHealthValue, { color: retryPct > 30 ? (colors.destructive ?? "#ef4444") : colors.foreground }]}>
                                          {retryPct}%
                                        </Text>
                                      </View>
                                      <View style={styles.scanHealthRow}>
                                        <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>
                                          Improvement rate
                                        </Text>
                                        {improvementPct === null ? (
                                          <Text style={[styles.scanHealthValue, { color: colors.mutedForeground }]}>N/A</Text>
                                        ) : (
                                          <Text style={[styles.scanHealthValue, { color: improvementPct >= 0 ? colors.foreground : (colors.destructive ?? "#ef4444") }]}>
                                            {improvementPct >= 0 ? "+" : ""}{improvementPct}%
                                          </Text>
                                        )}
                                      </View>
                                      {errorTypeRows.length > 0 && (
                                        <>
                                          <View style={[styles.scanHealthDivider, { backgroundColor: colors.border }]} />
                                          <Text style={[{ fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", color: colors.mutedForeground, opacity: 0.7 }]}>
                                            BY ERROR TYPE
                                          </Text>
                                          {errorTypeRows.map((r: ErrorTypeRow, idx: number) => (
                                            <View key={`${r.errorType ?? "null"}-${r.enhancementVariant ?? "null"}-${idx}`} style={[styles.scanHealthRow, { alignItems: "flex-start" }]}>
                                              <View style={{ flex: 1, gap: 1 }}>
                                                <Text style={[styles.scanHealthLabel, { color: errorTypeColor(r.errorType) }]}>
                                                  {errorTypeLabel(r.errorType)}
                                                </Text>
                                                {r.enhancementVariant ? (
                                                  <Text style={{ fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", color: colors.mutedForeground, opacity: 0.7 }}>
                                                    {r.enhancementVariant}
                                                  </Text>
                                                ) : null}
                                              </View>
                                              <Text style={[styles.scanHealthValue, { color: errorTypeColor(r.errorType) }]}>{r.count}</Text>
                                            </View>
                                          ))}
                                        </>
                                      )}
                                      {scanHealthData.byDay.length > 0 && (
                                        <>
                                          <View style={[styles.scanHealthDivider, { backgroundColor: colors.border }]} />
                                          <Text style={[{ fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", color: colors.mutedForeground, opacity: 0.7 }]}>
                                            BY DAY
                                          </Text>
                                          {Array.from(new Set(scanHealthData.byDay.map((r: { date: string; enhancementVariant: string | null; count: number }) => r.date))).map((date: string) => {
                                            const dayRows = scanHealthData.byDay.filter((r: { date: string; enhancementVariant: string | null; count: number }) => r.date === date);
                                            const dayTotal = dayRows.reduce((s: number, r: { count: number }) => s + r.count, 0);
                                            const dayEnhanced = dayRows.find((r: { enhancementVariant: string | null }) => r.enhancementVariant === "enhanced")?.count ?? 0;
                                            const dayRetry = dayRows.find((r: { enhancementVariant: string | null }) => r.enhancementVariant === "binarized_retry")?.count ?? 0;
                                            const dayRetryPct = dayTotal > 0 ? Math.round((dayRetry / dayTotal) * 100) : 0;
                                            const dayImprovePct = dayEnhanced > 0 ? Math.round(((dayEnhanced - dayRetry) / dayEnhanced) * 100) : null;
                                            return (
                                              <View key={date} style={styles.scanHealthRow}>
                                                <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>{date}</Text>
                                                <Text style={[styles.scanHealthValue, { color: colors.foreground }]}>
                                                  {dayTotal} err · {dayRetryPct}% retry{dayImprovePct !== null ? ` · ${dayImprovePct >= 0 ? "+" : ""}${dayImprovePct}% impr` : ""}
                                                </Text>
                                              </View>
                                            );
                                          })}
                                        </>
                                      )}
                                    </>
                                  )}
                                </View>
                              );
                            })()}
                            {/* ── Global error type breakdown ─────────────── */}
                            <View style={[styles.scanHealthDivider, { backgroundColor: colors.border, marginTop: 6 }]} />
                            <Text style={[{ fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", color: colors.mutedForeground, opacity: 0.7, marginTop: 4 }]}>
                              GLOBAL ERROR BREAKDOWN (30 DAYS)
                            </Text>
                            {isGlobalErrorSummaryLoading ? (
                              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: "flex-start" }} />
                            ) : isGlobalErrorSummaryError || !globalErrorSummaryData ? (
                              <Text style={[styles.addErrorText, { color: colors.destructive }]}>
                                Could not load global error data.
                              </Text>
                            ) : globalErrorSummaryData.byErrorType.length === 0 ? (
                              <Text style={[{ fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", color: colors.mutedForeground }]}>
                                No errors recorded globally in the past 30 days.
                              </Text>
                            ) : (
                              (() => {
                                type GlobalErrorTypeRow = { errorType: string | null; enhancementVariant: string | null; count: number };
                                const globalRows: GlobalErrorTypeRow[] = [...globalErrorSummaryData.byErrorType].sort((a, b) => b.count - a.count);
                                const globalTotal = globalRows.reduce((s, r) => s + r.count, 0);
                                const globalErrorTypeLabel = (et: string | null): string => {
                                  if (et === "binarized_retry_failed") return "Retry failed";
                                  if (!et) return "Unknown";
                                  return et.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                                };
                                const globalErrorTypeColor = (et: string | null): string => {
                                  if (et === "binarized_retry_failed") return colors.warning ?? "#D97706";
                                  return colors.foreground;
                                };
                                return (
                                  <View style={{ gap: 8 }}>
                                    <View style={styles.scanHealthRow}>
                                      <Text style={[styles.scanHealthLabel, { color: colors.mutedForeground }]}>Total (all events)</Text>
                                      <Text style={[styles.scanHealthValue, { color: colors.foreground }]}>{globalTotal}</Text>
                                    </View>
                                    {globalRows.map((r: GlobalErrorTypeRow, idx: number) => (
                                      <View key={`global-${r.errorType ?? "null"}-${r.enhancementVariant ?? "null"}-${idx}`} style={[styles.scanHealthRow, { alignItems: "flex-start" }]}>
                                        <View style={{ flex: 1, gap: 1 }}>
                                          <Text style={[styles.scanHealthLabel, { color: globalErrorTypeColor(r.errorType) }]}>
                                            {globalErrorTypeLabel(r.errorType)}
                                          </Text>
                                          <Text style={{ fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", color: colors.mutedForeground, opacity: 0.7 }}>
                                            {r.enhancementVariant ?? "—"}
                                          </Text>
                                        </View>
                                        <View style={{ alignItems: "flex-end", gap: 1 }}>
                                          <Text style={[styles.scanHealthValue, { color: globalErrorTypeColor(r.errorType) }]}>{r.count}</Text>
                                          {globalTotal > 0 ? (
                                            <Text style={{ fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", color: colors.mutedForeground, opacity: 0.7 }}>
                                              {Math.round((r.count / globalTotal) * 100)}%
                                            </Text>
                                          ) : null}
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                );
                              })()
                            )}
                          </View>
                        )}

                        {/* ── Reset Bill ────────────────────────────────────── */}
                        <View style={[styles.resetBillDivider, { backgroundColor: colors.border }]} />
                        {resetBillError ? (
                          <Text style={[styles.resetBillError, { color: colors.destructive }]}>{resetBillError}</Text>
                        ) : null}
                        <Pressable
                          style={({ pressed }) => [
                            styles.resetBillBtn,
                            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || isResettingBill ? 0.6 : 1 },
                          ]}
                          onPress={handleResetBill}
                          disabled={isResettingBill}
                          testID="reset-bill-btn"
                        >
                          {isResettingBill ? (
                            <ActivityIndicator color="#EF4444" size="small" />
                          ) : (
                            <Text style={styles.resetBillBtnText}>Reset Bill</Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            )
          )}

          {/* ══ PHOTOS TAB ════════════════════════════════════════════════════ */}
          {activeTab === "photos" && (
            isLimited ? (
              <ScrollView
                contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
                testID="tab-content-photos"
              >
                <View
                  style={[styles.lockedCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                  testID="photos-locked-notice"
                >
                  <View style={[styles.lockedIconCircle, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={styles.lockedIconEmoji}>🔒</Text>
                  </View>
                  <Text style={[styles.lockedTitle, { color: colors.foreground }]}>Photos are locked</Text>
                  <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
                    Accept your invite to view event photos.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.rsvpAcceptBtn,
                      { backgroundColor: colors.primary, opacity: pressed || isRsvpPending ? 0.75 : 1 },
                    ]}
                    onPress={() => handleRsvp("accept")}
                    disabled={isRsvpPending}
                    testID="photos-locked-accept-btn"
                  >
                    {isRsvpPending ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <Text style={[styles.rsvpAcceptBtnText, { color: colors.primaryForeground }]}>
                        Accept Invite
                      </Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <ScrollView
                contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
                refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />}
                testID="tab-content-photos"
              >
                {eventPhotos.length === 0 ? (
                  <View
                    style={[styles.emptyBox, { borderColor: colors.border, marginHorizontal: 20 }]}
                    testID="gallery-empty"
                  >
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                      {isCancelled
                        ? "No photos were added."
                        : "No photos yet. Add one to remember the night."}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.galleryGrid} testID="gallery-grid">
                    {eventPhotos.map((photo, photoIdx) => {
                      const canDelete = !isCancelled && (isHost || photo.uploadedByUserId === myUserId);
                      return (
                        <View key={photo.id} style={styles.galleryThumb}>
                          {/* Full-area pressable — opens viewer only */}
                          <Pressable
                            style={StyleSheet.absoluteFill}
                            onPress={() => {
                              viewerTranslateY.value = 0;
                              viewerScale.value = 1;
                              viewerBgOpacity.value = 1;
                              setViewerIndex(photoIdx);
                              setCurrentViewerPage(photoIdx);
                            }}
                            testID={`gallery-photo-${photo.id}`}
                          >
                            <Image
                              source={{ uri: photo.signedImageUrl ?? undefined }}
                              style={styles.galleryThumbImg}
                              contentFit="cover"
                            />
                            {/* Uploader badge — bottom-left, non-interactive */}
                            {(() => {
                              const uploader = uploaderMap.get(photo.uploadedByUserId);
                              const name = uploader ? firstName(uploader.displayName) || `@${uploader.handle}` : "?";
                              return (
                                <View style={styles.galleryUploaderBadge} pointerEvents="none">
                                  {uploader?.avatarUrl ? (
                                    <Image source={{ uri: uploader.avatarUrl }} style={styles.galleryUploaderAvatar} />
                                  ) : (
                                    <View style={[styles.galleryUploaderAvatar, { backgroundColor: uploader ? avatarBg(uploader.userId ?? 0) : "#888" }]}>
                                      <Text style={styles.galleryUploaderAvatarInitial}>{name[0].toUpperCase()}</Text>
                                    </View>
                                  )}
                                  <Text style={styles.galleryUploaderName} numberOfLines={1}>{name}</Text>
                                </View>
                              );
                            })()}
                          </Pressable>
                          {/* Delete button — sibling of viewer Pressable, no touch competition */}
                          {canDelete && (
                            <Pressable
                              style={({ pressed }) => [styles.photoDeleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                              onPress={() => handleDeleteEventPhoto(photo.id)}
                              testID={`gallery-delete-${photo.id}`}
                            >
                              <Text style={styles.photoDeleteText}>×</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {!isCancelled && (
                  <View style={[{ marginHorizontal: 20, marginTop: 16 }]}>
                    <View style={styles.receiptPhotoUploadRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.receiptPhotoUploadBtn,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            opacity: pressed || isUploadingEventPhoto || isUploadingEventPhotos ? 0.65 : 1,
                          },
                        ]}
                        onPress={handleTakeEventPhoto}
                        disabled={isUploadingEventPhoto || isUploadingEventPhotos}
                        testID="gallery-take-photo-btn"
                      >
                        <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>
                          Take Photo
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.receiptPhotoUploadBtn,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                            opacity: pressed || isUploadingEventPhoto || isUploadingEventPhotos ? 0.65 : 1,
                          },
                        ]}
                        onPress={handlePickEventPhoto}
                        disabled={isUploadingEventPhoto || isUploadingEventPhotos}
                        testID="gallery-library-photo-btn"
                      >
                        <Text style={[styles.receiptPhotoUploadBtnText, { color: colors.primary }]}>
                          Choose from Library
                        </Text>
                      </Pressable>
                    </View>
                    {isUploadingEventPhotos && (
                      <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center", marginTop: 8 }]}>
                        {photoUploadProgress.total > 1
                          ? `Uploading ${photoUploadProgress.current} of ${photoUploadProgress.total}…`
                          : "Uploading photo…"}
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>
            )
          )}
        </>
      )}

      {/* ── Receipt Camera Guide Overlay ─────────────────────────────────────── */}
      {showReceiptCameraGuide && (
        <View style={styles.cameraGuideOverlay} testID="receipt-camera-guide-modal">
          <Pressable style={styles.cameraGuideBackdrop} onPress={() => setShowReceiptCameraGuide(false)} />
          <View style={[styles.cameraGuideSheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Take a clear receipt photo</Text>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setShowReceiptCameraGuide(false)}
                testID="receipt-guide-cancel-btn"
              >
                <Text style={[styles.modalCloseBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.cameraGuideContent}
              alwaysBounceVertical={false}
            >
              <Text style={[styles.cameraGuideBody, { color: colors.mutedForeground }]}>
                Fill the frame with the receipt. Include all items through the total. Exclude the card payment footer if possible.
              </Text>
              <View style={[styles.cameraGuideChecklist, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {[
                  "Include all items through total",
                  "Exclude card/payment footer if possible",
                  "Bright, even lighting — no shadows",
                  "Receipt flat and fully in frame",
                  "Text in focus and readable",
                ].map((tip) => (
                  <View key={tip} style={styles.cameraGuideCheckRow}>
                    <Text style={[styles.cameraGuideCheckIcon, { color: colors.primary }]}>✓</Text>
                    <Text style={[styles.cameraGuideCheckText, { color: colors.foreground }]}>{tip}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.cameraGuideOpenBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  setShowReceiptCameraGuide(false);
                  void handleOpenReceiptCamera();
                }}
                testID="receipt-guide-open-camera-btn"
              >
                <Text style={[styles.cameraGuideOpenBtnText, { color: colors.primaryForeground }]}>Open Camera</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.cameraGuideCancelBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowReceiptCameraGuide(false)}
                testID="receipt-guide-cancel-btn-bottom"
              >
                <Text style={[styles.cameraGuideCancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Edit Payment Request Modal (host) ────────────────────────────────── */}
      <Modal
        visible={editingRequest !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingRequest(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setEditingRequest(null)}
              testID="edit-payment-cancel"
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Amount</Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={handleSavePaymentEdit}
              disabled={isSavingEdit}
              testID="edit-payment-save"
            >
              {isSavingEdit
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={[styles.modalCloseBtnText, { color: colors.primary, fontFamily: "PlusJakartaSans_600SemiBold" }]}>Save</Text>
              }
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.paymentModalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.editPaymentGuestLabel, { color: colors.mutedForeground }]}>
              Editing request for {editingRequest?.guestDisplayName ?? "guest"}
            </Text>
            <Text style={[styles.paymentModalNoteLabel, { color: colors.mutedForeground }]}>Amount ($)</Text>
            <TextInput
              style={[styles.paymentModalNoteInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editAmountText}
              onChangeText={setEditAmountText}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              testID="edit-payment-amount-input"
            />
            <Text style={[styles.paymentModalNoteLabel, { color: colors.mutedForeground }]}>Note (optional)</Text>
            <TextInput
              style={[styles.paymentModalNoteInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editNoteText}
              onChangeText={setEditNoteText}
              placeholder="e.g. dinner + drinks"
              placeholderTextColor={colors.mutedForeground}
              testID="edit-payment-note-input"
            />
            {paymentEditError ? (
              <Text style={[styles.inlineErrorText, { color: colors.destructive ?? "#ef4444", marginTop: 4 }]} testID="edit-payment-error">
                {paymentEditError}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Request Payment Review Modal ────────────────────────────────────── */}
      <Modal
        visible={showRequestPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeRequestPaymentModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={closeRequestPaymentModal}
              testID="payment-modal-cancel"
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Payment</Text>
            <View style={{ width: 60 }} />
          </View>

          {(() => {
            const savedSetupZelleIsInvalid =
              !!myProfile?.zelleInfo && !isValidZelleInfo(myProfile.zelleInfo);
            const needsSetup = !paymentSetupComplete &&
              !(myProfile?.cashAppHandle || myProfile?.venmoHandle ||
                (myProfile?.zelleInfo && !savedSetupZelleIsInvalid));

            if (needsSetup) {
              const methodLabel =
                paymentSetupMethod === "cash_app" ? "Cash App cashtag"
                : paymentSetupMethod === "venmo" ? "Venmo username"
                : "Zelle (email or phone)";
              const methodPlaceholder =
                paymentSetupMethod === "cash_app" ? "$yourtag"
                : paymentSetupMethod === "venmo" ? "@yourname"
                : "you@email.com";
              const zelleRealtimeError =
                paymentSetupMethod === "zelle" &&
                paymentSetupValue.trim().length > 0 &&
                !isValidZelleInfo(paymentSetupValue.trim())
                  ? "Enter a valid phone number or email address."
                  : null;
              const activeError = zelleRealtimeError ?? paymentSetupError;

              return (
                <ScrollView contentContainerStyle={styles.paymentModalContent} keyboardShouldPersistTaps="handled">
                  <View style={[styles.paymentSetupIconRow]}>
                    <Text style={styles.paymentSetupIcon}>💸</Text>
                  </View>
                  <Text style={[styles.paymentSetupTitle, { color: colors.foreground }]}>
                    Add a payment method
                  </Text>
                  <Text style={[styles.paymentSetupSubtitle, { color: colors.mutedForeground }]}>
                    Guests need somewhere to send money. Add at least one so they know how to pay you.
                  </Text>

                  {/* Method picker */}
                  <View style={styles.paymentMethodPills}>
                    {(["cash_app", "venmo", "zelle"] as const).map((m) => {
                      const label = m === "cash_app" ? "Cash App" : m === "venmo" ? "Venmo" : "Zelle";
                      const active = paymentSetupMethod === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => { setPaymentSetupMethod(m); setPaymentSetupValue(""); setPaymentSetupError(null); }}
                          style={[
                            styles.paymentMethodPill,
                            active
                              ? { backgroundColor: colors.primary, borderColor: colors.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}
                          testID={`payment-method-pill-${m}`}
                        >
                          <Text style={[
                            styles.paymentMethodPillText,
                            { color: active ? "#fff" : colors.foreground },
                          ]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.paymentModalNoteLabel, { color: colors.mutedForeground }]}>
                    {methodLabel}
                  </Text>
                  {paymentSetupMethod === "zelle" && savedSetupZelleIsInvalid && (
                    <Pressable
                      style={styles.zelleWarningBanner}
                      onPress={() => paymentSetupInputRef.current?.focus()}
                      testID="zelle-invalid-warning"
                    >
                      <Text style={styles.zelleWarningIcon}>⚠️</Text>
                      <View style={styles.zelleWarningBody}>
                        <Text style={styles.zelleWarningTitle}>Guests can't read your Zelle info</Text>
                        <Text style={styles.zelleWarningSubtitle}>
                          The saved value isn't a valid phone number or email address. Tap to fix it.
                        </Text>
                      </View>
                    </Pressable>
                  )}
                  <TextInput
                    ref={paymentSetupInputRef}
                    style={[
                      styles.paymentModalNoteInput,
                      { color: colors.foreground, borderColor: activeError ? (colors.destructive ?? "#ef4444") : colors.border, backgroundColor: colors.card },
                    ]}
                    value={paymentSetupValue}
                    onChangeText={(t) => { setPaymentSetupValue(t); setPaymentSetupError(null); }}
                    placeholder={methodPlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    testID="payment-setup-input"
                  />
                  {activeError && (
                    <Text style={[styles.inlineErrorText, { color: colors.destructive ?? "#ef4444" }]} testID="payment-setup-error">
                      {activeError}
                    </Text>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      styles.sendRequestsBtn,
                      { backgroundColor: colors.primary, opacity: pressed || paymentSetupSaving || !!zelleRealtimeError ? 0.5 : 1 },
                    ]}
                    onPress={handleSavePaymentSetup}
                    disabled={paymentSetupSaving || !!zelleRealtimeError}
                    testID="payment-setup-save-button"
                  >
                    {paymentSetupSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.sendRequestsBtnText, { color: colors.primaryForeground }]}>
                        Save & Continue →
                      </Text>
                    )}
                  </Pressable>

                  <Text style={[styles.paymentModalHint, { color: colors.mutedForeground, textAlign: "center" }]}>
                    This will be saved to your profile. You can update it anytime in Settings.
                  </Text>
                </ScrollView>
              );
            }

            return (
              <ScrollView contentContainerStyle={styles.paymentModalContent} keyboardShouldPersistTaps="handled">
                {data?.title ? (
                  <Text style={[styles.paymentModalSubtitle, { color: colors.mutedForeground }]}>
                    {data.title}
                    {data.startsAt
                      ? ` · ${new Date(data.startsAt).toLocaleDateString([], { month: "short", day: "numeric" })}`
                      : ""}
                  </Text>
                ) : null}

                {guestAmountsForModal.map(({ userId, displayName, amountCents }) => (
                  <View
                    key={userId}
                    style={[styles.paymentModalGuestRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.paymentModalAvatar, { backgroundColor: avatarBg(userId ?? 0) }]}>
                      <Text style={styles.paymentModalAvatarText}>{initials(displayName)}</Text>
                    </View>
                    <Text
                      style={[styles.paymentModalGuestName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {firstName(displayName)}
                    </Text>
                    <Text style={[styles.paymentModalGuestAmount, { color: colors.foreground }]}>
                      {formatCents(amountCents)}
                    </Text>
                  </View>
                ))}

                <Text style={[styles.paymentModalNoteLabel, { color: colors.mutedForeground }]}>
                  Note (optional)
                </Text>
                <TextInput
                  style={[
                    styles.paymentModalNoteInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                  value={paymentRequestNote}
                  onChangeText={setPaymentRequestNote}
                  placeholder='e.g. "Dinner — tip included"'
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                  testID="payment-request-note-input"
                />
                <Text style={[styles.paymentModalHint, { color: colors.mutedForeground }]}>
                  Amounts are computed from the bill. Guests will see their total.
                </Text>
                {(() => {
                  const savedModalZelleIsInvalid =
                    !!myProfile?.zelleInfo && !isValidZelleInfo(myProfile.zelleInfo);
                  const configuredMethods: string[] = [
                    ...(myProfile?.cashAppHandle ? ["Cash App"] : []),
                    ...(myProfile?.venmoHandle ? ["Venmo"] : []),
                    ...((myProfile?.zelleInfo && !savedModalZelleIsInvalid) ? ["Zelle"] : []),
                  ];
                  if (configuredMethods.length === 1) {
                    return (
                      <View style={[styles.coverageWarningBanner, { backgroundColor: "#FEF3C7", borderColor: "#D97706" }]} testID="payment-coverage-warning">
                        <Text style={styles.coverageWarningIcon}>⚠️</Text>
                        <View style={styles.coverageWarningBody}>
                          <Text style={[styles.coverageWarningText, { color: "#92400E" }]}>
                            You only have {configuredMethods[0]} set up — guests who don't use {configuredMethods[0]} won't be able to pay you.
                          </Text>
                          <Pressable
                            onPress={() => {
                              closeRequestPaymentModal();
                              router.push("/(tabs)/profile" as Href);
                            }}
                            testID="payment-coverage-go-to-profile"
                          >
                            <Text style={[styles.coverageWarningLink, { color: "#D97706" }]}>Add more methods in Profile →</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const atLimit = freeEventLimit !== null && !rcIsSubscribed && hostedEventsSent >= freeEventLimit;
                  const nearLimit = freeEventLimit !== null && !rcIsSubscribed && hostedEventsSent === freeEventLimit - 1;
                  const btnColor = atLimit ? "#9CA3AF" : colors.primary;
                  return (
                    <>
                      <Pressable
                        style={({ pressed }) => [
                          styles.sendRequestsBtn,
                          {
                            backgroundColor: btnColor,
                            opacity: pressed || isCreatingPaymentRequests ? 0.85 : 1,
                          },
                        ]}
                        onPress={() => {
                          if (atLimit) {
                            setShowPaywallModal(true);
                          } else {
                            handleSendPaymentRequests();
                          }
                        }}
                        disabled={isCreatingPaymentRequests}
                        testID="send-payment-requests-button"
                      >
                        {isCreatingPaymentRequests ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : atLimit ? (
                          <Text style={[styles.sendRequestsBtnText, { color: "#fff" }]}>
                            Upgrade to Send More →
                          </Text>
                        ) : (
                          <Text style={[styles.sendRequestsBtnText, { color: colors.primaryForeground }]}>
                            Send Payment Requests
                          </Text>
                        )}
                      </Pressable>
                      {!rcIsSubscribed && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: nearLimit ? "#D97706" : colors.mutedForeground,
                            fontWeight: nearLimit ? "600" : "400",
                            textAlign: "center",
                            marginTop: 6,
                            fontFamily: nearLimit ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular",
                          }}
                          testID="free-events-counter"
                        >
                          {atLimit
                            ? `You've used all ${freeEventLimit ?? "—"} free events`
                            : `${hostedEventsSent} of ${freeEventLimit ?? "—"} free events used${nearLimit ? " — 1 remaining" : ""}`}
                        </Text>
                      )}
                    </>
                  );
                })()}
                {paymentRequestError && (
                  <Text style={[styles.inlineErrorText, { color: colors.destructive ?? "#ef4444", textAlign: "center", marginTop: 8 }]} testID="payment-request-error">
                    {paymentRequestError}
                  </Text>
                )}
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* ── OCR Draft Review Modal ──────────────────────────────────────────── */}
      <Modal
        visible={ocrDraft !== null && isDraftModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          // Hardware back / swipe-down: treat as "Keep" — hide the sheet but
          // preserve the draft so it reopens on the next visit.
          setIsDraftModalVisible(false);
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Scanned Items</Text>
            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={handleCloseDraft}
              testID="ocr-draft-close"
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView
            ref={ocrDraftScrollRef}
            contentContainerStyle={styles.ocrDraftContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            {ocrDraft?.warning && (
              <Pressable
                onPress={scrollToFirstSuspicious}
                style={({ pressed }) => [styles.ocrWarningBanner, { backgroundColor: "#FFF3CD", borderColor: "#FBBF24", opacity: pressed ? 0.8 : 1 }]}
                testID="ocr-warning-banner"
              >
                <Text style={styles.ocrWarningText}>{ocrDraft.warning}</Text>
                <Text style={styles.ocrWarningTapHint}>Tap to scroll to suspicious row</Text>
              </Pressable>
            )}
            <Text style={[styles.ocrDraftHint, { color: colors.mutedForeground }]}>
              Review and edit before saving. Delete any incorrect items.
            </Text>
            {hasDraftDuplicates(draftItems) && (
              <Pressable
                style={({ pressed }) => [
                  styles.mergeDuplicatesBtn,
                  { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleMergeDuplicates}
                testID="ocr-merge-duplicates"
              >
                <Text style={[styles.mergeDuplicatesBtnText, { color: colors.primary }]}>
                  Merge duplicates
                </Text>
              </Pressable>
            )}
            {draftItems.length === 0 && (
              <View style={[styles.emptyBox, { borderColor: colors.border, marginBottom: 16 }]}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No items detected. Try a clearer photo.
                </Text>
              </View>
            )}
            {draftItems.map((item) => {
              const rowErr = draftErrors[item.localId];
              return (
                <View
                  key={item.localId}
                  style={[styles.draftItemRow, { borderColor: rowErr ? "#EF4444" : colors.border, backgroundColor: colors.card }]}
                  testID={`draft-item-${item.localId}`}
                  onLayout={(e) => { draftItemLayouts.current[item.localId] = e.nativeEvent.layout.y; }}
                >
                  <View style={styles.draftItemFields}>
                    <TextInput
                      style={[styles.draftItemNameInput, { color: colors.foreground, borderColor: rowErr?.name ? "#EF4444" : colors.border, backgroundColor: colors.background }]}
                      value={item.name}
                      onChangeText={(v) => handleDraftItemChange(item.localId, "name", v)}
                      placeholder="Item name"
                      placeholderTextColor={colors.mutedForeground}
                      testID={`draft-item-name-${item.localId}`}
                    />
                    {rowErr?.name && (
                      <Text style={styles.draftFieldError}>{rowErr.name}</Text>
                    )}
                    <View style={styles.draftItemPriceRow}>
                      <TextInput
                        style={[styles.draftItemQtyInput, { color: colors.foreground, borderColor: rowErr?.quantity ? "#EF4444" : colors.border, backgroundColor: colors.background }]}
                        value={item.quantity}
                        onChangeText={(v) => handleDraftItemChange(item.localId, "quantity", v)}
                        placeholder="Qty"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        testID={`draft-item-qty-${item.localId}`}
                      />
                      <TextInput
                        style={[styles.draftItemPriceInput, { color: colors.foreground, borderColor: rowErr?.priceStr ? "#EF4444" : colors.border, backgroundColor: colors.background }]}
                        value={item.priceStr}
                        onChangeText={(v) => handleDraftItemChange(item.localId, "priceStr", v)}
                        placeholder="Price"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        testID={`draft-item-price-${item.localId}`}
                      />
                    </View>
                    {(() => {
                      const draftQty = parseInt(item.quantity.trim(), 10);
                      const draftPrice = parseFloat(item.priceStr.trim().replace(/^\$/, ""));
                      if (!isNaN(draftQty) && draftQty > 1 && !isNaN(draftPrice) && draftPrice > 0) {
                        const unitCents = Math.round(draftPrice * 100);
                        const totalCents = Math.round(draftPrice * draftQty * 100);
                        return (
                          <Text style={[styles.draftLineTotalText, { color: colors.mutedForeground }]}>
                            {draftQty} × {formatCents(unitCents)} = {formatCents(totalCents)}
                          </Text>
                        );
                      }
                      return null;
                    })()}
                    {rowErr?.quantity && (
                      <Text style={styles.draftFieldError}>{rowErr.quantity}</Text>
                    )}
                    {rowErr?.priceStr && (
                      <Text style={styles.draftFieldError}>{rowErr.priceStr}</Text>
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.draftItemDeleteBtn, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => handleDeleteDraftItem(item.localId)}
                    testID={`draft-item-delete-${item.localId}`}
                  >
                    <Text style={styles.draftItemDeleteText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.addMissingItemBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={handleAddDraftItem}
              testID="ocr-add-missing-item"
            >
              <Text style={[styles.addMissingItemBtnText, { color: colors.primary }]}>+ Add Missing Item</Text>
            </Pressable>

            {ocrDraft && (ocrDraft.subtotal || ocrDraft.serviceFee || ocrDraft.tax || ocrDraft.total) && (() => {
              const itemsTotalCents = draftItems.reduce((sum, item) => {
                const qty = parseInt(item.quantity.trim(), 10);
                const price = parseFloat(item.priceStr.trim().replace(/^\$/, ""));
                if (!isNaN(qty) && qty >= 1 && !isNaN(price) && price > 0) {
                  return sum + Math.round(price * qty * 100);
                }
                return sum;
              }, 0);
              const receiptRef = ocrDraft.subtotal ?? ocrDraft.total ?? null;
              const receiptRefCents = receiptRef !== null ? Math.round(parseFloat(receiptRef) * 100) : null;
              const diffCents = receiptRefCents !== null ? Math.abs(itemsTotalCents - receiptRefCents) : null;
              const isMatch = diffCents !== null && diffCents <= 1;

              return (
                <View style={[styles.draftTotalsBox, { borderColor: isMatch ? "#16A34A" : colors.border, backgroundColor: colors.card }]}>
                  {receiptRefCents !== null && (
                    <View style={styles.draftReconcilSection}>
                      <View style={styles.draftReconcilRow}>
                        <Text style={[styles.draftReconcilLabel, { color: colors.mutedForeground }]}>Items total</Text>
                        <Text style={[styles.draftReconcilValue, { color: colors.foreground }]}>{formatCents(itemsTotalCents)}</Text>
                      </View>
                      <View style={styles.draftReconcilRow}>
                        <Text style={[styles.draftReconcilLabel, { color: colors.mutedForeground }]}>
                          Receipt {ocrDraft.subtotal ? "subtotal" : "total"}
                        </Text>
                        <Text style={[styles.draftReconcilValue, { color: colors.foreground }]}>{formatCents(receiptRefCents)}</Text>
                      </View>
                      {isMatch ? (
                        <Text style={styles.draftReconcilSuccess}>✓ Totals match receipt</Text>
                      ) : (
                        <Text style={styles.draftReconcilWarning}>
                          Difference: {formatCents(diffCents ?? 0)}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={[styles.draftTotalsTitle, { color: colors.foreground }]}>
                    Detected Totals (will be saved)
                  </Text>
                  {ocrDraft.subtotal && (
                    <Text style={[styles.draftTotalsLine, { color: colors.mutedForeground }]}>
                      Subtotal: ${ocrDraft.subtotal}
                    </Text>
                  )}
                  {ocrDraft.serviceFee && (
                    <Text style={[styles.draftTotalsLine, { color: colors.mutedForeground }]}>
                      Service Fee: ${ocrDraft.serviceFee}
                    </Text>
                  )}
                  {ocrDraft.tax && (
                    <Text style={[styles.draftTotalsLine, { color: colors.mutedForeground }]}>
                      Tax: ${ocrDraft.tax}
                    </Text>
                  )}
                  {ocrDraft.total && (
                    <Text style={[styles.draftTotalsLine, { color: colors.mutedForeground }]}>
                      Total: ${ocrDraft.total}
                    </Text>
                  )}
                </View>
              );
            })()}
            <Pressable
              style={({ pressed }) => [
                styles.confirmDraftBtn,
                { backgroundColor: colors.primary, opacity: pressed || isConfirmingDraft ? 0.7 : 1 },
              ]}
              onPress={handleConfirmDraft}
              disabled={isConfirmingDraft}
              testID="ocr-confirm-items"
            >
              {isConfirmingDraft ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.confirmDraftBtnText, { color: colors.primaryForeground }]}>
                  Confirm Items
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Full-screen photo viewer ────────────────────────────────────────── */}
      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.galleryViewerOverlay}>
          {/* Animated dark background — fades while dragging */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.galleryViewerBg, viewerBgAnimStyle]} />
          {/* Gesture-driven photo layer — moves and scales while dragging */}
          <GestureDetector gesture={closeGesture}>
            <Animated.View style={viewerContentAnimStyle}>
              <FlatList
                ref={viewerFlatListRef}
                data={eventPhotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewerIndex ?? 0}
                getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
                onViewableItemsChanged={onViewerViewableItemsChanged}
                viewabilityConfig={viewerViewabilityConfig}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.galleryViewerPage}>
                    <Image
                      source={{ uri: item.signedImageUrl ?? undefined }}
                      style={styles.galleryViewerImage}
                      contentFit="contain"
                      testID={`gallery-viewer-image-${item.id}`}
                    />
                  </View>
                )}
              />
            </Animated.View>
          </GestureDetector>
          {/* Counter and close button sit above the gesture layer */}
          <Pressable
            style={styles.galleryViewerClose}
            onPress={() => setViewerIndex(null)}
            testID="gallery-viewer-close"
          >
            <Text style={styles.galleryViewerCloseText}>✕</Text>
          </Pressable>
          <Text style={styles.galleryViewerCounter} testID="gallery-viewer-counter">
            {currentViewerPage + 1} of {eventPhotos.length}
          </Text>
          {(() => {
            const photo = eventPhotos[currentViewerPage];
            const uploader = photo ? uploaderMap.get(photo.uploadedByUserId) : undefined;
            if (!uploader) return null;
            const name = firstName(uploader.displayName) || `@${uploader.handle}`;
            return (
              <Text style={styles.galleryViewerUploader} testID="gallery-viewer-uploader">
                by {name} (@{uploader.handle})
              </Text>
            );
          })()}
        </View>
      </Modal>

      {/* ── Bulk Split Participant Picker Modal ─────────────────────────────── */}
      <Modal
        visible={bulkSplitModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBulkSplitModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Split with…</Text>
              <Text style={[styles.assignModalSubtitle, { color: colors.mutedForeground }]}>
                {selectedItemIds.size} {selectedItemIds.size === 1 ? "item" : "items"} selected
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => setBulkSplitModalVisible(false)}
              testID="bulk-split-modal-cancel"
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[styles.modalList, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.assignModalHint, { color: colors.mutedForeground }]}>
              Select who to split these items with.
            </Text>
            {activeParticipants.map((p) => {
              const key = pKey(p);
              const isSelected = bulkSplitKeys.has(key);
              const isMe = p.userId === myUserId;
              const isGuest = p.role === "guest";
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.assignModalRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primary + "0d" },
                    pressed && { opacity: 0.65 },
                  ]}
                  onPress={() => {
                    setBulkSplitKeys((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) { next.delete(key); } else { next.add(key); }
                      return next;
                    });
                  }}
                  testID={isMe ? "bulk-split-select-me" : undefined}
                >
                  <View style={[styles.assignModalAvatar, { backgroundColor: avatarBg(key) }]}>
                    <Text style={styles.assignModalAvatarText}>{initials(p.displayName)}</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text
                      style={[styles.assignModalName, { color: colors.foreground, fontFamily: isMe ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular", flex: 1 }]}
                      numberOfLines={1}
                    >
                      {isMe ? `You (${firstName(p.displayName)})` : p.displayName}
                    </Text>
                    {isGuest && (
                      <View style={[styles.guestBadge, { borderColor: colors.border }]}>
                        <Text style={[styles.guestBadgeText, { color: colors.mutedForeground }]}>Guest</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.bulkSplitCheck, isSelected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}>
                    {isSelected && <Text style={styles.bulkSplitCheckText}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.bulkSplitFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Pressable
              style={({ pressed }) => [
                styles.bulkSplitConfirmBtn,
                { backgroundColor: colors.primary, opacity: pressed || isBulkPending || bulkSplitKeys.size === 0 ? 0.5 : 1 },
              ]}
              onPress={confirmBulkSplit}
              disabled={isBulkPending || bulkSplitKeys.size === 0}
              testID="bulk-split-confirm-btn"
            >
              {isBulkPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.bulkSplitConfirmText, { color: colors.primaryForeground }]}>
                  Assign to {selectedItemIds.size} {selectedItemIds.size === 1 ? "item" : "items"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Item Assignment Modal ───────────────────────────────────────────── */}
      <Modal
        visible={assigningItemId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAssigningItemId(null)}
      >
        {(() => {
          const assignItem = assigningItemId !== null ? items.find((i) => i.id === assigningItemId) : null;
          if (!assignItem) return null;
          const assignClaimers = activeClaimersFor(assignItem.id);
          const assignTotalCents = Math.round(parseFloat(assignItem.price) * assignItem.quantity * 100);
          const assignPerPersonCents = assignClaimers.length > 1 ? Math.round(assignTotalCents / assignClaimers.length) : 0;

          return (
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {assignItem.name}
                  </Text>
                  <Text style={[styles.assignModalSubtitle, { color: colors.mutedForeground }]}>
                    {assignItem.quantity > 1
                      ? `${assignItem.quantity} × ${formatCents(Math.round(parseFloat(assignItem.price) * 100))} = ${formatCents(assignTotalCents)}`
                      : formatCents(assignTotalCents)}
                    {assignPerPersonCents > 0 ? `  \u00b7  ${formatCents(assignPerPersonCents)} / person` : ""}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={() => setAssigningItemId(null)}
                  testID="assign-modal-close"
                >
                  <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Done</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={[styles.modalList, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
                <Text style={[styles.assignModalHint, { color: colors.mutedForeground }]}>
                  {isHost ? "Tap any participant to assign or unassign" : "Tap your name to claim or unclaim this item"}
                </Text>

                {activeParticipants.map((p) => {
                  const pk = pKey(p);
                  const isAssigned = assignClaimers.some((c) => aKey(c) === pk);
                  const isMe = p.userId === myUserId;
                  const isGuest = p.role === "guest";
                  const canInteract = (isHost || isMe) && !isCancelled;
                  const isLoadingMe = isMe && claimingItemId === assigningItemId;
                  const isLoadingHost = !isMe && togglingUserId === pk;
                  const isLoading = isLoadingMe || isLoadingHost;

                  return (
                    <Pressable
                      key={pk}
                      style={({ pressed }) => [
                        styles.assignModalRow,
                        { borderBottomColor: colors.border },
                        isAssigned && { backgroundColor: colors.primary + "0d" },
                        !canInteract && { opacity: 0.45 },
                        pressed && canInteract && { opacity: 0.65 },
                      ]}
                      onPress={() => {
                        if (!canInteract || isLoading) return;
                        if (isMe) {
                          handleToggleClaim(assignItem.id);
                        } else if (isHost) {
                          handleHostAssign(assignItem.id, pk, !isAssigned);
                        }
                      }}
                      disabled={!canInteract}
                      testID={isMe ? `assign-me-${assignItem.id}` : undefined}
                    >
                      <View style={[
                        styles.assignModalAvatar,
                        { backgroundColor: avatarBg(pk) },
                        isGuest && { borderWidth: 1.5, borderStyle: "dashed" as const, borderColor: "#64748b" },
                      ]}>
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.assignModalAvatarText}>{initials(p.displayName)}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.assignModalName, { color: colors.foreground, fontFamily: isMe ? "PlusJakartaSans_600SemiBold" : "PlusJakartaSans_400Regular" }]}
                          numberOfLines={1}
                        >
                          {isMe ? `You (${firstName(p.displayName)})` : p.displayName}
                        </Text>
                        {isGuest && (
                          <Text style={[styles.assignModalSubtitle, { color: colors.mutedForeground, fontSize: 11 }]}>guest</Text>
                        )}
                      </View>
                      {isAssigned && !isLoading && (
                        <View style={[styles.assignedBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.assignedBadgeText}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                {isHost && !isCancelled && (
                  <Pressable
                    style={[styles.assignModalDeleteRow, { borderTopColor: colors.border }]}
                    onPress={() => {
                      handleDeleteItem(assignItem.id);
                      setAssigningItemId(null);
                    }}
                    testID={`delete-item-${assignItem.id}`}
                  >
                    <Text style={[styles.assignModalDeleteText, { color: colors.destructive ?? "#ef4444" }]}>
                      Delete Item
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Edit Event Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.flex, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.editModalHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowEditModal(false)}
              testID="edit-modal-cancel"
            >
              <Text style={[styles.editModalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.editModalTitle, { color: colors.foreground }]}>Edit Event</Text>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed || isUpdatingEvent ? 0.55 : 1 }]}
              onPress={handleSaveEdit}
              disabled={isUpdatingEvent}
              testID="edit-modal-save"
            >
              {isUpdatingEvent
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Text style={[styles.editModalSaveText, { color: colors.primary }]}>Save</Text>}
            </Pressable>
          </View>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.editModalContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <TextInput
              style={[styles.editFormInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editTitle}
              onChangeText={(v) => { setEditTitle(v); setEditError(null); }}
              placeholder="Event title *"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              testID="edit-title-input"
            />
            <TextInput
              style={[styles.editFormInput, styles.editCityOrZipInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={editCityOrZip}
              onChangeText={setEditCityOrZip}
              placeholder="City or ZIP (optional)"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              autoCapitalize="words"
              autoCorrect={false}
              testID="edit-city-zip-input"
            />
            <View>
              <View style={[styles.editDestinationRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.editDestinationInput, { color: colors.foreground }]}
                  value={editDestinationSelected ? editDestinationSelected.name : editDestinationQuery}
                  onChangeText={handleEditDestinationChange}
                  onFocus={requestEditLocationOnce}
                  placeholder="Destination *"
                  placeholderTextColor={colors.mutedForeground}
                  editable={!editDestinationSelected}
                  returnKeyType="search"
                  testID="edit-destination-input"
                />
                {(editDestinationSelected !== null || editDestinationQuery.length > 0) && (
                  <Pressable onPress={clearEditDestination} style={styles.editDestinationClearBtn} testID="edit-destination-clear">
                    <Text style={[styles.editDestinationClearText, { color: colors.mutedForeground }]}>×</Text>
                  </Pressable>
                )}
              </View>
              {editLocationDenied && (
                <Text style={[styles.editLocationHint, { color: colors.mutedForeground }]}>
                  ⓘ Allow location access for nearby results
                </Text>
              )}
              {editDestinationLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4, alignSelf: "center" }} />
              )}
              {editDestinationResults.length > 0 && !editDestinationSelected && (
                <View style={[styles.editDestinationResultsList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  {editDestinationResults.map((result) => (
                    <Pressable
                      key={result.placeId}
                      style={({ pressed }) => [
                        styles.editDestinationResultItem,
                        { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" },
                      ]}
                      onPress={() => selectEditDestination(result)}
                    >
                      <Text style={[styles.editDestinationResultName, { color: colors.foreground }]} numberOfLines={1}>{result.name}</Text>
                      {result.address ? (
                        <Text style={[styles.editDestinationResultAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{result.address}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.editDateTimeRow}>
              <Pressable
                style={[styles.editPickerBtn, { borderColor: colors.border, backgroundColor: colors.card, flex: 2 }]}
                onPress={() => { setEditShowTimePicker(false); setEditShowDatePicker((v) => !v); }}
                testID="edit-date-input"
              >
                <Text style={[styles.editPickerBtnText, { color: editPickedDate ? colors.foreground : colors.mutedForeground }]}>
                  {editPickedDate
                    ? editPickedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                    : "Date *"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.editPickerBtn, { borderColor: colors.border, backgroundColor: colors.card, flex: 1 }, !editPickedDate && styles.editPickerBtnDisabled]}
                onPress={() => { setEditShowDatePicker(false); setEditShowTimePicker((v) => !v); }}
                disabled={!editPickedDate}
                testID="edit-time-input"
              >
                <Text style={[styles.editPickerBtnText, { color: editPickedDate ? colors.foreground : colors.mutedForeground }]}>
                  {editPickedDate
                    ? editPickedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                    : "Time *"}
                </Text>
              </Pressable>
            </View>
            {editShowDatePicker && (
              <View style={[styles.editDatePickerWrapper, { backgroundColor: colors.background }]}>
                <DateTimePicker
                  value={editPickedDate ?? new Date()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  onChange={(_e, selected) => {
                    if (Platform.OS === "android") setEditShowDatePicker(false);
                    if (selected) {
                      setEditPickedDate((prev) => {
                        const d = new Date(selected);
                        if (prev) { d.setHours(prev.getHours(), prev.getMinutes(), 0, 0); }
                        else { d.setHours(12, 0, 0, 0); }
                        return d;
                      });
                    }
                  }}
                />
              </View>
            )}
            {editShowTimePicker && editPickedDate && (
              <View style={[styles.editTimePickerWrapper, { backgroundColor: colors.background }]}>
                <DateTimePicker
                  value={editPickedDate}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  themeVariant="light"
                  onChange={(_e, selected) => {
                    if (Platform.OS === "android") setEditShowTimePicker(false);
                    if (selected) {
                      setEditHasPickedTime(true);
                      setEditPickedDate((prev) => {
                        const d = new Date(prev ?? selected);
                        d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                        return d;
                      });
                    }
                  }}
                />
              </View>
            )}
            {editError && (
              <Text style={[styles.editErrorText, { color: colors.destructive ?? "#ef4444" }]} testID="edit-error-text">
                {editError}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Invite Friends Modal ───────────────────────────────────────────── */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowInviteModal(false);
          setInviteSearchQuery("");
          setSelectedInviteIds(new Set());
          setContactAppUsers([]);
          setShowQRPanel(false);
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invite</Text>
            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => {
                setShowInviteModal(false);
                setInviteSearchQuery("");
                setSelectedInviteIds(new Set());
                setContactAppUsers([]);
                setShowQRPanel(false);
              }}
              testID="close-invite-modal"
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>

          {/* QR actions row */}
          <View style={[styles.qrActionsRow, { borderBottomColor: colors.border }]}>
            {isHost && (
              <Pressable
                style={[styles.qrActionRowBtn, { backgroundColor: showQRPanel ? colors.primary : colors.secondary, borderColor: colors.border }]}
                onPress={() => setShowQRPanel((p) => !p)}
                testID="toggle-qr-panel-btn"
              >
                <Ionicons name="qr-code-outline" size={16} color={showQRPanel ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.qrActionRowBtnText, { color: showQRPanel ? colors.primaryForeground : colors.foreground }]}>QR Code</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.qrActionRowBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => { void handleOpenScanner(); }}
              testID="scan-qr-btn"
            >
              <Ionicons name="scan-outline" size={16} color={colors.foreground} />
              <Text style={[styles.qrActionRowBtnText, { color: colors.foreground }]}>Scan QR</Text>
            </Pressable>
          </View>

          {/* QR code panel — host only, expandable */}
          {isHost && showQRPanel && (
            <View style={[styles.qrPanel, { borderBottomColor: colors.border }]}>
              {eventJoinCode ? (
                <>
                  <View ref={qrContainerRef} style={styles.qrCodeWrapper} collapsable={false}>
                    <QRCode
                      value={process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/join/${eventJoinCode}` : `owmo://join/${eventJoinCode}`}
                      size={200}
                      color="#C2410C"
                      backgroundColor="#ffffff"
                      ecl="H"
                    />
                    <Text style={[styles.qrEventLabel, { color: "#1C1917" }]} numberOfLines={2}>
                      {data?.title ?? "Event"}
                    </Text>
                  </View>
                  <View style={styles.qrPanelActions}>
                    <Pressable
                      style={({ pressed }) => [styles.qrPanelBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                      onPress={() => { void handleShareQRImage(); }}
                      testID="share-qr-btn"
                    >
                      <Ionicons name="share-outline" size={15} color={colors.primaryForeground} />
                      <Text style={[styles.qrPanelBtnText, { color: colors.primaryForeground }]}>Share QR</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.qrPanelBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.8 : 1 }]}
                      onPress={() => { void handleCopyJoinLink(); }}
                      testID="copy-join-link-btn"
                    >
                      <Ionicons name="copy-outline" size={15} color={colors.foreground} />
                      <Text style={[styles.qrPanelBtnText, { color: colors.foreground }]}>Copy link</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.generateQRBtn, { backgroundColor: colors.primary, opacity: pressed || isGeneratingQR ? 0.7 : 1 }]}
                  onPress={handleGenerateQRCode}
                  disabled={isGeneratingQR}
                  testID="generate-qr-btn"
                >
                  {isGeneratingQR ? (
                    <ActivityIndicator color={colors.primaryForeground} size="small" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={16} color={colors.primaryForeground} />
                      <Text style={[styles.qrPanelBtnText, { color: colors.primaryForeground }]}>Generate Invite QR</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {/* Search bar */}
          <View style={[styles.modalSearchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.modalSearchInput, { color: colors.foreground }]}
              value={inviteSearchQuery}
              onChangeText={setInviteSearchQuery}
              placeholder="Search friends or users…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="invite-search-input"
            />
            {isSearchingInvite && <ActivityIndicator size="small" color={colors.mutedForeground} />}
            {inviteSearchQuery.length > 0 && !isSearchingInvite && (
              <Pressable onPress={() => setInviteSearchQuery("")} testID="clear-invite-search">
                <Text style={[styles.modalSearchClear, { color: colors.mutedForeground }]}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Scrollable body */}
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.modalList, { paddingBottom: selectedInviteIds.size > 0 ? 100 : 20 }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            testID="invite-modal-list"
          >
            {/* ── App friends / contact app users / search results ── */}
            {modalUsers.length === 0 ? (
              <Text style={[styles.modalEmptyText, { color: colors.mutedForeground, marginBottom: 24 }]}>
                {inviteSearchDebounced.length >= 2
                  ? "No users found."
                  : friendsData?.friends.length === 0
                    ? "Add friends first to invite them, or search by name / handle."
                    : "All your friends are already in this event. Search to invite others."}
              </Text>
            ) : (
              <>
                {inviteSearchDebounced.length < 2 && (
                  <Text style={[styles.inviteSectionLabel, { color: colors.mutedForeground }]}>Friends</Text>
                )}
                {modalUsers.map((item) => {
                  const isSelected = selectedInviteIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.friendRow, { borderBottomColor: colors.border }]}
                      onPress={() => toggleInviteSelection(item.id)}
                      testID={`invite-friend-${item.id}`}
                    >
                      <View style={[styles.participantAvatar, { backgroundColor: avatarBg(item.id) }]}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={styles.participantAvatarImg} contentFit="cover" />
                        ) : (
                          <Text style={styles.participantAvatarText}>{initials(item.displayName)}</Text>
                        )}
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={[styles.participantName, { color: colors.foreground }]} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <View style={styles.participantHandleRow}>
                          <Text style={[styles.participantHandle, { color: colors.mutedForeground }]}>
                            @{item.handle}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isSelected ? colors.primary : colors.border}
                        testID={`invite-checkbox-${item.id}`}
                      />
                    </Pressable>
                  );
                })}
              </>
            )}

            {/* ── From Contacts ── */}
            {inviteSearchDebounced.length < 2 && (
              <View style={styles.contactsSection}>
                <Text style={[styles.inviteSectionLabel, { color: colors.mutedForeground }]}>From Contacts</Text>

                {contactsPermission === "undetermined" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactsPermBtn,
                      { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={handleRequestContactsPermission}
                    testID="allow-contacts-btn"
                  >
                    <Ionicons name="people-outline" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactsPermTitle, { color: colors.foreground }]}>
                        Allow access to contacts
                      </Text>
                      <Text style={[styles.contactsPermSubtitle, { color: colors.mutedForeground }]}>
                        Invite people who aren't on the app yet via text
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                )}

                {contactsPermission === "denied" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactsPermBtn,
                      { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => Linking.openSettings()}
                    testID="open-settings-btn"
                  >
                    <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactsPermTitle, { color: colors.foreground }]}>
                        Contacts access is off
                      </Text>
                      <Text style={[styles.contactsPermSubtitle, { color: colors.mutedForeground }]}>
                        Tap to enable in Settings
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </Pressable>
                )}

                {contactsPermission === "granted" && contactsLoading && (
                  <ActivityIndicator color={colors.mutedForeground} style={{ marginVertical: 16 }} />
                )}

                {contactsPermission === "granted" && !contactsLoading && contacts.length === 0 && (
                  <Text style={[styles.modalEmptyText, { color: colors.mutedForeground }]}>
                    No contacts with phone numbers found.
                  </Text>
                )}

                {contactsPermission === "granted" && !contactsLoading && contacts.map((contact) => (
                  <View
                    key={contact.id}
                    style={[styles.friendRow, { borderBottomColor: colors.border }]}
                    testID={`contact-row-${contact.id}`}
                  >
                    <View style={[styles.participantAvatar, { backgroundColor: "#94A3B8" }]}>
                      <Ionicons name="person" size={18} color="#fff" />
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={[styles.participantName, { color: colors.foreground }]} numberOfLines={1}>
                        {contact.name}
                      </Text>
                      <Text style={[styles.participantHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {contact.phoneNumbers?.[0]?.number ?? ""}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.sendInviteBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => handleContactSmsInvite(contact)}
                      testID={`contact-sms-btn-${contact.id}`}
                    >
                      <Text style={styles.sendInviteBtnText}>Text</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Sticky bulk-invite footer */}
          {selectedInviteIds.size > 0 && (
            <View style={[styles.inviteFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.bulkInviteBtn,
                  { backgroundColor: colors.primary, opacity: pressed || isBulkInviting ? 0.7 : 1 },
                ]}
                onPress={handleBulkInvite}
                disabled={isBulkInviting}
                testID="bulk-invite-btn"
              >
                {isBulkInviting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.bulkInviteBtnText}>
                    Invite {selectedInviteIds.size} {selectedInviteIds.size === 1 ? "person" : "people"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
      {/* ── QR Scanner Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showScannerModal}
        animationType="slide"
        onRequestClose={() => setShowScannerModal(false)}
        testID="qr-scanner-modal"
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {cameraPermission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={hasScanned ? undefined : handleQRCodeScanned}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
              <Text style={{ color: "#fff", fontSize: 16, textAlign: "center", fontFamily: "PlusJakartaSans_400Regular" }}>
                Camera access is required to scan QR codes.
              </Text>
            </View>
          )}
          <View style={styles.scannerOverlay} pointerEvents="none">
            <View style={styles.scannerReticle} />
            <Text style={styles.scannerHint}>Point at an invite QR code</Text>
          </View>
          <Pressable
            style={[styles.scannerCloseBtn, { top: insets.top + 16 }]}
            onPress={() => setShowScannerModal(false)}
            testID="close-scanner-btn"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* ── Receipt Photo Viewer ─────────────────────────────────────────── */}
      <Modal
        visible={receiptViewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptViewerIndex(null)}
        testID="receipt-viewer-modal"
      >
        <View style={styles.galleryViewerOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.galleryViewerBg, receiptBgAnimStyle]} />
          <GestureDetector gesture={receiptCloseGesture}>
            <Animated.View style={receiptContentAnimStyle}>
              <FlatList
                ref={receiptViewerFlatListRef}
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={receiptViewerIndex ?? 0}
                getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
                onViewableItemsChanged={onReceiptViewerViewableItemsChanged}
                viewabilityConfig={receiptViewerViewabilityConfig}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.galleryViewerPage}>
                    <Image
                      source={{ uri: item.signedImageUrl ?? undefined }}
                      style={styles.galleryViewerImage}
                      contentFit="contain"
                      testID={`receipt-viewer-image-${item.id}`}
                    />
                  </View>
                )}
              />
            </Animated.View>
          </GestureDetector>
          <Pressable
            style={styles.galleryViewerClose}
            onPress={() => setReceiptViewerIndex(null)}
            testID="receipt-viewer-close"
          >
            <Text style={styles.galleryViewerCloseText}>✕</Text>
          </Pressable>
          <Text style={styles.galleryViewerCounter} testID="receipt-viewer-counter">
            {currentReceiptViewerPage + 1} of {photos.length}
          </Text>
        </View>
      </Modal>

      {/* ── Paywall Modal ───────────────────────────────────────────────────── */}
      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onSubscribed={() => {
          void refetchCustomerInfo();
          setShowPaywallModal(false);
        }}
      />

      {/* ── Add Guest Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={showAddGuestModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowAddGuestModal(false); setAddGuestNameInput(""); setAddGuestSaveToggle(false); setAddGuestError(null); }}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Person</Text>
            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => { setShowAddGuestModal(false); setAddGuestNameInput(""); setAddGuestSaveToggle(false); setAddGuestError(null); }}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.addGuestBody}>
            {/* Saved contacts picker */}
            {(savedContactsData?.contacts ?? []).length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.addGuestSectionLabel, { color: colors.mutedForeground }]}>Saved Contacts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {(savedContactsData?.contacts ?? []).map((contact) => (
                    <Pressable
                      key={contact.id}
                      style={({ pressed }) => [
                        styles.savedContactChip,
                        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || isAddingGuest ? 0.6 : 1 },
                      ]}
                      onPress={() => handleAddSavedContact(contact)}
                      disabled={isAddingGuest}
                    >
                      <View style={[styles.savedContactChipAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.savedContactChipInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.savedContactChipName, { color: colors.foreground }]} numberOfLines={1}>{contact.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={[styles.addGuestDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.addGuestSectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>Or add a new person</Text>
              </View>
            )}

            {(savedContactsData?.contacts ?? []).length === 0 && (
              <Text style={[styles.addGuestHint, { color: colors.mutedForeground }]}>
                Add a person by name so you can assign bill items to them. They don't need the app.
              </Text>
            )}

            <TextInput
              style={[styles.addGuestInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder={'Name (e.g. "Alex")'}
              placeholderTextColor={colors.mutedForeground}
              value={addGuestNameInput}
              onChangeText={setAddGuestNameInput}
              autoFocus={(savedContactsData?.contacts ?? []).length === 0}
              returnKeyType="done"
              onSubmitEditing={handleAddGuest}
              maxLength={80}
              testID="add-guest-name-input"
            />

            {/* Save for future events toggle */}
            <View style={[styles.addGuestToggleRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.addGuestToggleLabel, { color: colors.foreground }]}>Save for future events</Text>
                <Text style={[styles.addGuestToggleSub, { color: colors.mutedForeground }]}>Lets you quickly re-add this person later</Text>
              </View>
              <Switch
                value={addGuestSaveToggle}
                onValueChange={setAddGuestSaveToggle}
                trackColor={{ true: colors.primary }}
                testID="add-guest-save-toggle"
              />
            </View>

            {addGuestError !== null && (
              <Text style={[styles.addGuestError, { color: colors.destructive ?? "#ef4444" }]}>{addGuestError}</Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.addGuestBtn,
                { backgroundColor: colors.primary, opacity: pressed || isAddingGuest || !addGuestNameInput.trim() ? 0.55 : 1 },
              ]}
              onPress={handleAddGuest}
              disabled={isAddingGuest || !addGuestNameInput.trim()}
              testID="add-guest-submit-btn"
            >
              {isAddingGuest ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.addGuestBtnText, { color: colors.primaryForeground }]}>Add Person</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Guest Payment Info Modal ─────────────────────────────────────── */}
      <Modal
        visible={!!guestPayInfoParticipant}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setGuestPayInfoParticipant(null); setGuestPayInfoScanning(null); }}
      >
        {guestPayInfoParticipant && (
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Payment Info — {guestPayInfoParticipant.displayName}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.modalCloseBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => { setGuestPayInfoParticipant(null); setGuestPayInfoScanning(null); }}
              >
                <Text style={[styles.modalCloseBtnText, { color: colors.primary }]}>Cancel</Text>
              </Pressable>
            </View>

            {guestPayInfoScanning ? (
              <View style={{ flex: 1 }}>
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data: raw }) => {
                    const parsed = parsePaymentQr(raw);
                    if (parsed.type === "cash_app") {
                      setGuestPayInfoCashApp(parsed.handle);
                      setGuestPayInfoScanning(null);
                    } else if (parsed.type === "venmo") {
                      setGuestPayInfoVenmo(parsed.handle);
                      setGuestPayInfoScanning(null);
                    } else {
                      Alert.alert("Unrecognized QR", "This QR code isn't a Cash App or Venmo code. Try a different one.", [
                        { text: "OK", onPress: () => setGuestPayInfoScanning(null) },
                      ]);
                    }
                  }}
                />
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#000a", padding: 24 }}>
                  <Text style={{ color: "#fff", textAlign: "center", marginBottom: 8 }}>
                    Point at a {guestPayInfoScanning === "cash_app" ? "Cash App" : "Venmo"} QR code
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.addGuestBtn, { opacity: pressed ? 0.7 : 1, backgroundColor: "#333" }]}
                    onPress={() => setGuestPayInfoScanning(null)}
                  >
                    <Text style={[styles.addGuestBtnText, { color: "#fff" }]}>Cancel Scan</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.addGuestBody}>
                <Text style={[styles.addGuestHint, { color: colors.mutedForeground, marginBottom: 8 }]}>
                  Tap "Scan QR" to read their QR code automatically, or type in the handle manually.
                  Info saved to their contact record so it carries over to future events.
                </Text>

                {/* Cash App */}
                <Text style={[styles.addGuestSectionLabel, { color: colors.mutedForeground }]}>Cash App handle</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  <TextInput
                    style={[styles.addGuestInput, { flex: 1, marginBottom: 0, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                    placeholder="$cashtag"
                    placeholderTextColor={colors.mutedForeground}
                    value={guestPayInfoCashApp}
                    onChangeText={setGuestPayInfoCashApp}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={50}
                    testID="guest-pay-info-cashapp-input"
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.cashAppTrackBtn,
                      { backgroundColor: "#00d63220", borderColor: "#00d632", opacity: pressed ? 0.7 : 1, paddingHorizontal: 12 },
                    ]}
                    onPress={() => setGuestPayInfoScanning("cash_app")}
                    testID="guest-pay-info-cashapp-scan"
                  >
                    <Text style={{ color: "#00d632", fontSize: 12, fontWeight: "600" }}>Scan QR</Text>
                  </Pressable>
                </View>

                {/* Venmo */}
                <Text style={[styles.addGuestSectionLabel, { color: colors.mutedForeground }]}>Venmo username</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  <TextInput
                    style={[styles.addGuestInput, { flex: 1, marginBottom: 0, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                    placeholder="username (without @)"
                    placeholderTextColor={colors.mutedForeground}
                    value={guestPayInfoVenmo}
                    onChangeText={setGuestPayInfoVenmo}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={50}
                    testID="guest-pay-info-venmo-input"
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.cashAppTrackBtn,
                      { backgroundColor: "#3d95ce20", borderColor: "#3d95ce", opacity: pressed ? 0.7 : 1, paddingHorizontal: 12 },
                    ]}
                    onPress={() => setGuestPayInfoScanning("venmo")}
                    testID="guest-pay-info-venmo-scan"
                  >
                    <Text style={{ color: "#3d95ce", fontSize: 12, fontWeight: "600" }}>Scan QR</Text>
                  </Pressable>
                </View>

                {/* Phone number */}
                <Text style={[styles.addGuestSectionLabel, { color: colors.mutedForeground }]}>Phone number (for SMS)</Text>
                <TextInput
                  style={[styles.addGuestInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  placeholder="+1 555 555 5555"
                  placeholderTextColor={colors.mutedForeground}
                  value={guestPayInfoPhone}
                  onChangeText={setGuestPayInfoPhone}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  maxLength={30}
                  testID="guest-pay-info-phone-input"
                />

                {guestPayInfoError && (
                  <Text style={[styles.addGuestError, { color: colors.destructive ?? "#ef4444" }]}>{guestPayInfoError}</Text>
                )}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(guestPayInfoCashApp || guestPayInfoVenmo || guestPayInfoPhone) && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.addGuestBtn,
                        { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        if (!guestPayInfoParticipant.guestParticipantId) return;
                        Alert.alert("Clear payment info?", "This will remove Cash App, Venmo, and phone number.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Clear",
                            style: "destructive",
                            onPress: () => {
                              updateGuestPaymentInfoMutate(
                                { eventId, guestParticipantId: guestPayInfoParticipant.guestParticipantId!, data: { cashAppHandle: null, venmoHandle: null, phoneNumber: null } },
                                { onSuccess: () => { setGuestPayInfoParticipant(null); refetch(); void refetchSavedContacts(); }, onError: () => setGuestPayInfoError("Failed to clear. Please try again.") },
                              );
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={[styles.addGuestBtnText, { color: colors.mutedForeground }]}>Clear</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [
                      styles.addGuestBtn,
                      { flex: 2, backgroundColor: colors.primary, opacity: pressed || guestPayInfoSaving || (!guestPayInfoCashApp.trim() && !guestPayInfoVenmo.trim() && !guestPayInfoPhone.trim()) ? 0.55 : 1 },
                    ]}
                    disabled={guestPayInfoSaving || (!guestPayInfoCashApp.trim() && !guestPayInfoVenmo.trim() && !guestPayInfoPhone.trim())}
                    onPress={() => {
                      if (!guestPayInfoParticipant.guestParticipantId) return;
                      setGuestPayInfoSaving(true);
                      setGuestPayInfoError(null);
                      const cashAppVal = guestPayInfoCashApp.trim() || null;
                      const venmoVal = guestPayInfoVenmo.trim() || null;
                      const phoneVal = guestPayInfoPhone.trim() || null;
                      updateGuestPaymentInfoMutate(
                        { eventId, guestParticipantId: guestPayInfoParticipant.guestParticipantId, data: { cashAppHandle: cashAppVal, venmoHandle: venmoVal, phoneNumber: phoneVal } },
                        {
                          onSuccess: () => {
                            setGuestPayInfoSaving(false);
                            setGuestPayInfoParticipant(null);
                            refetch();
                            void refetchSavedContacts();
                          },
                          onError: () => {
                            setGuestPayInfoSaving(false);
                            setGuestPayInfoError("Failed to save. Please try again.");
                          },
                        },
                      );
                    }}
                    testID="guest-pay-info-save-btn"
                  >
                    {guestPayInfoSaving ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.addGuestBtnText, { color: colors.primaryForeground }]}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </Modal>

      {/* ── Post-Add Guest Prompt ─────────────────────────────────────────── */}
      <Modal
        visible={!!postAddGuestParticipant}
        animationType="fade"
        transparent
        onRequestClose={() => setPostAddGuestParticipant(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#0007", justifyContent: "center", alignItems: "center", padding: 32 }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 24, width: "100%" }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 8 }]}>
              Save payment info?
            </Text>
            <Text style={[styles.paymentRequestHint, { color: colors.mutedForeground, marginBottom: 20 }]}>
              Want to save {postAddGuestParticipant?.displayName}'s Cash App or Venmo handle now? It'll be ready when you collect payment.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.cashAppTrackBtn,
                  { flex: 1, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setPostAddGuestParticipant(null)}
              >
                <Text style={[styles.cashAppTrackBtnText, { color: colors.mutedForeground }]}>Not Now</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.cashAppTrackBtn,
                  { flex: 2, backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => {
                  const p = postAddGuestParticipant!;
                  setPostAddGuestParticipant(null);
                  openGuestPayInfoModal(p);
                }}
                testID="post-add-guest-set-pay-info-btn"
              >
                <Text style={[styles.cashAppTrackBtnText, { color: colors.primaryForeground }]}>Set Up Payment Info</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  editBtn: { paddingVertical: 4, paddingLeft: 12 },
  editBtnText: { fontSize: 15, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  // Edit modal
  editModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  editModalTitle: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  editModalCancelText: { fontSize: 15, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium", minWidth: 60 },
  editModalSaveText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", minWidth: 60, textAlign: "right" },
  editModalContent: { padding: 16, gap: 10 },
  editFormInput: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  editCityOrZipInput: { fontSize: 13, paddingVertical: 8, opacity: 0.85 },
  editDestinationRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8 },
  editDestinationInput: { flex: 1, fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", paddingHorizontal: 12, paddingVertical: 10 },
  editDestinationClearBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  editDestinationClearText: { fontSize: 20, lineHeight: 22, fontFamily: "PlusJakartaSans_400Regular" },
  editLocationHint: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", marginTop: 3, paddingHorizontal: 2 },
  editDestinationResultsList: { borderWidth: 1, borderRadius: 8, marginTop: 2, overflow: "hidden" },
  editDestinationResultItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, gap: 2 },
  editDestinationResultName: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  editDestinationResultAddress: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  editDateTimeRow: { flexDirection: "row", gap: 8 },
  editPickerBtn: { height: 42, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  editPickerBtnText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  editPickerBtnDisabled: { opacity: 0.38 },
  editDatePickerWrapper: { borderRadius: 12, overflow: "hidden", marginTop: 4, marginHorizontal: -16 },
  editTimePickerWrapper: { borderRadius: 12, overflow: "hidden", marginTop: 4 },
  editErrorText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "PlusJakartaSans_400Regular" },
  retryBtn: { paddingVertical: 8 },
  retryText: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium" },
  // Event header (fixed above tabs)
  eventHeaderFixed: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventTitle: { fontSize: 22, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  privateBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  privateBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  eventRestaurant: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  destinationAddress: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", opacity: 0.8 },
  venueTbdBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(194,65,12,0.10)", borderWidth: 1, borderColor: "rgba(194,65,12,0.20)", marginTop: 1 },
  venueTbdBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#C2410C" },
  votingClosedBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(100,116,139,0.10)", borderWidth: 1, borderColor: "rgba(100,116,139,0.20)", marginTop: 1 },
  votingClosedBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#64748B" },
  tieBanner: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fbbf24" },
  tieBannerTitle: { fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", color: "#92400e" },
  tieBannerBody: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", color: "#92400e", marginTop: 2 },
  tiedLeaderCard: { borderWidth: 2, borderColor: "#f59e0b", borderRadius: 12, overflow: "hidden" as const },
  tiedLeaderBadge: { position: "absolute" as const, top: 8, right: 8, zIndex: 1, backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#f59e0b" },
  tiedLeaderBadgeText: { fontSize: 11, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", color: "#92400e" },
  tiedDivider: { flexDirection: "row" as const, alignItems: "center", gap: 8, marginVertical: 6 },
  tiedDividerLine: { flex: 1, height: 1 },
  tiedDividerLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular" },
  votingCountdownText: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", color: "#C2410C", opacity: 0.8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  eventDate: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  completedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  completedBadgeText: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  roleText: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  chatLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 1,
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 12,
  },
  // Tab content
  tabContent: { paddingHorizontal: 20, paddingTop: 20, gap: 0 },
  // Participants
  participantsActionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  participantActionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  participantsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  inviteBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  participantAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  participantAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  participantInfo: { flex: 1, gap: 1 },
  participantHandleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  participantName: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  participantHandle: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeBtnText: { fontSize: 20, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", marginBottom: 14 },
  createReceiptBtn: { height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  createReceiptText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  emptyBox: { borderWidth: 1, borderRadius: 14, borderStyle: "dashed", padding: 20, alignItems: "center", marginBottom: 14 },
  emptyText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  // Locked notice
  lockedCard: { borderWidth: 1, borderRadius: 18, padding: 24, marginBottom: 16, gap: 10, alignItems: "center" as const },
  lockedIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 4 },
  lockedIconEmoji: { fontSize: 26, lineHeight: 30 },
  lockedTitle: { fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", textAlign: "center" as const },
  lockedText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 20, textAlign: "center" as const, marginBottom: 4 },
  // Receipt totals edit form
  addItemForm: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginBottom: 16 },
  addItemTitle: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  totalsInputGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  totalsInputCell: { flex: 1, minWidth: "40%" as unknown as number, gap: 3 },
  totalsInputLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", opacity: 0.7 },
  input: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  priceQtyRow: { flexDirection: "row", gap: 8 },
  priceInput: { flex: 2 },
  qtyInput: { flex: 1 },
  addErrorText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  inlineErrorText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", marginTop: 6 },
  addBtn: { height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 0 },
  addBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  // Photos
  photoSection: { marginBottom: 16 },
  photoScroll: { paddingHorizontal: 14, gap: 8 },
  photoThumbContainer: { alignItems: "center", gap: 6 },
  photoThumbWrap: { width: 108, height: 108, borderRadius: 12, overflow: "hidden", position: "relative" },
  scanPhotoBtn: { height: 26, width: 108, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  scanPhotoBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  photoThumbImage: { width: 108, height: 108, borderRadius: 12 },
  photoDeleteBtn: { position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  photoDeleteText: { color: "#fff", fontSize: 14, lineHeight: 16, fontWeight: "700" },
  addPhotoBtn: { height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  addPhotoText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 8, marginTop: 12 },
  galleryThumb: { width: (Dimensions.get("window").width - 40 - 8) / 2, height: (Dimensions.get("window").width - 40 - 8) / 2, borderRadius: 14, overflow: "hidden", position: "relative" },
  galleryThumbImg: { width: "100%", height: "100%", borderRadius: 14 },
  galleryViewerOverlay: { flex: 1 },
  galleryViewerBg: { backgroundColor: "rgba(0,0,0,0.95)" },
  galleryViewerPage: { width: screenWidth, flex: 1, justifyContent: "center" as const },
  galleryViewerImage: { width: screenWidth, height: "80%" },
  galleryViewerClose: { position: "absolute", top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  galleryViewerCloseText: { color: "#fff", fontSize: 20, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  galleryViewerCounter: { position: "absolute", bottom: 52, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", zIndex: 10 },
  galleryViewerUploader: { position: "absolute", bottom: 30, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", zIndex: 10 },
  galleryUploaderBadge: { position: "absolute", bottom: 3, left: 3, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, maxWidth: 80 },
  galleryUploaderAvatar: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  galleryUploaderAvatarInitial: { color: "#fff", fontSize: 7, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  galleryUploaderName: { color: "#fff", fontSize: 9, fontFamily: "PlusJakartaSans_400Regular", flexShrink: 1 },
  receiptPhotosSection: { marginBottom: 0, gap: 8 },
  receiptPhotosSectionTitle: { fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  receiptPhotoUploadRow: { flexDirection: "row", gap: 8 },
  receiptPhotoUploadBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  receiptPhotoUploadBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  addReceiptHint: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", paddingHorizontal: 2 },
  // Receipt camera guide overlay (inline, avoids native Modal dismiss race on iOS)
  cameraGuideOverlay: { ...StyleSheet.absoluteFill, zIndex: 999, justifyContent: "flex-end" },
  cameraGuideBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  cameraGuideSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "82%", overflow: "hidden" },
  cameraGuideContent: { padding: 24, gap: 20, paddingBottom: 40 },
  cameraGuideBody: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 22 },
  cameraGuideChecklist: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cameraGuideCheckRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cameraGuideCheckIcon: { fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", width: 20 },
  cameraGuideCheckText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", flex: 1 },
  cameraGuideOpenBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cameraGuideOpenBtnText: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  cameraGuideCancelBtn: { height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cameraGuideCancelBtnText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular" },
  // OCR draft modal
  ocrDraftContent: { padding: 20, gap: 12, paddingBottom: 40 },
  ocrWarningBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 4 },
  ocrWarningText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 18, color: "#92400E" },
  ocrDraftHint: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 18, marginBottom: 4 },
  draftItemRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  draftItemFields: { flex: 1, gap: 8 },
  draftFieldError: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", color: "#EF4444", marginTop: -2 },
  draftItemNameInput: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  draftItemPriceRow: { flexDirection: "row", gap: 8 },
  draftItemQtyInput: { flex: 1, fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  draftItemPriceInput: { flex: 2, fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  draftLineTotalText: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium", marginTop: -2 },
  draftItemDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(220,38,38,0.1)", alignItems: "center", justifyContent: "center" },
  draftItemDeleteText: { color: "#dc2626", fontSize: 18, fontWeight: "700", lineHeight: 20 },
  draftTotalsBox: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  draftTotalsTitle: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 4 },
  draftTotalsLine: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  mergeDuplicatesBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  mergeDuplicatesBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  confirmDraftBtn: { height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 8 },
  confirmDraftBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  scanProgressBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  scanProgressText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", flex: 1 },
  scanErrorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  scanErrorBannerText: { flex: 1, fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 18 },
  scanErrorBannerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanErrorBannerRetry: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold" },
  ocrWarningTapHint: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", color: "#92400E", marginTop: 2, opacity: 0.75 },
  addMissingItemBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", borderStyle: "dashed" },
  addMissingItemBtnText: { fontSize: 14, fontFamily: "PlusJakartaSans_500Medium" },
  draftReconcilSection: { gap: 4, marginBottom: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.1)" },
  draftReconcilRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  draftReconcilLabel: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  draftReconcilValue: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold" },
  draftReconcilSuccess: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold", color: "#16A34A", marginTop: 2 },
  draftReconcilWarning: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold", color: "#D97706", marginTop: 2 },
  // ── Payment request UI ───────────────────────────────────────────────────
  paymentOwedCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  paymentOwedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentOwedTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  paymentOwedAmount: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  paymentOwedNote: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 18,
  },
  trustReassuranceText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 17, marginBottom: 2 },
  iPaidBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  iPaidBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  cashPayBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  cashPayBtnText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  paymentMarkedPaidText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 4,
  },
  markReceivedWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  requestedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editPaymentBtn: {
    padding: 6,
    borderRadius: 6,
  },
  smsPaymentBtn: {
    padding: 4,
    borderRadius: 6,
  },
  smsPaymentBtnText: {
    fontSize: 16,
  },
  noPhoneIndicator: {
    padding: 4,
    opacity: 0.4,
  },
  settlementBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  settlementBannerEmoji: {
    fontSize: 22,
  },
  settlementBannerTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  settlementBannerSub: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 1,
  },
  guestSettledCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  guestSettledTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  guestSettledSub: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 1,
    lineHeight: 18,
  },
  editPaymentGuestLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 16,
    textAlign: "center",
  },
  markReceivedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  markReceivedBtnText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#0f766e",
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  paymentStatusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  cashAppTrackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cashAppTrackBtnText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  paymentRequestSection: {
    marginBottom: 14,
    gap: 8,
  },
  paymentRequestSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  paymentRequestSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 0,
  },
  paymentRequestSectionSubtitle: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  paymentRequestHint: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 10,
    textAlign: "center",
  },
  requestPaymentBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  requestPaymentBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  paymentStatusList: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  paymentStatusDivider: {
    height: 1,
  },
  paymentStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  paymentStatusAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paymentStatusAvatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  paymentStatusName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  paymentStatusAmount: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    flexShrink: 0,
    textAlign: "right" as const,
  },
  resendRequestsBtn: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  resendRequestsBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  // Payment modal
  paymentModalContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
  },
  paymentModalSubtitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 4,
  },
  paymentModalGuestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  paymentModalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  paymentModalAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  paymentModalGuestName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  paymentModalGuestAmount: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    flexShrink: 0,
  },
  paymentModalNoteLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    marginBottom: -8,
  },
  paymentModalNoteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    minHeight: 72,
    textAlignVertical: "top",
  },
  paymentModalHint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 17,
    marginTop: -4,
  },
  coverageWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  coverageWarningIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  coverageWarningBody: {
    flex: 1,
    gap: 4,
  },
  coverageWarningText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  coverageWarningLink: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  zelleWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  zelleWarningIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  zelleWarningBody: {
    flex: 1,
    gap: 2,
  },
  zelleWarningTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#92400E",
  },
  zelleWarningSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#92400E",
  },
  sendRequestsBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sendRequestsBtnText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // ── Payment method handoff UI ─────────────────────────────────────────────
  payMethodDivider: {
    height: 1,
    marginVertical: 10,
  },
  payMethodBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  payMethodBtnEmoji: {
    fontSize: 18,
    lineHeight: 22,
    flexShrink: 0,
  },
  payMethodBtnLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  preferredBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    flexShrink: 0,
  },
  preferredBadgeText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  guestPreferredBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    flexShrink: 0,
  },
  guestPreferredBadgeText: {
    color: "#15803d",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  noMethodsText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    paddingVertical: 8,
  },
  // Zelle panel
  zellePanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  zellePanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zellePanelEmoji: {
    fontSize: 18,
    lineHeight: 22,
    flexShrink: 0,
  },
  zellePanelTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  zellePanelHint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 17,
    marginTop: -4,
  },
  zelleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zelleRowLabel: {
    width: 68,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    flexShrink: 0,
  },
  zelleRowValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  zelleCopyAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  zelleCopyAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  zelleOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 10,
  },
  zelleOpenBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#fff",
  },
  zelleFallbackMsg: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  zelleFallbackMsgText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 17,
  },
  zelleBankCallout: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 3,
    marginTop: 2,
  },
  zelleBankCalloutTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  zelleBankCalloutList: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 16,
  },
  zelleCopiedBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  zelleCopiedBadgeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // Chat
  chatEmptyBox: { padding: 24, alignItems: "center" },
  chatEmptyText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  chatMessageRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 4, gap: 8, alignItems: "flex-end" },
  chatAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  chatAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  chatAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  chatBubbleWrapper: { maxWidth: "75%", gap: 2 },
  chatSenderLine: { fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", marginLeft: 2, marginBottom: 1 },
  chatBubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chatBubbleText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 20 },
  chatTimestampBelow: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", marginTop: 2, marginHorizontal: 2 },
  chatErrorText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", marginBottom: 6 },
  cantPayReplyBtn: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  cantPayReplyBtnText: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  cantPayReplyPanel: { marginTop: 8, borderRadius: 12, borderWidth: 1, padding: 10, gap: 8 },
  cantPayReplyPanelLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  cantPaySuggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cantPaySuggestionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  cantPaySuggestionText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  cantPayReplyInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, overflow: "hidden", marginTop: 2 },
  cantPayReplyInput: { flex: 1, fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", paddingHorizontal: 12, paddingVertical: 8 },
  cantPayReplySendBtn: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  cantPayReplySendBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  chatInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 24, overflow: "hidden", gap: 0 },
  chatInput: { flex: 1, fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", paddingHorizontal: 14, paddingVertical: 12 },
  chatSendBtn: { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  chatSendBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalSearchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 12, marginBottom: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  modalSearchInput: { flex: 1, fontSize: 15, fontFamily: "PlusJakartaSans_400Regular" },
  modalSearchClear: { fontSize: 13, paddingHorizontal: 4 },
  modalTitle: { fontSize: 18, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  modalCloseBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  modalCloseBtnText: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  modalList: { padding: 20, gap: 0 },
  modalEmptyText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", paddingHorizontal: 32 },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  sendInviteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  sendInviteBtnText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  inviteSectionLabel: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, marginTop: 4 },
  contactsSection: { marginTop: 24 },
  contactsPermBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  contactsPermTitle: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 2 },
  contactsPermSubtitle: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  inviteFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  bulkInviteBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bulkInviteBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  // RSVP count row (host header badge)
  rsvpCountRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 },
  rsvpCountBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  rsvpCountDot: { fontSize: 8 },
  rsvpCountText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  // RSVP card
  rsvpCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16, gap: 8 },
  rsvpCardTitle: { fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  rsvpCardSubtitle: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 20 },
  rsvpButtonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  rsvpAcceptBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 90 },
  rsvpAcceptBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  rsvpDeclineBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", minWidth: 90 },
  rsvpDeclineBtnText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular" },
  // Change response (accepted users)
  changeResponseBtn: { alignSelf: "flex-end", marginBottom: 8, paddingVertical: 4, paddingHorizontal: 2 },
  changeResponseText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  // Chat notice
  chatNoticeBox: { padding: 8, alignItems: "center", gap: 12 },
  chatNoticeText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  chatNoticeAcceptBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  chatNoticeAcceptBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  // Cancelled banner
  cancelledBanner: { marginHorizontal: 20, marginBottom: 12, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5" },
  cancelledBannerText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#dc2626", textAlign: "center" },
  // Cancel event button
  paymentNudgeCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  paymentNudgeTitle: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 2 },
  paymentNudgeSubtitle: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 17 },
  notifMuteRow: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 20, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  notifMuteLabel: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 1 },
  notifMuteHint: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  cancelEventBtn: { marginHorizontal: 20, marginTop: 24, marginBottom: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#dc2626", alignItems: "center", justifyContent: "center" },
  cancelEventBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#dc2626" },
  // Chat closed bar
  chatClosedBar: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  chatClosedText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  // Make host button
  makeHostBtn: { borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 6, alignItems: "center", justifyContent: "center", minWidth: 72 },
  makeHostBtnText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  // "Add More" photo tile
  addMoreTile: { width: 108, height: 108, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  addMoreTileIcon: { fontSize: 28, fontWeight: "300", lineHeight: 32 },
  addMoreTileText: { fontSize: 11, fontFamily: "PlusJakartaSans_500Medium" },
  // Item card (per-item card with chip row)
  itemCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 0 },
  itemCardTop: { flexDirection: "row", alignItems: "flex-start", padding: 10, paddingBottom: 8, gap: 10 },
  itemCardNameCol: { flex: 1, gap: 3 },
  itemCardName: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", lineHeight: 19 },
  itemCardSplit: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  itemCardPriceCol: { alignItems: "flex-end", gap: 3 },
  itemCardPrice: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  itemCardQtyBreakdown: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular" },
  itemCardMoreBtn: { paddingVertical: 2 },
  itemCardMoreText: { fontSize: 16, letterSpacing: 1, lineHeight: 18 },
  itemCardChipsSection: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 7, gap: 8 },
  itemsAssignHint: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 17, flex: 1 },
  assignToLabel: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  chipsScrollContent: { flexDirection: "row", gap: 7, paddingRight: 4 },
  // Participant chips (horizontal scroll)
  participantChip: { alignItems: "center", gap: 3, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, minWidth: 54 },
  chipAvatarWrapper: { position: "relative", width: 34, height: 34 },
  chipAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  chipAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  chipCheckBadge: { position: "absolute", right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  chipCheckText: { color: "#fff", fontSize: 8, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  chipName: { fontSize: 11, textAlign: "center", maxWidth: 54 },
  // Tip selector
  tipSection: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14, gap: 12 },
  tipSectionLabel: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  tipButtonRow: { flexDirection: "row", gap: 6 },
  tipButton: { flex: 1, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tipButtonText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  tipCustomRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipCustomPrefix: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium" },
  tipCustomInput: { flex: 1, fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tipSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipSaveBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  // Totals card (two-column)
  totalsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  totalsCardTitleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  totalsCardTitle: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  totalsCardBody: { flexDirection: "row", padding: 14, gap: 12, alignItems: "flex-start" },
  totalsLeftCol: { flex: 1, gap: 8 },
  totalsColSeparator: { width: 1, alignSelf: "stretch" },
  totalsRightCol: { flex: 1, gap: 5 },
  totalsLineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4 },
  totalsLineLabel: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", flex: 1 },
  totalsLineValue: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  totalsBoldLine: { marginTop: 6, paddingTop: 8, borderTopWidth: 1 },
  totalsBoldLabel: { fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", flex: 1 },
  totalsBoldValue: { fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  // Per-person row (right column of totals)
  personRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  personAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  personAvatarText: { color: "#fff", fontSize: 9, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  personName: { flex: 1, fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  personAmount: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium", flexShrink: 0, textAlign: "right" as const },
  // Host tools section
  hostToolsSectionLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", marginBottom: 6, marginTop: 4, opacity: 0.55 },
  hostToolsSection: { marginBottom: 12, gap: 0 },
  resetBillDivider: { height: 1, marginVertical: 10 },
  resetBillBtn: { height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  resetBillBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#EF4444" },
  resetBillError: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", marginBottom: 4 },
  // Multi-select mode
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 },
  selectCheckmark: { fontSize: 12, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", color: "#fff" },
  // Bulk action bar
  bulkBar: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  bulkBarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bulkBarCount: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  bulkBarPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  bulkBarPillText: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  bulkBarActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bulkActionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bulkActionBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  bulkErrorText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  // Bulk split participant picker
  bulkSplitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginLeft: "auto" as const },
  bulkSplitCheckText: { fontSize: 11, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", color: "#fff" },
  bulkSplitFooter: { padding: 16, borderTopWidth: 1 },
  bulkSplitConfirmBtn: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bulkSplitConfirmText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  hostToolHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minHeight: 46 },
  hostToolHeaderText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  hostToolSubtitle: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", opacity: 0.6 },
  hostToolChevron: { fontSize: 11, flexShrink: 0, opacity: 0.5 },
  scanHealthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  scanHealthLabel: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", flexShrink: 1 },
  scanHealthValue: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", flexShrink: 0 },
  scanHealthDivider: { height: 1, marginVertical: 2 },
  hostToolBody: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, gap: 8 },
  // Assignment modal
  assignModalSubtitle: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", marginTop: 2 },
  assignModalHint: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  assignModalRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  assignModalAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  assignModalAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  assignModalName: { flex: 1, fontSize: 15, fontFamily: "PlusJakartaSans_400Regular" },
  assignedBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  assignedBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  assignModalDeleteRow: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, marginTop: 8, alignItems: "center" },
  assignModalDeleteText: { fontSize: 15, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  // Bill tab — empty state card
  emptyBillCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 10, marginBottom: 14 },
  emptyBillIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  emptyBillTitle: { fontSize: 17, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  emptyBillSubtitle: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", lineHeight: 19, marginBottom: 4 },
  // Receipt strip card wrapper
  receiptStripCard: { borderRadius: 16, borderWidth: 1, paddingTop: 10, paddingBottom: 12, marginBottom: 0, gap: 8 },
  receiptStripLabel: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", textTransform: "uppercase" as const, letterSpacing: 0.5, paddingHorizontal: 14, opacity: 0.55 },
  // Assign hint pill
  assignHintPill: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 4 },
  // Totals right column label
  totalsRightColLabel: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular", marginBottom: 0, opacity: 0.5 },
  // Payment setup (inline in Request Payment modal)
  paymentSetupIconRow: { alignItems: "center", paddingTop: 8 },
  paymentSetupIcon: { fontSize: 44, lineHeight: 52 },
  paymentSetupTitle: { fontSize: 20, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", textAlign: "center" },
  paymentSetupSubtitle: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 20, textAlign: "center" },
  paymentMethodPills: { flexDirection: "row", gap: 8, justifyContent: "center" },
  paymentMethodPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodPillText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },

  // ── Venue Suggestions ─────────────────────────────────────────────────────
  suggestionsSection: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  suggestionsSectionTitle: { fontSize: 15, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  votingDeadlineText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  votingError: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  noSuggestionsText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", paddingVertical: 8 },
  suggestionCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden" as const },
  suggestionPhoto: { width: "100%" as const, height: 100 },
  suggestionCardBody: { padding: 10, gap: 2 },
  suggestionName: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  suggestionAddress: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  suggestionRating: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  suggestionProposer: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", marginTop: 2 },
  customVenueBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  customVenueBadgeText: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular" },
  suggestionActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingBottom: 10, flexWrap: "wrap" as const },
  voteBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  voteBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  voteCount: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  voteCountText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  rescindBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  rescindBtnText: { fontSize: 12, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  openVotingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  durationToggle: { flexDirection: "row", gap: 4 },
  durationBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  durationBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  openVotingBtn: { height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  openVotingBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  extendDeadlineBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  extendDeadlineBtnText: { fontSize: 12, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  addSuggestionBtn: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 10, alignItems: "center", borderStyle: "dashed" as const },
  addSuggestionBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  discoveryPanel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  discoveryTitle: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  discoveryZipInput: { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  discoveryRadiusLabel: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium", marginTop: 10, marginBottom: 4 },
  radiusChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  cuisineChipsRow: { gap: 6, paddingVertical: 2 },
  cuisineChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  cuisineChipText: { fontSize: 12, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cuisineGridCell: { width: "31%", paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, alignItems: "center", gap: 4 },
  cuisineGridEmoji: { fontSize: 22 },
  cuisineGridLabel: { fontSize: 11, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium", textAlign: "center" },
  discoveryActions: { flexDirection: "row", gap: 8 },
  discoveryResultCard: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  discoveryResultBody: { flex: 1, gap: 2 },
  discoveryResultName: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  discoveryResultAddress: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  discoveryResultMeta: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular" },
  discoveryResultAdd: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", flexShrink: 0 },
  cancelBtn: { flex: 1, height: 42, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  actionBtn: { height: 42, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  manualEntryToggle: { alignItems: "center", paddingVertical: 8 },
  manualEntryToggleText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular", textDecorationLine: "underline" },
  manualEntryForm: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginTop: 4 },
  manualEntryFormTitle: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 2 },
  qrActionsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  qrActionRowBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  qrActionRowBtnText: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  qrPanel: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 12 },
  qrCodeWrapper: { alignItems: "center", gap: 8, backgroundColor: "#ffffff", padding: 16, borderRadius: 12 },
  qrEventLabel: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", textAlign: "center", maxWidth: 210 },
  qrPanelActions: { flexDirection: "row", gap: 8 },
  qrPanelBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  qrPanelBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  generateQRBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, width: "100%" },
  scannerOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 20 },
  scannerReticle: { width: 220, height: 220, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.9)", borderRadius: 16 },
  scannerHint: { color: "#fff", fontSize: 14, fontFamily: "PlusJakartaSans_500Medium", textAlign: "center" },
  scannerCloseBtn: { position: "absolute", right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  guestBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  guestBadgeText: { fontSize: 10, fontFamily: "PlusJakartaSans_400Regular" },
  addGuestBody: { padding: 20, gap: 14 },
  addGuestHint: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", lineHeight: 20 },
  addGuestSectionLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  addGuestDivider: { height: 1, marginTop: 16 },
  addGuestInput: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 16, fontFamily: "PlusJakartaSans_400Regular" },
  addGuestToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10 },
  addGuestToggleLabel: { fontSize: 14, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  addGuestToggleSub: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  addGuestError: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  addGuestBtn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  addGuestBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  savedContactChip: { alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: 72, maxWidth: 96 },
  savedContactChipAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  savedContactChipInitial: { color: "#fff", fontSize: 16, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  savedContactChipName: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500", textAlign: "center" },
});
