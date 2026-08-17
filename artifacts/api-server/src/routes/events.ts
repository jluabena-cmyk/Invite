import { createHmac, randomBytes, randomUUID } from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";
import { getAuth } from "@clerk/express";
import { aliasedTable, and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { openai } from "../lib/openai";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  eventSharesTable,
  receiptsTable,
  receiptItemsTable,
  itemAssignmentsTable,
  receiptPhotosTable,
  eventPhotosTable,
  friendshipsTable,
  eventMessagesTable,
  apiRateLimitWindowsTable,
  eventVenueSuggestionsTable,
  eventVenueVotesTable,
  pushTokensTable,
  scanErrorLogsTable,
  paymentRequestsTable,
  savedGuestsTable,
  guestPaymentRequestsTable,
  uploadEventsTable,
} from "@workspace/db";
import { objectStorageClient } from "../lib/objectStorage";
import { resolveDisplayName } from "../lib/helpers";
import { signedAvatarUrl } from "../lib/gcs";
import { sendExpoPush, getTokensForUsers, getUnmutedTokensForEvent } from "../lib/sendExpoPush";

const router = Router();

// ─── Upload telemetry ─────────────────────────────────────────────────────────
// Fire-and-forget; a logging failure must never affect the upload response.
function trackUpload(type: "receipt" | "gallery", outcome: string, buildNumber?: string | null): void {
  void db
    .insert(uploadEventsTable)
    .values({ type, outcome, buildNumber: buildNumber ?? null })
    .catch(() => { /* intentionally swallowed */ });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Durable rate limiting (DB-backed, shared across instances) ───────────────
//
// Uses a fixed-window counter stored in `api_rate_limit_windows`.
// Atomic upsert ensures correctness under concurrent requests.
// Returns false (deny) when the post-increment count exceeds `max`.
//
// limit_key examples:
//   "ocr:user:42"            — per-user OCR scans
//   "ocr:global"             — system-wide OCR budget
//   "places_search:user:42"  — per-user Places text search
//   "places_search:global"   — system-wide Places search budget
//   etc.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour fixed window

async function checkAndIncrementRateLimit(limitKey: string, max: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);
  const [row] = await db
    .insert(apiRateLimitWindowsTable)
    .values({ limitKey, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [apiRateLimitWindowsTable.limitKey, apiRateLimitWindowsTable.windowStart],
      set: { requestCount: sql`${apiRateLimitWindowsTable.requestCount} + 1` },
    })
    .returning({ requestCount: apiRateLimitWindowsTable.requestCount });
  return (row?.requestCount ?? 1) <= max;
}

// Per-user and global limits (requests / hour)
const OCR_USER_LIMIT = 20;
const OCR_GLOBAL_LIMIT = 500;

// Laplacian variance threshold — images below this are considered too blurry
// for reliable OCR. Conservative value: only rejects egregiously blurry photos.
const BLUR_SCORE_THRESHOLD = 12;

// A scan lock older than this is considered stale (server crash mid-scan) and
// may be stolen by a new request so the photo can be retried.
const SCAN_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const PLACES_SEARCH_USER_LIMIT = 30;
const PLACES_SEARCH_GLOBAL_LIMIT = 1000;
const PLACES_DETAILS_USER_LIMIT = 60;
const PLACES_DETAILS_GLOBAL_LIMIT = 2000;
const PLACES_PHOTOS_USER_LIMIT = 120;
const PLACES_PHOTOS_GLOBAL_LIMIT = 4000;

// Per-IP limits — generous enough for legitimate NAT/shared-network users, but
// ensures that rotating through Sybil accounts from the same IP is still capped.
const PLACES_SEARCH_IP_LIMIT = 200;
const PLACES_DETAILS_IP_LIMIT = 400;
const PLACES_PHOTOS_IP_LIMIT = 600;
const PLACES_DISCOVER_IP_LIMIT = 80;

// Untrusted-tier global limits — users with a local profile but no active event
// participation route to these smaller buckets.  This reserves the main quota
// for established users and prevents a swarm of throwaway accounts (even with
// pre-aged profiles) from starving legitimate traffic.
const PLACES_SEARCH_UNTRUSTED_GLOBAL_LIMIT = 150;
const PLACES_DETAILS_UNTRUSTED_GLOBAL_LIMIT = 300;
const PLACES_PHOTOS_UNTRUSTED_GLOBAL_LIMIT = 500;
const PLACES_DISCOVER_UNTRUSTED_GLOBAL_LIMIT = 60;

async function checkOcrRateLimit(userId: number): Promise<boolean> {
  // Check user bucket first — denied users must not consume global budget
  const userOk = await checkAndIncrementRateLimit(`ocr:user:${userId}`, OCR_USER_LIMIT);
  if (!userOk) return false;
  // User is eligible; now enforce the system-wide spend cap
  return checkAndIncrementRateLimit("ocr:global", OCR_GLOBAL_LIMIT);
}

// Extract the originating client IP from the request.
// With app.set("trust proxy", 1) in app.ts, Express processes X-Forwarded-For
// safely and exposes the actual client IP via req.ip.  We do NOT parse the raw
// X-Forwarded-For header directly — that would allow clients to spoof their IP
// and bypass per-IP rate limits.
function getClientIp(req: Request): string {
  return req.ip ?? "unknown";
}

async function checkPlacesRateLimit(
  endpoint: string,
  userId: string,
  clientIp: string,
  trusted: boolean,
): Promise<boolean> {
  // 1. Per-user check — denied users must not consume IP or global budget.
  const userOk = await checkAndIncrementRateLimit(`${endpoint}:user:${userId}`, getPlacesUserLimit(endpoint));
  if (!userOk) return false;

  // 2. Per-IP check — breaks Sybil account rotation even when many accounts
  //    share a single egress IP.  Each IP is capped regardless of how many
  //    distinct user IDs are behind it.
  const ipOk = await checkAndIncrementRateLimit(`${endpoint}:ip:${clientIp}`, getPlacesIpLimit(endpoint));
  if (!ipOk) return false;

  // 3. Tiered global check — trusted users (active event participants) draw
  //    from the main global bucket; untrusted users draw from a smaller
  //    reserved bucket so they cannot exhaust quota for everyone else.
  const globalKey = trusted ? `${endpoint}:global` : `${endpoint}:global:untrusted`;
  const globalLimit = trusted ? getPlacesGlobalLimit(endpoint) : getPlacesUntrustedGlobalLimit(endpoint);
  return checkAndIncrementRateLimit(globalKey, globalLimit);
}

function getPlacesUserLimit(endpoint: string): number {
  if (endpoint === "places_search") return PLACES_SEARCH_USER_LIMIT;
  if (endpoint === "places_details") return PLACES_DETAILS_USER_LIMIT;
  if (endpoint === "places_discover") return PLACES_DISCOVER_USER_LIMIT;
  return PLACES_PHOTOS_USER_LIMIT;
}

function getPlacesIpLimit(endpoint: string): number {
  if (endpoint === "places_search") return PLACES_SEARCH_IP_LIMIT;
  if (endpoint === "places_details") return PLACES_DETAILS_IP_LIMIT;
  if (endpoint === "places_discover") return PLACES_DISCOVER_IP_LIMIT;
  return PLACES_PHOTOS_IP_LIMIT;
}

function getPlacesGlobalLimit(endpoint: string): number {
  if (endpoint === "places_search") return PLACES_SEARCH_GLOBAL_LIMIT;
  if (endpoint === "places_details") return PLACES_DETAILS_GLOBAL_LIMIT;
  if (endpoint === "places_discover") return PLACES_DISCOVER_GLOBAL_LIMIT;
  return PLACES_PHOTOS_GLOBAL_LIMIT;
}

function getPlacesUntrustedGlobalLimit(endpoint: string): number {
  if (endpoint === "places_search") return PLACES_SEARCH_UNTRUSTED_GLOBAL_LIMIT;
  if (endpoint === "places_details") return PLACES_DETAILS_UNTRUSTED_GLOBAL_LIMIT;
  if (endpoint === "places_discover") return PLACES_DISCOVER_UNTRUSTED_GLOBAL_LIMIT;
  return PLACES_PHOTOS_UNTRUSTED_GLOBAL_LIMIT;
}

// Per-user and per-event limits for gallery photo uploads (uploads / hour)
const UPLOAD_PHOTO_USER_LIMIT = 30;
const UPLOAD_PHOTO_EVENT_LIMIT = 50;

// Per-user and per-event limits for receipt photo uploads (uploads / hour)
const UPLOAD_RECEIPT_PHOTO_USER_LIMIT = 20;
const UPLOAD_RECEIPT_PHOTO_EVENT_LIMIT = 30;

// ─── Lightweight auth gate ────────────────────────────────────────────────────
// Must run BEFORE multer so unauthenticated requests never cause the server to
// allocate the 10 MB in-memory buffer.
function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// ─── Server-side cache for Places API responses ───────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number }
const placeSearchCache = new Map<string, CacheEntry<unknown>>();
const placeDetailsCache = new Map<string, CacheEntry<unknown>>();
const PLACE_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const PLACE_DETAILS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}

function getPgCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  if ("cause" in err) return getPgCode((err as { cause: unknown }).cause);
  return undefined;
}
function isPgUniqueViolation(err: unknown): boolean {
  return getPgCode(err) === "23505";
}

async function resolveProfile(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

// Returns true when the user has been accepted into at least one event created
// by someone else.  Deliberately excludes the 'host' role: any user can create
// an event and become host with a single self-service request, which would let
// an attacker immediately self-promote to the trusted quota tier.  The
// 'accepted' and 'participant' roles require an external invitation — someone
// else's event host must have included them — making this signal hard to
// manufacture at scale with throwaway accounts.
async function hasEventParticipation(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: eventParticipantsTable.id })
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.userId, userId),
        inArray(eventParticipantsTable.role, ["accepted", "participant"]),
      ),
    )
    .limit(1);
  return !!row;
}

async function resolveParticipation(eventId: number, userId: number) {
  const [row] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function resolveEvent(eventId: number) {
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);
  return event ?? null;
}

// ─── Push-notification helpers ────────────────────────────────────────────────

async function getParticipantUserIds(eventId: number, excludeUserId?: number): Promise<number[]> {
  const rows = await db
    .select({ userId: eventParticipantsTable.userId })
    .from(eventParticipantsTable)
    .where(and(
      eq(eventParticipantsTable.eventId, eventId),
      inArray(eventParticipantsTable.role, ["host", "participant", "accepted"]),
      isNotNull(eventParticipantsTable.userId),
    ));
  return rows.map((r) => r.userId!).filter((id) => id !== excludeUserId);
}


// ─── Server-side canonical place resolution ──────────────────────────────────

interface CanonicalPlaceDetails {
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  placeLat: number | null;
  placeLng: number | null;
  rating: number | null;
  photoUrl: string | null;
}

async function fetchCanonicalPlaceDetails(placeId: string): Promise<CanonicalPlaceDetails | null> {
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return null;

  try {
    const fieldMask = ["id", "displayName", "formattedAddress", "location", "rating", "photos"].join(",");
    const googleRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": fieldMask },
      signal: AbortSignal.timeout(8000),
    });
    if (!googleRes.ok) return null;
    const raw = (await googleRes.json()) as {
      id?: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      rating?: number;
      photos?: Array<{ name: string }>;
    };
    const photoRef = raw.photos?.[0]?.name;
    return {
      placeId: raw.id ?? placeId,
      placeName: raw.displayName?.text ?? "",
      placeAddress: raw.formattedAddress ?? null,
      placeLat: raw.location?.latitude ?? null,
      placeLng: raw.location?.longitude ?? null,
      rating: raw.rating ?? null,
      photoUrl: photoRef ? `/api/places/photos?ref=${encodeURIComponent(photoRef)}&w=400` : null,
    };
  } catch {
    return null;
  }
}

// ─── Auto-finalize voting when deadline passes ────────────────────────────────

async function autoFinalizeVoting(eventId: number): Promise<void> {
  const event = await resolveEvent(eventId);
  if (
    !event ||
    !event.votingOpenedAt ||
    event.destinationDecidedAt ||
    !event.votingDeadline ||
    event.votingDeadline > new Date()
  ) return;

  const rawSuggestions = await db
    .select()
    .from(eventVenueSuggestionsTable)
    .where(and(eq(eventVenueSuggestionsTable.eventId, eventId), eq(eventVenueSuggestionsTable.rescinded, false)));

  if (!rawSuggestions.length) return;

  const suggestionIds = rawSuggestions.map((s) => s.id);
  const allVotes = await db
    .select()
    .from(eventVenueVotesTable)
    .where(inArray(eventVenueVotesTable.suggestionId, suggestionIds));

  const voteCounts = rawSuggestions.map((s) => ({
    ...s,
    voteCount: allVotes.filter((v) => v.suggestionId === s.id).length,
  }));

  const maxVotes = Math.max(...voteCounts.map((s) => s.voteCount));
  const leaders = voteCounts.filter((s) => s.voteCount === maxVotes);

  if (leaders.length !== 1) {
    // Tie — require host to break it manually; notify host
    void (async () => {
      const hostRows = await db
        .select({ userId: eventParticipantsTable.userId })
        .from(eventParticipantsTable)
        .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.role, "host")));
      const tokens = await getUnmutedTokensForEvent(eventId, hostRows.map((r) => r.userId).filter((id): id is number => id !== null));
      void sendExpoPush(
        tokens,
        "🤝 Voting tied — your call!",
        `Break the tie for your event's venue`,
        { screen: "event", eventId, anchor: "voting" },
      );
    })();
    return;
  }

  const winner = leaders[0];

  await db.update(eventsTable).set({
    destinationDecidedAt: new Date(),
    destinationRequired: true,
    restaurantName: winner.placeName,
    destinationAddress: winner.placeAddress,
    destinationLat: winner.placeLat,
    destinationLng: winner.placeLng,
    destinationPlaceId: winner.placeId,
  }).where(and(eq(eventsTable.id, eventId), isNull(eventsTable.destinationDecidedAt)));

  void (async () => {
    const participantIds = await getParticipantUserIds(eventId);
    const tokens = await getUnmutedTokensForEvent(eventId, participantIds);
    void sendExpoPush(
      tokens,
      "🎉 Voting closed — destination decided!",
      `The group is going to ${winner.placeName}`,
      { screen: "event", eventId },
    );
  })();
}

// ─── Parse a money field from request body ───────────────────────────────────

function parseMoneyField(key: string, val: unknown): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  const num = parseFloat(val as string);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${key} must be a non-negative number`);
  }
  return num.toFixed(2);
}

// ─── GCS helpers (for receipt photos) ────────────────────────────────────────

function splitGcsPath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath.slice(1) : fullPath;
  const idx = normalized.indexOf("/");
  return idx === -1
    ? { bucketName: normalized, objectName: "" }
    : { bucketName: normalized.slice(0, idx), objectName: normalized.slice(idx + 1) };
}

function gcsPathFromObjectPath(objectPath: string): { bucketName: string; objectName: string } {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR ?? "";
  const entityId = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return splitGcsPath(`${privateObjectDir}/${entityId}`);
}

async function signDownloadUrl(bucketName: string, objectName: string): Promise<string> {
  const SIDECAR = "http://127.0.0.1:1106";
  const body = {
    bucket_name: bucketName,
    object_name: objectName,
    method: "GET",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(), // 1-hour window — long enough that React Query cache never serves an expired URL
  };
  const r = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Failed to sign download URL: ${r.status}`);
  const { signed_url } = (await r.json()) as { signed_url: string };
  return signed_url;
}

async function signedUrlForPhoto(objectPath: string): Promise<string> {
  const { bucketName, objectName } = gcsPathFromObjectPath(objectPath);
  return signDownloadUrl(bucketName, objectName);
}

// Returns a short-lived signed PUT URL the mobile client uses to upload a file
// directly to GCS — the binary never passes through the API server or proxy.
async function signUploadUrl(bucketName: string, objectName: string): Promise<string> {
  const SIDECAR = "http://127.0.0.1:1106";
  const body = {
    bucket_name: bucketName,
    object_name: objectName,
    method: "PUT",
    expires_at: new Date(Date.now() + 900_000).toISOString(), // 15-minute window for the client to upload
  };
  const r = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Failed to sign upload URL: ${r.status}`);
  const { signed_url } = (await r.json()) as { signed_url: string };
  return signed_url;
}

// ─── Upload intent tokens ─────────────────────────────────────────────────────
// A short-lived HMAC-signed token issued alongside the signed PUT URL binds the
// confirmation to the exact event, user, upload kind, MIME, and object path that
// were authorised at URL issuance time — preventing cross-event or cross-user
// confirmation of a foreign upload URL.

interface UploadIntentPayload {
  objectPath: string;
  eventId: number;
  userId: number;
  uploadKind: "receipt_photo" | "event_photo";
  mimeType: string;
  expiresAt: number; // Unix ms
}

function createUploadToken(payload: UploadIntentPayload): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set before upload tokens can be issued");
  }
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("hex");
  return `${data}.${sig}`;
}

function verifyUploadToken(token: string): UploadIntentPayload | null {
  const secret = process.env.SESSION_SECRET;
  // Fail closed: an unset signing key cannot verify any token.
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(data).digest("hex");
  // Constant-time comparison to resist timing attacks
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as UploadIntentPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const ALLOWED_IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"] as const;

// ─── Roles that constitute full event access ──────────────────────────────────

const FULL_ACCESS_ROLES = ["host", "participant", "accepted"];

// ─── GET /places/search ───────────────────────────────────────────────────────

router.get("/places/search", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await resolveProfile(auth.userId);
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }

  const { q, lat, lng, locationBias } = req.query as { q?: string; lat?: string; lng?: string; locationBias?: string };
  if (!q?.trim()) { res.status(400).json({ error: "q is required" }); return; }

  let latN = lat ? parseFloat(lat) : NaN;
  let lngN = lng ? parseFloat(lng) : NaN;

  // ── Enforce rate limit before any outbound work (Nominatim or Google Places) ─
  // Checking here prevents a quota-bypass where a caller supplies locationBias
  // instead of raw coords, triggering a Nominatim geocode on every request even
  // after their Places quota is exhausted.
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey) {
    const clientIp = getClientIp(req);
    const trusted = await hasEventParticipation(profile.id);
    if (!(await checkPlacesRateLimit("places_search", auth.userId, clientIp, trusted))) {
      res.status(429).json({ error: "Too many search requests. Please try again later." }); return;
    }
  }

  // If no direct coords but locationBias provided, geocode the city/ZIP via Nominatim
  // (Nominatim is reliable for address/city/ZIP lookups even though it's poor for restaurant names)
  if ((isNaN(latN) || isNaN(lngN)) && locationBias?.trim()) {
    try {
      const isUsZip = /^\d{5}$/.test(locationBias.trim());
      const biasQueryParams: Record<string, string> = { q: locationBias.trim(), format: "json", limit: "1", "accept-language": "en" };
      if (isUsZip) biasQueryParams.countrycodes = "us";
      const biasParams = new URLSearchParams(biasQueryParams);
      const biasRes = await fetch(
        `https://nominatim.openstreetmap.org/search?${biasParams}`,
        { headers: { "User-Agent": "owmo-app/1.0", Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(4000) },
      );
      if (biasRes.ok) {
        const biasData = (await biasRes.json()) as Array<{ lat: string; lon: string }>;
        if (biasData[0]) {
          latN = parseFloat(biasData[0].lat);
          lngN = parseFloat(biasData[0].lon);
        }
      }
    } catch {
      // ignore — fall through to unbiased search
    }
  }

  // ── Primary: Google Places Text Search (New) ────────────────────────────────
  if (googleKey) {
    const searchCacheKey = `${q.trim()}|${isNaN(latN) ? "" : latN.toFixed(4)}|${isNaN(lngN) ? "" : lngN.toFixed(4)}`;
    const cached = placeSearchCache.get(searchCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Cache hit — serve immediately
      res.json(cached.data);
      return;
    }
    // Rate limit already enforced above; proceed directly to upstream
    try {
      const body: Record<string, unknown> = { textQuery: q.trim(), maxResultCount: 5 };
      if (!isNaN(latN) && !isNaN(lngN)) {
        body.locationBias = { circle: { center: { latitude: latN, longitude: lngN }, radius: 15000.0 } };
      }
      const googleRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (googleRes.ok) {
        const data = (await googleRes.json()) as {
          places?: Array<{
            id: string;
            displayName: { text: string };
            formattedAddress: string;
            location: { latitude: number; longitude: number };
          }>;
        };
        const results = (data.places ?? []).map((place) => ({
          placeId: place.id,
          name: place.displayName.text,
          address: place.formattedAddress,
          lat: place.location.latitude,
          lng: place.location.longitude,
        }));
        placeSearchCache.set(searchCacheKey, { data: results, expiresAt: Date.now() + PLACE_SEARCH_CACHE_TTL_MS });
        res.json(results);
        return;
      }
    } catch {
      // fall through to Nominatim fallback
    }
  }

  // ── Fallback: Nominatim ─────────────────────────────────────────────────────
  const params = new URLSearchParams({ q: q.trim(), format: "json", limit: "5", addressdetails: "0", "accept-language": "en" });
  if (!isNaN(latN) && !isNaN(lngN)) {
    params.set("viewbox", `${lngN - 1},${latN + 1},${lngN + 1},${latN - 1}`);
    params.set("bounded", "0");
  }
  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "User-Agent": "owmo-app/1.0", Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(8000) },
    );
    if (!nominatimRes.ok) { res.status(502).json({ error: "Search unavailable" }); return; }
    const raw = (await nominatimRes.json()) as Array<{ place_id: number; display_name: string; lat: string; lon: string }>;
    const results = raw.map((r) => {
      const parts = r.display_name.split(", ");
      const name = parts[0] ?? r.display_name;
      const address = parts.slice(1).join(", ");
      return { placeId: String(r.place_id), name, address, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    });
    res.json(results);
  } catch {
    res.status(502).json({ error: "Search unavailable" });
  }
});

// ─── GET /places/:placeId/details ────────────────────────────────────────────

router.get("/places/:placeId/details", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await resolveProfile(auth.userId);
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }

  const placeId = (req.params.placeId ?? "").trim();
  if (!placeId) { res.status(400).json({ error: "placeId is required" }); return; }

  const cached = placeDetailsCache.get(placeId);
  if (cached && cached.expiresAt > Date.now()) {
    // Cache hit — serve without consuming upstream quota or rate-limit budget
    res.json(cached.data);
    return;
  }

  // Cache miss — enforce rate limit before hitting upstream
  const clientIp = getClientIp(req);
  const trusted = await hasEventParticipation(profile.id);
  if (!(await checkPlacesRateLimit("places_details", auth.userId, clientIp, trusted))) {
    res.status(429).json({ error: "Too many detail requests. Please try again later." }); return;
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) { res.status(503).json({ error: "Venue details unavailable" }); return; }

  try {
    const fieldMask = [
      "id", "displayName", "formattedAddress", "rating",
      "userRatingCount", "priceLevel", "primaryTypeDisplayName",
      "photos", "googleMapsUri",
    ].join(",");

    const googleRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": fieldMask,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!googleRes.ok) { res.status(502).json({ error: "Venue details unavailable" }); return; }

    const raw = (await googleRes.json()) as {
      id?: string;
      displayName?: { text: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      priceLevel?: string;
      primaryTypeDisplayName?: { text: string };
      photos?: Array<{ name: string }>;
      googleMapsUri?: string;
    };

    const priceLevelMap: Record<string, string> = {
      PRICE_LEVEL_FREE: "Free",
      PRICE_LEVEL_INEXPENSIVE: "$",
      PRICE_LEVEL_MODERATE: "$$",
      PRICE_LEVEL_EXPENSIVE: "$$$",
      PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
    };

    const photoUrls = (raw.photos ?? []).slice(0, 3).map((p) =>
      `/api/places/photos?ref=${encodeURIComponent(p.name)}&w=400`,
    );

    const result = {
      placeId: raw.id ?? placeId,
      name: raw.displayName?.text ?? "",
      address: raw.formattedAddress ?? "",
      rating: raw.rating ?? null,
      userRatingCount: raw.userRatingCount ?? null,
      priceLevel: raw.priceLevel ? (priceLevelMap[raw.priceLevel] ?? null) : null,
      primaryType: raw.primaryTypeDisplayName?.text ?? null,
      googleMapsUri: raw.googleMapsUri ??
        `https://www.google.com/maps/search/?q=${encodeURIComponent(raw.displayName?.text ?? placeId)}`,
      photoUrls,
    };
    placeDetailsCache.set(placeId, { data: result, expiresAt: Date.now() + PLACE_DETAILS_CACHE_TTL_MS });
    res.json(result);
  } catch {
    res.status(502).json({ error: "Venue details unavailable" });
  }
});

// ─── GET /places/photos ───────────────────────────────────────────────────────

router.get("/places/photos", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).end(); return; }
  const profile = await resolveProfile(auth.userId);
  if (!profile) { res.status(403).end(); return; }

  const clientIp = getClientIp(req);
  const trusted = await hasEventParticipation(profile.id);
  if (!(await checkPlacesRateLimit("places_photos", auth.userId, clientIp, trusted))) {
    res.status(429).end(); return;
  }

  const { ref, w } = req.query as { ref?: string; w?: string };
  if (!ref?.trim()) { res.status(400).end(); return; }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) { res.status(503).end(); return; }

  const width = Math.min(Math.max(parseInt(w ?? "400", 10) || 400, 100), 1600);

  try {
    // Do NOT use skipHttpRedirect=true — that returns JSON {photoUri:...} not bytes.
    // Without it Google returns 302 → fetch follows → actual image bytes.
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${googleKey}`,
      { redirect: "follow", signal: AbortSignal.timeout(10000) },
    );
    if (!photoRes.ok) { res.status(photoRes.status).end(); return; }

    const contentType = photoRes.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await photoRes.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
});

// ─── POST /events ─────────────────────────────────────────────────────────────

router.post("/events", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, restaurantName, destinationAddress, destinationLat, destinationLng, destinationPlaceId, isPrivate, startsAt, initialInvites, destinationRequired } = req.body as {
    title?: string;
    restaurantName?: string;
    destinationAddress?: string;
    destinationLat?: number;
    destinationLng?: number;
    destinationPlaceId?: string;
    isPrivate?: boolean;
    startsAt?: string;
    initialInvites?: number[];
    destinationRequired?: boolean;
  };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }

  let startsAtDate: Date | null = null;
  if (startsAt) {
    startsAtDate = new Date(startsAt);
    if (isNaN(startsAtDate.getTime())) {
      res.status(400).json({ error: "startsAt is not a valid date" });
      return;
    }
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [event] = await db
    .insert(eventsTable)
    .values({
      ownerUserId: profile.id,
      title: title.trim(),
      restaurantName: restaurantName?.trim() || null,
      destinationAddress: destinationAddress?.trim() || null,
      destinationLat: typeof destinationLat === "number" ? destinationLat : null,
      destinationLng: typeof destinationLng === "number" ? destinationLng : null,
      destinationPlaceId: destinationPlaceId?.trim() || null,
      isPrivate: isPrivate === true,
      destinationRequired: destinationRequired !== false,
      startsAt: startsAtDate,
    })
    .returning();

  await db.insert(eventParticipantsTable).values({ eventId: event.id, userId: profile.id, role: "host" });

  if (Array.isArray(initialInvites) && initialInvites.length > 0) {
    const uniqueInvitees = [...new Set(initialInvites)].filter((uid) => uid !== profile.id);
    if (uniqueInvitees.length > 0) {
      const acceptedFriendships = await db
        .select()
        .from(friendshipsTable)
        .where(
          and(
            or(
              and(
                eq(friendshipsTable.requesterUserId, profile.id),
                inArray(friendshipsTable.addresseeUserId, uniqueInvitees),
              ),
              and(
                inArray(friendshipsTable.requesterUserId, uniqueInvitees),
                eq(friendshipsTable.addresseeUserId, profile.id),
              ),
            ),
            eq(friendshipsTable.status, "accepted"),
          ),
        );

      const acceptedFriendIds = new Set(
        acceptedFriendships.map((f) =>
          f.requesterUserId === profile.id ? f.addresseeUserId : f.requesterUserId,
        ),
      );

      const verifiedInvitees = uniqueInvitees.filter((uid) => acceptedFriendIds.has(uid));
      if (verifiedInvitees.length > 0) {
        await db.insert(eventParticipantsTable).values(
          verifiedInvitees.map((uid) => ({ eventId: event.id, userId: uid, role: "invited" as const })),
        );
      }
    }
  }

  res.status(201).json(event);
});

// ─── GET /events ──────────────────────────────────────────────────────────────

router.get("/events", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(401).json({ error: "Profile not found. Complete registration first." }); return; }

  const rows = await db
    .select({
      id: eventsTable.id,
      ownerUserId: eventsTable.ownerUserId,
      title: eventsTable.title,
      restaurantName: eventsTable.restaurantName,
      destinationAddress: eventsTable.destinationAddress,
      destinationLat: eventsTable.destinationLat,
      destinationLng: eventsTable.destinationLng,
      destinationPlaceId: eventsTable.destinationPlaceId,
      isPrivate: eventsTable.isPrivate,
      startsAt: eventsTable.startsAt,
      cancelledAt: eventsTable.cancelledAt,
      cancelledAcknowledgedAt: eventParticipantsTable.cancelledAcknowledgedAt,
      createdAt: eventsTable.createdAt,
      role: eventParticipantsTable.role,
      goingCount: sql<number>`(
        SELECT COUNT(*) FROM event_participants ep2
        WHERE ep2.event_id = ${eventsTable.id}
        AND ep2.role IN ('host', 'participant', 'accepted')
      )`.as("going_count"),
      notGoingCount: sql<number>`(
        SELECT COUNT(*) FROM event_participants ep2
        WHERE ep2.event_id = ${eventsTable.id}
        AND ep2.role = 'declined'
      )`.as("not_going_count"),
      notRespondedCount: sql<number>`(
        SELECT COUNT(*) FROM event_participants ep2
        WHERE ep2.event_id = ${eventsTable.id}
        AND ep2.role = 'invited'
      )`.as("not_responded_count"),
      unreadChatCount: sql<number>`(
        SELECT COUNT(*) FROM event_messages em
        WHERE em.event_id = ${eventsTable.id}
        AND em.created_at > COALESCE(${eventParticipantsTable.chatLastReadAt}, '-infinity'::timestamp)
      )`.as("unread_chat_count"),
    })
    .from(eventsTable)
    .innerJoin(eventParticipantsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(
      and(
        eq(eventParticipantsTable.userId, profile.id),
        inArray(eventParticipantsTable.role, FULL_ACCESS_ROLES),
        or(
          isNull(eventsTable.cancelledAt),
          isNull(eventParticipantsTable.cancelledAcknowledgedAt),
        ),
      ),
    )
    .orderBy(desc(eventsTable.createdAt));

  res.json(rows);
});

// ─── GET /events/invitations ──────────────────────────────────────────────────
// MUST be registered before GET /events/:eventId

router.get("/events/invitations", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(401).json({ error: "Profile not found. Complete registration first." }); return; }

  const hostProfile = aliasedTable(userProfilesTable, "host_profile");

  const rows = await db
    .select({
      eventId: eventsTable.id,
      eventTitle: eventsTable.title,
      restaurantName: eventsTable.restaurantName,
      isPrivate: eventsTable.isPrivate,
      invitedAt: eventParticipantsTable.joinedAt,
      hostDisplayName: hostProfile.displayName,
      hostEmail: hostProfile.email,
      hostHandle: hostProfile.handle,
    })
    .from(eventParticipantsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, eventParticipantsTable.eventId))
    .innerJoin(hostProfile, eq(hostProfile.id, eventsTable.ownerUserId))
    .where(
      and(
        eq(eventParticipantsTable.userId, profile.id),
        eq(eventParticipantsTable.role, "invited"),
        isNull(eventsTable.cancelledAt),
      ),
    )
    .orderBy(desc(eventParticipantsTable.joinedAt));

  res.json(
    rows.map((r) => ({
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      restaurantName: r.restaurantName,
      isPrivate: r.isPrivate,
      invitedAt: r.invitedAt,
      hostDisplayName: resolveDisplayName(r.hostDisplayName, r.hostHandle),
      hostHandle: r.hostHandle,
    })),
  );
});

// ─── GET /events/cancelled ────────────────────────────────────────────────────
// MUST be registered before GET /events/:eventId

router.get("/events/cancelled", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(401).json({ error: "Profile not found. Complete registration first." }); return; }

  const rows = await db
    .select({
      id: eventsTable.id,
      ownerUserId: eventsTable.ownerUserId,
      title: eventsTable.title,
      restaurantName: eventsTable.restaurantName,
      destinationAddress: eventsTable.destinationAddress,
      destinationLat: eventsTable.destinationLat,
      destinationLng: eventsTable.destinationLng,
      destinationPlaceId: eventsTable.destinationPlaceId,
      isPrivate: eventsTable.isPrivate,
      startsAt: eventsTable.startsAt,
      cancelledAt: eventsTable.cancelledAt,
      cancelledAcknowledgedAt: eventParticipantsTable.cancelledAcknowledgedAt,
      createdAt: eventsTable.createdAt,
      role: eventParticipantsTable.role,
    })
    .from(eventsTable)
    .innerJoin(eventParticipantsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
    .where(
      and(
        eq(eventParticipantsTable.userId, profile.id),
        inArray(eventParticipantsTable.role, FULL_ACCESS_ROLES),
        isNotNull(eventsTable.cancelledAt),
        isNotNull(eventParticipantsTable.cancelledAcknowledgedAt),
      ),
    )
    .orderBy(desc(eventsTable.cancelledAt));

  res.json(rows);
});

// ─── PATCH /events/:eventId/cancelled-acknowledgement ─────────────────────────
// MUST be registered before GET /events/:eventId

router.patch("/events/:eventId/cancelled-acknowledgement", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(404).json({ error: "Event not found" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (!event.cancelledAt) {
    res.status(400).json({ error: "Event is not cancelled" }); return;
  }

  // Idempotent: already acknowledged
  if (participation.cancelledAcknowledgedAt) {
    res.json({ acknowledged: true, acknowledgedAt: participation.cancelledAcknowledgedAt }); return;
  }

  const now = new Date();
  await db
    .update(eventParticipantsTable)
    .set({ cancelledAcknowledgedAt: now })
    .where(eq(eventParticipantsTable.id, participation.id));

  res.json({ acknowledged: true, acknowledgedAt: now });
});

// ─── Join code ───────────────────────────────────────────────────────────────

// ─── Public join preview (no auth required) ──────────────────────────────────

router.get("/join/:code", async (req, res) => {
  const code = (req.params.code ?? "").trim().toUpperCase();
  if (!code) { res.status(400).json({ error: "Code is required" }); return; }

  const [share] = await db
    .select()
    .from(eventSharesTable)
    .where(and(eq(eventSharesTable.joinCode, code), eq(eventSharesTable.isActive, true)))
    .limit(1);

  if (!share) { res.status(404).json({ error: "This invite link is invalid or has been revoked." }); return; }

  const event = await resolveEvent(share.eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(410).json({ error: "This event has been cancelled." }); return; }

  const [hostPart] = await db
    .select({ userId: eventParticipantsTable.userId })
    .from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, share.eventId), eq(eventParticipantsTable.role, "host")))
    .limit(1);

  let hostDisplayName = "Unknown";
  if (hostPart && hostPart.userId !== null) {
    const [hostProfile] = await db
      .select({ displayName: userProfilesTable.displayName, handle: userProfilesTable.handle })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, hostPart.userId))
      .limit(1);
    if (hostProfile) {
      hostDisplayName = resolveDisplayName(hostProfile.displayName, hostProfile.handle);
    }
  }

  const allParts = await db
    .select({ userId: eventParticipantsTable.userId })
    .from(eventParticipantsTable)
    .where(eq(eventParticipantsTable.eventId, share.eventId));

  res.json({
    eventId: event.id,
    eventName: event.title,
    hostDisplayName,
    participantCount: allParts.length,
    startsAt: event.startsAt,
    restaurantName: event.restaurantName ?? null,
  });
});

router.post("/events/join", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { joinCode } = req.body as { joinCode?: string };
  if (!joinCode?.trim()) { res.status(400).json({ error: "joinCode is required" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const normalised = joinCode.trim().toUpperCase();

  const [share] = await db
    .select()
    .from(eventSharesTable)
    .where(and(eq(eventSharesTable.joinCode, normalised), eq(eventSharesTable.isActive, true)))
    .limit(1);

  if (!share) { res.status(404).json({ error: "Invalid join code" }); return; }

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, share.eventId))
    .limit(1);

  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  if (event.isPrivate) {
    res.status(403).json({ error: "This event is invite-only. Ask the host to invite you." });
    return;
  }

  try {
    await db.insert(eventParticipantsTable).values({ eventId: share.eventId, userId: profile.id, role: "participant" });
  } catch (err: unknown) {
    if (isPgUniqueViolation(err)) { res.status(409).json({ error: "Already joined" }); return; }
    throw err;
  }

  // Auto-friend: establish friendship between joiner and host
  const [hostPart] = await db
    .select({ userId: eventParticipantsTable.userId })
    .from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, share.eventId), eq(eventParticipantsTable.role, "host")))
    .limit(1);

  if (hostPart && hostPart.userId !== null && hostPart.userId !== profile.id) {
    const [existingFs] = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.requesterUserId, profile.id), eq(friendshipsTable.addresseeUserId, hostPart.userId)),
          and(eq(friendshipsTable.requesterUserId, hostPart.userId), eq(friendshipsTable.addresseeUserId, profile.id)),
        ),
      )
      .limit(1);

    if (!existingFs) {
      await db.insert(friendshipsTable).values({
        requesterUserId: profile.id,
        addresseeUserId: hostPart.userId,
        status: "pending",
      });
    } else if (existingFs.requesterUserId === hostPart.userId && existingFs.status === "pending") {
      await db.update(friendshipsTable).set({ status: "accepted" }).where(eq(friendshipsTable.id, existingFs.id));
    }
  }

  res.json(event);
});

router.get("/events/:eventId/share", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can view the join code" }); return; }

  const [existing] = await db
    .select()
    .from(eventSharesTable)
    .where(and(eq(eventSharesTable.eventId, eventId), eq(eventSharesTable.isActive, true)))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "No active join code" }); return; }

  res.json(existing);
});

router.post("/events/:eventId/share", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can generate a join code" }); return; }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [existing] = await db
    .select()
    .from(eventSharesTable)
    .where(and(eq(eventSharesTable.eventId, eventId), eq(eventSharesTable.isActive, true)))
    .limit(1);

  if (existing) { res.status(201).json(existing); return; }

  const [share] = await db
    .insert(eventSharesTable)
    .values({ eventId, joinCode: generateCode() })
    .returning();

  res.status(201).json(share);
});

router.delete("/events/:eventId/share", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can revoke a join code" }); return; }

  const [revoked] = await db
    .update(eventSharesTable)
    .set({ isActive: false })
    .where(and(eq(eventSharesTable.eventId, eventId), eq(eventSharesTable.isActive, true)))
    .returning();

  if (!revoked) { res.status(404).json({ error: "No active join code to revoke" }); return; }

  res.status(204).send();
});

// ─── Event detail ─────────────────────────────────────────────────────────────

router.get("/events/:eventId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }

  const accessLevel: "full" | "limited" = FULL_ACCESS_ROLES.includes(participation.role)
    ? "full"
    : "limited";

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);

  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Lazy finalization: auto-decide winner if deadline has passed and no winner yet
  if (event.votingOpenedAt && !event.destinationDecidedAt && event.votingDeadline && event.votingDeadline <= new Date()) {
    await autoFinalizeVoting(eventId);
    // Re-fetch to get the updated state
    const [refreshed] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (refreshed) Object.assign(event, refreshed);
  }

  const rawUserParticipants = await db
    .select({
      userId: eventParticipantsTable.userId,
      displayName: userProfilesTable.displayName,
      handle: userProfilesTable.handle,
      avatarObjectPath: userProfilesTable.avatarObjectPath,
      role: eventParticipantsTable.role,
      reminderSentAt: eventParticipantsTable.reminderSentAt,
    })
    .from(eventParticipantsTable)
    .innerJoin(
      userProfilesTable,
      eq(userProfilesTable.id, eventParticipantsTable.userId),
    )
    .where(and(
      eq(eventParticipantsTable.eventId, eventId),
      isNotNull(eventParticipantsTable.userId),
    ));

  const rawGuestParticipants = await db
    .select({
      id: eventParticipantsTable.id,
      guestName: eventParticipantsTable.guestName,
      role: eventParticipantsTable.role,
      savedGuestId: eventParticipantsTable.savedGuestId,
      epCashAppHandle: eventParticipantsTable.cashAppHandle,
      epVenmoHandle: eventParticipantsTable.venmoHandle,
      sgCashAppHandle: savedGuestsTable.cashAppHandle,
      sgVenmoHandle: savedGuestsTable.venmoHandle,
      sgPhoneNumber: savedGuestsTable.phoneNumber,
      reminderSentAt: eventParticipantsTable.reminderSentAt,
    })
    .from(eventParticipantsTable)
    .leftJoin(savedGuestsTable, eq(savedGuestsTable.id, eventParticipantsTable.savedGuestId))
    .where(and(
      eq(eventParticipantsTable.eventId, eventId),
      isNull(eventParticipantsTable.userId),
    ));

  const participants = [
    ...await Promise.all(
      rawUserParticipants.map(async (p) => {
        const avatarUrl = p.avatarObjectPath
          ? await signedAvatarUrl(p.avatarObjectPath).catch(() => null)
          : null;
        return {
          userId: p.userId,
          guestParticipantId: null as number | null,
          displayName: resolveDisplayName(p.displayName, p.handle),
          handle: p.handle,
          avatarUrl,
          role: p.role,
          cashAppHandle: null as string | null,
          venmoHandle: null as string | null,
          phoneNumber: null as string | null,
          reminderSentAt: p.reminderSentAt ?? null,
        };
      }),
    ),
    ...rawGuestParticipants.map((p) => ({
      userId: null as number | null,
      guestParticipantId: p.id,
      displayName: p.guestName ?? "Guest",
      handle: "",
      avatarUrl: null,
      role: p.role,
      cashAppHandle: (p.savedGuestId ? p.sgCashAppHandle : p.epCashAppHandle) ?? null,
      venmoHandle: (p.savedGuestId ? p.sgVenmoHandle : p.epVenmoHandle) ?? null,
      phoneNumber: p.sgPhoneNumber ?? null,
      reminderSentAt: p.reminderSentAt ?? null,
    })),
  ];

  // ── Limited access: return redacted event info only ───────────────────────
  // Invited and declined users must not see destination details or the full
  // participant roster; those are gated on acceptance per product intent.
  if (accessLevel === "limited") {
    const { restaurantName: _rn, destinationAddress: _da, destinationLat: _dlat, destinationLng: _dlng, destinationPlaceId: _dpid, ...redactedEvent } = event;
    res.json({
      ...redactedEvent,
      accessLevel,
      role: participation.role,
      myUserId: profile.id,
      participants: [],
    });
    return;
  }

  // ── Full access: fetch receipt, items, assignments, photos ─────────────────

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  const items = receipt
    ? await db
        .select()
        .from(receiptItemsTable)
        .where(eq(receiptItemsTable.receiptId, receipt.id))
        .orderBy(asc(receiptItemsTable.createdAt))
    : [];

  const itemIds = items.map((i) => i.id);
  const guestEpAlias = aliasedTable(eventParticipantsTable, "guest_ep");
  const assignments =
    itemIds.length > 0
      ? await db
          .select({
            id: itemAssignmentsTable.id,
            receiptItemId: itemAssignmentsTable.receiptItemId,
            userId: itemAssignmentsTable.userId,
            guestParticipantId: itemAssignmentsTable.guestParticipantId,
            claimed: itemAssignmentsTable.claimed,
            userDisplayName: userProfilesTable.displayName,
            userHandle: userProfilesTable.handle,
            guestName: guestEpAlias.guestName,
          })
          .from(itemAssignmentsTable)
          .leftJoin(
            userProfilesTable,
            eq(userProfilesTable.id, itemAssignmentsTable.userId),
          )
          .leftJoin(
            guestEpAlias,
            eq(guestEpAlias.id, itemAssignmentsTable.guestParticipantId),
          )
          .where(inArray(itemAssignmentsTable.receiptItemId, itemIds))
      : [];

  const rawPhotos = receipt
    ? await db
        .select()
        .from(receiptPhotosTable)
        .where(eq(receiptPhotosTable.receiptId, receipt.id))
        .orderBy(asc(receiptPhotosTable.createdAt))
    : [];

  const photos = await Promise.all(
    rawPhotos.map(async (p) => {
      const scanLockedAt = p.scanLockedAt ? p.scanLockedAt.toISOString() : null;
      try {
        const signedImageUrl = await signedUrlForPhoto(p.objectPath);
        return { id: p.id, createdAt: p.createdAt, signedImageUrl, scanLockedAt };
      } catch {
        return { id: p.id, createdAt: p.createdAt, signedImageUrl: null, error: "unavailable", scanLockedAt };
      }
    }),
  );

  const rawEventPhotos = await db
    .select()
    .from(eventPhotosTable)
    .where(eq(eventPhotosTable.eventId, eventId))
    .orderBy(asc(eventPhotosTable.createdAt));

  const eventPhotos = await Promise.all(
    rawEventPhotos.map(async (p) => {
      try {
        const signedImageUrl = await signedUrlForPhoto(p.objectPath);
        return { id: p.id, uploadedByUserId: p.uploadedByUserId, createdAt: p.createdAt, signedImageUrl };
      } catch {
        return { id: p.id, uploadedByUserId: p.uploadedByUserId, createdAt: p.createdAt, signedImageUrl: null, error: "unavailable" };
      }
    }),
  );

  // ── Suggestions (for destination-less events) ────────────────────────────────
  const rawSuggestions = await db
    .select({
      id: eventVenueSuggestionsTable.id,
      eventId: eventVenueSuggestionsTable.eventId,
      proposerUserId: eventVenueSuggestionsTable.proposerUserId,
      proposerDisplayName: userProfilesTable.displayName,
      proposerHandle: userProfilesTable.handle,
      placeId: eventVenueSuggestionsTable.placeId,
      placeName: eventVenueSuggestionsTable.placeName,
      placeAddress: eventVenueSuggestionsTable.placeAddress,
      placeLat: eventVenueSuggestionsTable.placeLat,
      placeLng: eventVenueSuggestionsTable.placeLng,
      rating: eventVenueSuggestionsTable.rating,
      photoUrl: eventVenueSuggestionsTable.photoUrl,
      rescinded: eventVenueSuggestionsTable.rescinded,
      createdAt: eventVenueSuggestionsTable.createdAt,
    })
    .from(eventVenueSuggestionsTable)
    .innerJoin(userProfilesTable, eq(userProfilesTable.id, eventVenueSuggestionsTable.proposerUserId))
    .where(eq(eventVenueSuggestionsTable.eventId, eventId))
    .orderBy(asc(eventVenueSuggestionsTable.createdAt));

  const suggestionIds = rawSuggestions.map((s) => s.id);
  const allVotes = suggestionIds.length > 0
    ? await db
        .select()
        .from(eventVenueVotesTable)
        .where(inArray(eventVenueVotesTable.suggestionId, suggestionIds))
    : [];

  const suggestions = rawSuggestions.map((s) => {
    const votes = allVotes.filter((v) => v.suggestionId === s.id);
    return {
      id: s.id,
      eventId: s.eventId,
      proposerUserId: s.proposerUserId,
      proposerDisplayName: resolveDisplayName(s.proposerDisplayName, s.proposerHandle),
      placeId: s.placeId,
      placeName: s.placeName,
      placeAddress: s.placeAddress,
      placeLat: s.placeLat,
      placeLng: s.placeLng,
      rating: s.rating,
      photoUrl: s.photoUrl,
      rescinded: s.rescinded,
      createdAt: s.createdAt,
      voteCount: votes.length,
      myVote: votes.some((v) => v.voterUserId === profile.id),
    };
  });

  // ── Guest payment records (host-only: included so mobile gets status in one call) ─
  const guestPayments = participation.role === "host"
    ? await (async () => {
        const appLessGuestIds = rawGuestParticipants.map((p) => p.id);
        if (appLessGuestIds.length === 0) return [];
        return db
          .select()
          .from(guestPaymentRequestsTable)
          .where(inArray(guestPaymentRequestsTable.eventParticipantId, appLessGuestIds));
      })()
    : undefined;

  res.json({
    ...event,
    accessLevel,
    role: participation.role,
    myUserId: profile.id,
    notificationsMuted: participation.notificationsMuted,
    receipt: receipt ?? null,
    items,
    assignments: assignments.map((a) => ({
      id: a.id,
      receiptItemId: a.receiptItemId,
      userId: a.userId,
      guestParticipantId: a.guestParticipantId,
      claimed: a.claimed,
      userDisplayName: a.userId
        ? resolveDisplayName(a.userDisplayName ?? "", a.userHandle ?? "")
        : (a.guestName ?? ""),
    })),
    participants,
    photos,
    eventPhotos,
    suggestions,
    votingOpenedAt: event.votingOpenedAt ?? null,
    votingDeadline: event.votingDeadline ?? null,
    destinationDecidedAt: event.destinationDecidedAt ?? null,
    ...(guestPayments !== undefined ? { guestPayments } : {}),
  });
});

// ─── PATCH /events/:eventId/me/notifications ─────────────────────────────────
// Toggles the per-event notification mute for the authenticated participant.
// Body: { muted: boolean }  Response: { muted: boolean }

router.patch("/events/:eventId/me/notifications", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const { muted } = req.body as { muted?: unknown };
  if (typeof muted !== "boolean") { res.status(400).json({ error: "muted must be a boolean" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }

  await db
    .update(eventParticipantsTable)
    .set({ notificationsMuted: muted })
    .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.userId, profile.id)));

  res.json({ muted });
});

// ─── POST /events/:eventId/invitations ────────────────────────────────────────

router.post("/events/:eventId/invitations", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const { userId } = req.body as { userId?: unknown };
  if (typeof userId !== "number" || !Number.isInteger(userId)) {
    res.status(400).json({ error: "userId must be an integer" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can invite users" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  if (userId === profile.id) {
    res.status(400).json({ error: "Cannot invite yourself" });
    return;
  }

  const [targetUser] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.id, userId))
    .limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(
            eq(friendshipsTable.requesterUserId, profile.id),
            eq(friendshipsTable.addresseeUserId, userId),
          ),
          and(
            eq(friendshipsTable.requesterUserId, userId),
            eq(friendshipsTable.addresseeUserId, profile.id),
          ),
        ),
        eq(friendshipsTable.status, "accepted"),
      ),
    )
    .limit(1);

  if (!friendship) {
    res.status(403).json({ error: "You can only invite accepted friends" });
    return;
  }

  const [existing] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.role === "accepted" || existing.role === "participant") {
      res.status(409).json({ error: "User is already a participant" });
    } else if (existing.role === "invited") {
      res.status(409).json({ error: "User has already been invited" });
    } else if (existing.role === "declined") {
      res.status(409).json({ error: "User declined this invitation; remove them first" });
    } else {
      res.status(409).json({ error: "User is already in this event" });
    }
    return;
  }

  const [inserted] = await db
    .insert(eventParticipantsTable)
    .values({ eventId, userId, role: "invited" })
    .returning();

  // Notify the invited user immediately so they don't have to discover it by
  // opening the app. Use getTokensForUsers (not getUnmutedTokensForEvent) because
  // the new invitee isn't a full participant yet and won't appear in that join.
  void (async () => {
    const tokens = await getTokensForUsers([userId]);
    if (tokens.length) {
      const hostName = resolveDisplayName(profile.displayName, profile.handle) ?? "Someone";
      const eventTitle = event.title ?? "an event";
      void sendExpoPush(
        tokens,
        "You're invited! 🎉",
        `${hostName} invited you to ${eventTitle}`,
        { screen: "event", eventId },
      );
    }
  })();

  const avatarUrl = targetUser.avatarObjectPath
    ? await signedAvatarUrl(targetUser.avatarObjectPath).catch(() => null)
    : null;

  res.status(201).json({
    participantId: inserted.id,
    userId: inserted.userId,
    status: "invited",
    user: {
      id: targetUser.id,
      displayName: resolveDisplayName(targetUser.displayName, targetUser.handle),
      handle: targetUser.handle,
      avatarUrl,
      bio: targetUser.bio,
    },
  });
});

// ─── PATCH /events/:eventId/invitations/me ────────────────────────────────────

router.patch("/events/:eventId/invitations/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const { action } = req.body as { action?: string };
  if (action !== "accept" && action !== "decline") {
    res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Invitation not found" }); return; }

  const RSVP_ELIGIBLE_ROLES = ["invited", "accepted", "declined"];
  if (!RSVP_ELIGIBLE_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Cannot change RSVP status for this event" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const newRole = action === "accept" ? "accepted" : "declined";

  await db
    .update(eventParticipantsTable)
    .set({ role: newRole })
    .where(eq(eventParticipantsTable.id, participation.id));

  // Fire-and-forget push to the host
  void (async () => {
    const hostRows = await db
      .select({ userId: eventParticipantsTable.userId })
      .from(eventParticipantsTable)
      .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.role, "host")));
    const hostUserIds = hostRows.map((r) => r.userId).filter((id): id is number => id !== null);
    const tokens = await getUnmutedTokensForEvent(eventId, hostUserIds);
    const guestName = resolveDisplayName(profile.displayName, profile.handle) ?? "Someone";
    const eventTitle = event.title ?? "your event";
    const pushBody =
      action === "accept"
        ? `🎉 ${guestName} accepted your invitation to ${eventTitle}`
        : `${guestName} can't make it to ${eventTitle}`;
    void sendExpoPush(tokens, action === "accept" ? "New RSVP" : "RSVP Update", pushBody, {
      screen: "event",
      eventId,
    });
  })();

  res.json({ status: newRole });
});

// ─── DELETE /events/:eventId/participants/:targetUserId ───────────────────────

router.delete("/events/:eventId/participants/:targetUserId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const targetUserId = parseInt(req.params.targetUserId, 10);
  if (isNaN(eventId) || isNaN(targetUserId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can remove participants" });
    return;
  }

  const [targetParticipation] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!targetParticipation) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  if (targetParticipation.role === "host") {
    res.status(403).json({ error: "Cannot remove the host" });
    return;
  }

  await db
    .delete(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, targetParticipation.id));

  res.status(204).send();
});

// ─── POST /events/:eventId/guests ────────────────────────────────────────────

router.post("/events/:eventId/guests", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can add guests" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const body = req.body as { name?: unknown; saveGuest?: unknown; savedGuestId?: unknown };

  // If savedGuestId is provided, re-add a known saved contact
  if (body.savedGuestId !== undefined && body.savedGuestId !== null) {
    const savedGuestId = parseInt(String(body.savedGuestId), 10);
    if (isNaN(savedGuestId)) {
      res.status(400).json({ error: "savedGuestId must be a number" });
      return;
    }
    const [savedGuest] = await db
      .select()
      .from(savedGuestsTable)
      .where(and(eq(savedGuestsTable.id, savedGuestId), eq(savedGuestsTable.hostUserId, profile.id)))
      .limit(1);
    if (!savedGuest) {
      res.status(404).json({ error: "Saved contact not found" });
      return;
    }
    await db
      .insert(eventParticipantsTable)
      .values({ eventId, userId: null, guestName: savedGuest.name, role: "guest", savedGuestId });

    const rawUserParts = await db
      .select({
        userId: eventParticipantsTable.userId,
        displayName: userProfilesTable.displayName,
        handle: userProfilesTable.handle,
        avatarObjectPath: userProfilesTable.avatarObjectPath,
        role: eventParticipantsTable.role,
      })
      .from(eventParticipantsTable)
      .innerJoin(userProfilesTable, eq(userProfilesTable.id, eventParticipantsTable.userId))
      .where(and(eq(eventParticipantsTable.eventId, eventId), isNotNull(eventParticipantsTable.userId)));

    const rawGuestParts = await db
      .select({
        id: eventParticipantsTable.id,
        guestName: eventParticipantsTable.guestName,
        role: eventParticipantsTable.role,
        savedGuestId: eventParticipantsTable.savedGuestId,
        epCashAppHandle: eventParticipantsTable.cashAppHandle,
        epVenmoHandle: eventParticipantsTable.venmoHandle,
        sgCashAppHandle: savedGuestsTable.cashAppHandle,
        sgVenmoHandle: savedGuestsTable.venmoHandle,
        sgPhoneNumber: savedGuestsTable.phoneNumber,
      })
      .from(eventParticipantsTable)
      .leftJoin(savedGuestsTable, eq(savedGuestsTable.id, eventParticipantsTable.savedGuestId))
      .where(and(eq(eventParticipantsTable.eventId, eventId), isNull(eventParticipantsTable.userId)));

    const participants = [
      ...await Promise.all(
        rawUserParts.map(async (p) => {
          const avatarUrl = p.avatarObjectPath
            ? await signedAvatarUrl(p.avatarObjectPath).catch(() => null)
            : null;
          return {
            userId: p.userId as number,
            guestParticipantId: null as number | null,
            displayName: resolveDisplayName(p.displayName, p.handle),
            handle: p.handle ?? "",
            avatarUrl,
            role: p.role,
            cashAppHandle: null as string | null,
            venmoHandle: null as string | null,
            phoneNumber: null as string | null,
          };
        }),
      ),
      ...rawGuestParts.map((p) => ({
        userId: null as number | null,
        guestParticipantId: p.id,
        displayName: p.guestName ?? "Guest",
        handle: "",
        avatarUrl: null,
        role: p.role,
        cashAppHandle: (p.savedGuestId ? p.sgCashAppHandle : p.epCashAppHandle) ?? null,
        venmoHandle: (p.savedGuestId ? p.sgVenmoHandle : p.epVenmoHandle) ?? null,
        phoneNumber: p.sgPhoneNumber ?? null,
      })),
    ];

    res.status(201).json({ participants });
    return;
  }

  const { name } = body;
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const guestName = name.trim().slice(0, 100);

  // Optionally save as a reusable contact
  let savedGuestId: number | null = null;
  if (body.saveGuest === true) {
    const [saved] = await db
      .insert(savedGuestsTable)
      .values({ hostUserId: profile.id, name: guestName })
      .returning();
    savedGuestId = saved?.id ?? null;
  }

  await db
    .insert(eventParticipantsTable)
    .values({ eventId, userId: null, guestName, role: "guest", ...(savedGuestId !== null ? { savedGuestId } : {}) });

  // Return the full updated participant list so clients don't need a separate refetch
  const rawUserParts = await db
    .select({
      userId: eventParticipantsTable.userId,
      displayName: userProfilesTable.displayName,
      handle: userProfilesTable.handle,
      avatarObjectPath: userProfilesTable.avatarObjectPath,
      role: eventParticipantsTable.role,
    })
    .from(eventParticipantsTable)
    .innerJoin(userProfilesTable, eq(userProfilesTable.id, eventParticipantsTable.userId))
    .where(and(eq(eventParticipantsTable.eventId, eventId), isNotNull(eventParticipantsTable.userId)));

  const rawGuestParts = await db
    .select({
      id: eventParticipantsTable.id,
      guestName: eventParticipantsTable.guestName,
      role: eventParticipantsTable.role,
      savedGuestId: eventParticipantsTable.savedGuestId,
      epCashAppHandle: eventParticipantsTable.cashAppHandle,
      epVenmoHandle: eventParticipantsTable.venmoHandle,
      sgCashAppHandle: savedGuestsTable.cashAppHandle,
      sgVenmoHandle: savedGuestsTable.venmoHandle,
      sgPhoneNumber: savedGuestsTable.phoneNumber,
    })
    .from(eventParticipantsTable)
    .leftJoin(savedGuestsTable, eq(savedGuestsTable.id, eventParticipantsTable.savedGuestId))
    .where(and(eq(eventParticipantsTable.eventId, eventId), isNull(eventParticipantsTable.userId)));

  const participants = [
    ...await Promise.all(
      rawUserParts.map(async (p) => {
        const avatarUrl = p.avatarObjectPath
          ? await signedAvatarUrl(p.avatarObjectPath).catch(() => null)
          : null;
        return {
          userId: p.userId as number,
          guestParticipantId: null as number | null,
          displayName: resolveDisplayName(p.displayName, p.handle),
          handle: p.handle ?? "",
          avatarUrl,
          role: p.role,
          cashAppHandle: null as string | null,
          venmoHandle: null as string | null,
          phoneNumber: null as string | null,
        };
      }),
    ),
    ...rawGuestParts.map((p) => ({
      userId: null as number | null,
      guestParticipantId: p.id,
      displayName: p.guestName ?? "Guest",
      handle: "",
      avatarUrl: null,
      role: p.role,
      cashAppHandle: (p.savedGuestId ? p.sgCashAppHandle : p.epCashAppHandle) ?? null,
      venmoHandle: (p.savedGuestId ? p.sgVenmoHandle : p.epVenmoHandle) ?? null,
      phoneNumber: p.sgPhoneNumber ?? null,
    })),
  ];

  res.status(201).json({ participants });
});

// ─── DELETE /events/:eventId/guests/:guestParticipantId ──────────────────────

router.delete("/events/:eventId/guests/:guestParticipantId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const guestParticipantId = parseInt(req.params.guestParticipantId, 10);
  if (isNaN(eventId) || isNaN(guestParticipantId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can remove guests" });
    return;
  }

  const [guest] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.id, guestParticipantId),
        eq(eventParticipantsTable.eventId, eventId),
        isNull(eventParticipantsTable.userId),
      ),
    )
    .limit(1);

  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }

  await db
    .delete(itemAssignmentsTable)
    .where(eq(itemAssignmentsTable.guestParticipantId, guestParticipantId));

  await db
    .delete(eventParticipantsTable)
    .where(eq(eventParticipantsTable.id, guestParticipantId));

  res.status(204).send();
});

// ─── PATCH /events/:eventId/guests/:guestParticipantId ────────────────────────
// Update Cash App / Venmo payment info for an app-less guest.
// Writes to saved_guests when the participant has a savedGuestId (so info
// carries over to future events); otherwise writes to event_participants only.

router.patch("/events/:eventId/guests/:guestParticipantId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const guestParticipantId = parseInt(req.params.guestParticipantId, 10);
  if (isNaN(eventId) || isNaN(guestParticipantId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can update guest payment info" });
    return;
  }

  const [guest] = await db
    .select()
    .from(eventParticipantsTable)
    .where(
      and(
        eq(eventParticipantsTable.id, guestParticipantId),
        eq(eventParticipantsTable.eventId, eventId),
        isNull(eventParticipantsTable.userId),
      ),
    )
    .limit(1);

  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }

  const { cashAppHandle, venmoHandle, phoneNumber } = req.body ?? {};
  if (cashAppHandle === undefined && venmoHandle === undefined && phoneNumber === undefined) {
    res.status(400).json({ error: "cashAppHandle, venmoHandle, or phoneNumber is required" });
    return;
  }

  const cleanHandle = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 50) : null;

  const cleanPhone = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : null;

  const updates: { cashAppHandle?: string | null; venmoHandle?: string | null; phoneNumber?: string | null } = {};
  if (cashAppHandle !== undefined) updates.cashAppHandle = cleanHandle(cashAppHandle);
  if (venmoHandle !== undefined) updates.venmoHandle = cleanHandle(venmoHandle);
  if (phoneNumber !== undefined) updates.phoneNumber = cleanPhone(phoneNumber);

  if (guest.savedGuestId) {
    // Persist at the saved_guests level so it carries over to future events
    await db
      .update(savedGuestsTable)
      .set(updates)
      .where(and(eq(savedGuestsTable.id, guest.savedGuestId), eq(savedGuestsTable.hostUserId, profile.id)));
  } else {
    // No saved guest record — persist per-event only (phoneNumber only stored on saved_guests)
    const epUpdates: { cashAppHandle?: string | null; venmoHandle?: string | null } = {};
    if (updates.cashAppHandle !== undefined) epUpdates.cashAppHandle = updates.cashAppHandle;
    if (updates.venmoHandle !== undefined) epUpdates.venmoHandle = updates.venmoHandle;
    if (Object.keys(epUpdates).length > 0) {
      await db
        .update(eventParticipantsTable)
        .set(epUpdates)
        .where(eq(eventParticipantsTable.id, guestParticipantId));
    }
  }

  // Return the fresh participant with resolved handles
  const [updated] = await db
    .select({
      id: eventParticipantsTable.id,
      guestName: eventParticipantsTable.guestName,
      role: eventParticipantsTable.role,
      savedGuestId: eventParticipantsTable.savedGuestId,
      epCashAppHandle: eventParticipantsTable.cashAppHandle,
      epVenmoHandle: eventParticipantsTable.venmoHandle,
      sgCashAppHandle: savedGuestsTable.cashAppHandle,
      sgVenmoHandle: savedGuestsTable.venmoHandle,
      sgPhoneNumber: savedGuestsTable.phoneNumber,
    })
    .from(eventParticipantsTable)
    .leftJoin(savedGuestsTable, eq(savedGuestsTable.id, eventParticipantsTable.savedGuestId))
    .where(eq(eventParticipantsTable.id, guestParticipantId))
    .limit(1);

  if (!updated) { res.status(404).json({ error: "Guest not found after update" }); return; }

  res.status(200).json({
    participant: {
      guestParticipantId: updated.id,
      displayName: updated.guestName ?? "Guest",
      cashAppHandle: (updated.savedGuestId ? updated.sgCashAppHandle : updated.epCashAppHandle) ?? null,
      venmoHandle: (updated.savedGuestId ? updated.sgVenmoHandle : updated.epVenmoHandle) ?? null,
      phoneNumber: updated.sgPhoneNumber ?? null,
    },
  });
});

// ─── POST /events/:eventId/participants/:targetUserId/remind ──────────────────
// Allows the host to manually resend a reminder push to a specific user who has
// been invited but not yet responded.  Rate-limited to once per 24 h per guest.
//
// Atomicity: the reminderSentAt stamp and the role guard are enforced in a single
// conditional UPDATE (role = 'invited' AND reminderSentAt IS NULL OR expired).
// This prevents two concurrent requests from both passing the cooldown check and
// both sending a push.  If the UPDATE affects 0 rows we re-read only to determine
// the correct error response (404 / 409 / 429).

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

router.post("/events/:eventId/participants/:targetUserId/remind", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const targetUserId = parseInt(req.params.targetUserId, 10);
  if (isNaN(eventId) || isNaN(targetUserId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can send reminders" });
    return;
  }

  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  // Atomic conditional update: only stamps the row when the participant is still
  // 'invited' AND hasn't been reminded within the last 24 h.
  const updated = await db
    .update(eventParticipantsTable)
    .set({ reminderSentAt: now })
    .where(
      and(
        eq(eventParticipantsTable.eventId, eventId),
        eq(eventParticipantsTable.userId, targetUserId),
        eq(eventParticipantsTable.role, "invited"),
        or(
          isNull(eventParticipantsTable.reminderSentAt),
          lt(eventParticipantsTable.reminderSentAt, cooldownCutoff),
        ),
      ),
    )
    .returning({ id: eventParticipantsTable.id });

  if (!updated.length) {
    // Re-read only to determine which error applies.
    const [current] = await db
      .select({ role: eventParticipantsTable.role, reminderSentAt: eventParticipantsTable.reminderSentAt })
      .from(eventParticipantsTable)
      .where(
        and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }
    if (current.role !== "invited") {
      res.status(409).json({ error: "Reminders can only be sent to guests who haven't responded" });
      return;
    }
    // Still within the 24-hour cooldown window.
    const retryAfterMs = current.reminderSentAt
      ? REMINDER_COOLDOWN_MS - (now.getTime() - current.reminderSentAt.getTime())
      : 0;
    res.status(429).json({
      error: "A reminder was already sent to this guest within the last 24 hours",
      retryAfterMs,
    });
    return;
  }

  // Send push notification (fire-and-forget — must never fail the request).
  // All awaits inside are covered by a top-level catch so DB or network errors
  // in token/event lookup cannot surface as unhandled rejections.
  void (async () => {
    const tokens = await getTokensForUsers([targetUserId]);
    if (tokens.length) {
      const event = await resolveEvent(eventId);
      const hostName = resolveDisplayName(profile.displayName, profile.handle) ?? "Your host";
      const eventTitle = event?.title ?? "an event";
      void sendExpoPush(
        tokens,
        "Reminder: you're invited! 🎉",
        `${hostName} is waiting for your RSVP to ${eventTitle}`,
        { screen: "event", eventId },
      );
    }
  })().catch((err) => {
    console.error("[remind] failed to send reminder push:", err);
  });

  res.json({ reminderSentAt: now.toISOString() });
});

// ─── POST /events/:eventId/guests/:guestParticipantId/remind ─────────────────
// Same behaviour for app-less guests (no userId, no push tokens).  Resets
// reminderSentAt atomically so the automated job won't double-remind within 24 h.

router.post("/events/:eventId/guests/:guestParticipantId/remind", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const guestParticipantId = parseInt(req.params.guestParticipantId, 10);
  if (isNaN(eventId) || isNaN(guestParticipantId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can send reminders" });
    return;
  }

  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  // Atomic conditional update: only stamps the row when the guest has role
  // 'guest' (the role all app-less guests are created with) AND hasn't been
  // reminded within the last 24 h.
  const updated = await db
    .update(eventParticipantsTable)
    .set({ reminderSentAt: now })
    .where(
      and(
        eq(eventParticipantsTable.id, guestParticipantId),
        eq(eventParticipantsTable.eventId, eventId),
        isNull(eventParticipantsTable.userId),
        eq(eventParticipantsTable.role, "guest"),
        or(
          isNull(eventParticipantsTable.reminderSentAt),
          lt(eventParticipantsTable.reminderSentAt, cooldownCutoff),
        ),
      ),
    )
    .returning({ id: eventParticipantsTable.id });

  if (!updated.length) {
    // Re-read only to determine which error applies.
    const [current] = await db
      .select({ role: eventParticipantsTable.role, reminderSentAt: eventParticipantsTable.reminderSentAt })
      .from(eventParticipantsTable)
      .where(
        and(
          eq(eventParticipantsTable.id, guestParticipantId),
          eq(eventParticipantsTable.eventId, eventId),
          isNull(eventParticipantsTable.userId),
        ),
      )
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Guest not found" });
      return;
    }
    if (current.role !== "guest") {
      res.status(409).json({ error: "Reminders can only be sent to app-less guests" });
      return;
    }
    const retryAfterMs = current.reminderSentAt
      ? REMINDER_COOLDOWN_MS - (now.getTime() - current.reminderSentAt.getTime())
      : 0;
    res.status(429).json({
      error: "A reminder was already sent to this guest within the last 24 hours",
      retryAfterMs,
    });
    return;
  }

  // App-less guests have no push tokens; the host must reach them out-of-band.
  // We still reset reminderSentAt so the automated job tracks this manual nudge.

  res.json({ reminderSentAt: now.toISOString() });
});

// ─── GET /events/:eventId/chat ────────────────────────────────────────────────

router.get("/events/:eventId/chat", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const messages = await db
    .select({
      id: eventMessagesTable.id,
      userId: eventMessagesTable.userId,
      body: eventMessagesTable.body,
      createdAt: eventMessagesTable.createdAt,
      displayName: userProfilesTable.displayName,
      email: userProfilesTable.email,
      handle: userProfilesTable.handle,
      avatarObjectPath: userProfilesTable.avatarObjectPath,
    })
    .from(eventMessagesTable)
    .innerJoin(userProfilesTable, eq(userProfilesTable.id, eventMessagesTable.userId))
    .where(eq(eventMessagesTable.eventId, eventId))
    .orderBy(asc(eventMessagesTable.id))
    .limit(100);

  const result = await Promise.all(
    messages.map(async (m) => {
      const avatarUrl = m.avatarObjectPath
        ? await signedAvatarUrl(m.avatarObjectPath).catch(() => null)
        : null;
      return {
        id: m.id,
        userId: m.userId,
        displayName: resolveDisplayName(m.displayName, m.handle),
        handle: m.handle,
        avatarUrl,
        body: m.body,
        createdAt: m.createdAt,
      };
    }),
  );

  res.json(result);
});

// ─── POST /events/:eventId/chat/read ─────────────────────────────────────────

router.post("/events/:eventId/chat/read", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  await db
    .update(eventParticipantsTable)
    .set({ chatLastReadAt: new Date() })
    .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.userId, profile.id)));

  res.status(204).send();
});

// ─── POST /events/:eventId/chat ───────────────────────────────────────────────

router.post("/events/:eventId/chat", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const rawBody = (req.body as { body?: unknown })?.body;
  if (typeof rawBody !== "string") {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }
  if (trimmed.length > 500) {
    res.status(400).json({ error: "Message cannot exceed 500 characters" });
    return;
  }

  const [inserted] = await db
    .insert(eventMessagesTable)
    .values({ eventId, userId: profile.id, body: trimmed })
    .returning();

  // Mark the sender as having read up to now (awaited so the timestamp is committed
  // before the response returns and any subsequent GET /events sees unreadChatCount = 0)
  await db
    .update(eventParticipantsTable)
    .set({ chatLastReadAt: new Date() })
    .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.userId, profile.id)));

  // Push notification to all other participants (fire-and-forget, respects per-event mute)
  const otherRows = await db
    .select({ userId: eventParticipantsTable.userId })
    .from(eventParticipantsTable)
    .where(and(
      eq(eventParticipantsTable.eventId, eventId),
      inArray(eventParticipantsTable.role, FULL_ACCESS_ROLES),
      isNotNull(eventParticipantsTable.userId),
    ));
  const otherUserIds = otherRows
    .map((r) => r.userId)
    .filter((id): id is number => id !== null && id !== profile.id);
  if (otherUserIds.length > 0) {
    const tokens = await getUnmutedTokensForEvent(eventId, otherUserIds);
    if (tokens.length > 0) {
      const senderName = resolveDisplayName(profile.displayName, profile.handle) ?? "Someone";
      const preview = trimmed.length > 80 ? trimmed.substring(0, 80) + "…" : trimmed;
      void sendExpoPush(tokens, senderName, preview, { eventId, screen: "chat" });
    }
  }

  const avatarUrl = profile.avatarObjectPath
    ? await signedAvatarUrl(profile.avatarObjectPath).catch(() => null)
    : null;

  res.status(201).json({
    id: inserted.id,
    userId: profile.id,
    displayName: resolveDisplayName(profile.displayName, profile.handle),
    handle: profile.handle,
    avatarUrl,
    body: inserted.body,
    createdAt: inserted.createdAt,
  });
});

// ─── Receipt ──────────────────────────────────────────────────────────────────

router.post("/events/:eventId/receipt", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can create a receipt" }); return; }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [existing] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (existing) { res.status(201).json(existing); return; }

  const [receipt] = await db
    .insert(receiptsTable)
    .values({ eventId, uploadedByUserId: profile.id })
    .returning();

  res.status(201).json(receipt);
});

// ─── Update receipt totals (host only) ───────────────────────────────────────

router.patch("/events/:eventId/receipt", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can edit receipt totals" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) { res.status(404).json({ error: "Receipt not found" }); return; }

  const body = req.body as {
    subtotal?: string | null;
    serviceFee?: string | null;
    tax?: string | null;
    tip?: string | null;
    total?: string | null;
  };

  const updates: {
    subtotal?: string | null;
    serviceFee?: string | null;
    tax?: string | null;
    tip?: string | null;
    total?: string | null;
  } = {};

  try {
    const fields = ["subtotal", "serviceFee", "tax", "tip", "total"] as const;
    for (const field of fields) {
      const parsed = parseMoneyField(field, body[field]);
      if (parsed !== undefined) updates[field] = parsed;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid value";
    res.status(400).json({ error: msg });
    return;
  }

  if (Object.keys(updates).length === 0) { res.json(receipt); return; }

  const [updated] = await db
    .update(receiptsTable)
    .set(updates)
    .where(eq(receiptsTable.id, receipt.id))
    .returning();

  res.json(updated);
});

// ─── Event gallery photos ──────────────────────────────────────────────────────
// Note: the legacy multipart POST /events/:eventId/photos endpoint was removed.
// All gallery photo uploads now use the 3-step presigned-URL flow:
//   1. POST /events/:eventId/photos/upload-url  → get a signed GCS PUT URL + token
//   2. PUT  {uploadUrl}                         → upload binary directly to GCS
//   3. POST /events/:eventId/photos/confirm     → create the DB record

router.delete("/events/:eventId/photos/:photoId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(eventId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Full access required" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [photo] = await db
    .select()
    .from(eventPhotosTable)
    .where(and(eq(eventPhotosTable.id, photoId), eq(eventPhotosTable.eventId, eventId)))
    .limit(1);
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  if (participation.role !== "host" && photo.uploadedByUserId !== profile.id) {
    res.status(403).json({ error: "You can only delete your own photos" });
    return;
  }

  try {
    const { bucketName, objectName } = gcsPathFromObjectPath(photo.objectPath);
    const gcsFile = objectStorageClient.bucket(bucketName).file(objectName);
    await gcsFile.delete({ ignoreNotFound: true });
  } catch {
    // Proceed to DB delete even if GCS delete fails
  }

  await db.delete(eventPhotosTable).where(eq(eventPhotosTable.id, photoId));

  res.status(204).send();
});

// ─── Gallery photos — pre-signed upload ───────────────────────────────────────

// Step 1: get a signed PUT URL. The client uploads the binary directly to GCS.
router.post("/events/:eventId/photos/upload-url", requireAuthMiddleware, async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId!;
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const buildNumber = typeof req.headers["x-app-build"] === "string" ? req.headers["x-app-build"] : null;

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }
  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Full access required to upload event photos" }); return;
  }
  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  if (!(await checkAndIncrementRateLimit(`upload_photo:user:${profile.id}`, UPLOAD_PHOTO_USER_LIMIT))) {
    trackUpload("gallery", "rate_limited", buildNumber);
    res.status(429).json({ error: "Upload limit reached. Please try again later." }); return;
  }
  if (!(await checkAndIncrementRateLimit(`upload_photo:event:${eventId}`, UPLOAD_PHOTO_EVENT_LIMIT))) {
    trackUpload("gallery", "rate_limited", buildNumber);
    res.status(429).json({ error: "This event's upload limit has been reached." }); return;
  }

  const mimeType = (req.body as { mimeType?: unknown }).mimeType;
  if (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIMETYPES.includes(mimeType as typeof ALLOWED_IMAGE_MIMETYPES[number])) {
    trackUpload("gallery", "mime_rejected", buildNumber);
    res.status(415).json({ error: "Only raster image files are accepted (JPEG, PNG, GIF, WebP, HEIC)" }); return;
  }

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) { res.status(500).json({ error: "Storage not configured" }); return; }

  const uuid = randomUUID();
  const { bucketName, objectName } = splitGcsPath(`${privateObjectDir}/event-photos/${uuid}`);
  const objectPath = `/objects/event-photos/${uuid}`;
  let uploadUrl: string;
  let token: string;
  try {
    uploadUrl = await signUploadUrl(bucketName, objectName);
    token = createUploadToken({
      objectPath,
      eventId,
      userId: profile.id,
      uploadKind: "event_photo",
      mimeType: mimeType as string,
      expiresAt: Date.now() + 900_000, // 15-minute window to complete the upload
    });
  } catch {
    trackUpload("gallery", "signing_fail", buildNumber);
    res.status(500).json({ error: "Upload signing is not configured on this server" }); return;
  }
  res.status(200).json({ uploadUrl, objectPath, token });
});

// Step 2: after the GCS PUT, call confirm to create the DB record.
router.post("/events/:eventId/photos/confirm", requireAuthMiddleware, async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId!;
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const buildNumber = typeof req.headers["x-app-build"] === "string" ? req.headers["x-app-build"] : null;

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }
  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Full access required to upload event photos" }); return;
  }

  // Verify the upload intent token — binds objectPath, eventId, userId,
  // uploadKind, MIME, and expiry; prevents cross-event/cross-user confirmation.
  const tokenStr = (req.body as { token?: unknown }).token;
  if (typeof tokenStr !== "string") {
    trackUpload("gallery", "auth_fail", buildNumber);
    res.status(400).json({ error: "Upload token required" }); return;
  }
  const intent = verifyUploadToken(tokenStr);
  if (!intent) {
    trackUpload("gallery", "auth_fail", buildNumber);
    res.status(400).json({ error: "Invalid or expired upload token" }); return;
  }
  if (intent.eventId !== eventId) {
    trackUpload("gallery", "auth_fail", buildNumber);
    res.status(403).json({ error: "Token was issued for a different event" }); return;
  }
  if (intent.userId !== profile.id) {
    trackUpload("gallery", "auth_fail", buildNumber);
    res.status(403).json({ error: "Token was issued for a different user" }); return;
  }
  if (intent.uploadKind !== "event_photo") {
    trackUpload("gallery", "auth_fail", buildNumber);
    res.status(400).json({ error: "Token is for a different upload kind" }); return;
  }

  const objectPath = intent.objectPath;

  // Verify the GCS object actually exists (i.e. the client completed the PUT).
  const { bucketName: bkt, objectName: obj } = gcsPathFromObjectPath(objectPath);
  const gcsFile = objectStorageClient.bucket(bkt).file(obj);
  const [objectExists] = await gcsFile.exists();
  if (!objectExists) {
    trackUpload("gallery", "storage_fail", buildNumber);
    res.status(422).json({ error: "Upload not found in storage — please retry the upload" }); return;
  }

  // Idempotent: return existing record if this objectPath was already confirmed.
  const [existing] = await db
    .select()
    .from(eventPhotosTable)
    .where(eq(eventPhotosTable.objectPath, objectPath))
    .limit(1);
  if (existing) {
    const signedImageUrl = await signedUrlForPhoto(objectPath);
    res.status(200).json({ id: existing.id, uploadedByUserId: existing.uploadedByUserId, createdAt: existing.createdAt, signedImageUrl });
    return;
  }

  const [photo] = await db
    .insert(eventPhotosTable)
    .values({ eventId, uploadedByUserId: profile.id, objectPath })
    .returning();

  const signedImageUrl = await signedUrlForPhoto(objectPath);
  trackUpload("gallery", "success", buildNumber);
  res.status(201).json({ id: photo.id, uploadedByUserId: photo.uploadedByUserId, createdAt: photo.createdAt, signedImageUrl });
});

// ─── Receipt photos ────────────────────────────────────────────────────────────

router.post(
  "/events/:eventId/receipt/photos",
  requireAuthMiddleware,
  async (req, res, next) => {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId!;

    const eventId = parseInt(req.params.eventId as string, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

    const profile = await resolveProfile(clerkUserId);
    if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

    const participation = await resolveParticipation(eventId, profile.id);
    if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
    if (participation.role !== "host") {
      res.status(403).json({ error: "Only the host can upload photos" });
      return;
    }

    const event = await resolveEvent(eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

    if (!(await checkAndIncrementRateLimit(`upload_receipt_photo:user:${profile.id}`, UPLOAD_RECEIPT_PHOTO_USER_LIMIT))) {
      res.status(429).json({ error: "Upload limit reached. Please try again later." }); return;
    }
    if (!(await checkAndIncrementRateLimit(`upload_receipt_photo:event:${eventId}`, UPLOAD_RECEIPT_PHOTO_EVENT_LIMIT))) {
      res.status(429).json({ error: "This event's receipt upload limit has been reached." }); return;
    }

    res.locals.preloadedProfile = profile;
    next();
  },
  upload.single("image"),
  async (req, res) => {
    const profile = res.locals.preloadedProfile;

    const eventId = parseInt(req.params.eventId as string, 10);

    const file = req.file;
    if (!file) { res.status(400).json({ error: "image file is required" }); return; }
    // Allow raster image types only. SVG is script-capable and must never be
    // stored and re-served from the same origin (stored XSS risk).
    const ALLOWED_IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      res.status(415).json({ error: "Only raster image files are accepted (JPEG, PNG, GIF, WebP, HEIC)" }); return;
    }

    let [receipt] = await db
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.eventId, eventId))
      .limit(1);
    if (!receipt) {
      [receipt] = await db
        .insert(receiptsTable)
        .values({ eventId, uploadedByUserId: profile.id })
        .returning();
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) { res.status(500).json({ error: "Storage not configured" }); return; }

    const uuid = randomUUID();
    const fullGcsPath = `${privateObjectDir}/receipt-photos/${uuid}`;
    const { bucketName, objectName } = splitGcsPath(fullGcsPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);
    await gcsFile.save(file.buffer, { contentType: file.mimetype, resumable: false });

    const objectPath = `/objects/receipt-photos/${uuid}`;

    const [photo] = await db
      .insert(receiptPhotosTable)
      .values({ receiptId: receipt.id, uploadedByUserId: profile.id, objectPath })
      .returning();

    const signedImageUrl = await signDownloadUrl(bucketName, objectName);

    res.status(201).json({ id: photo.id, createdAt: photo.createdAt, signedImageUrl });
  },
);

// ─── Receipt photos — pre-signed upload ───────────────────────────────────────

// Step 1: get a signed PUT URL. The client uploads the binary directly to GCS.
router.post("/events/:eventId/receipt/photos/upload-url", requireAuthMiddleware, async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId!;
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const buildNumber = typeof req.headers["x-app-build"] === "string" ? req.headers["x-app-build"] : null;

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }
  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can upload receipt photos" }); return; }
  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  if (!(await checkAndIncrementRateLimit(`upload_receipt_photo:user:${profile.id}`, UPLOAD_RECEIPT_PHOTO_USER_LIMIT))) {
    trackUpload("receipt", "rate_limited", buildNumber);
    res.status(429).json({ error: "Upload limit reached. Please try again later." }); return;
  }
  if (!(await checkAndIncrementRateLimit(`upload_receipt_photo:event:${eventId}`, UPLOAD_RECEIPT_PHOTO_EVENT_LIMIT))) {
    trackUpload("receipt", "rate_limited", buildNumber);
    res.status(429).json({ error: "This event's receipt upload limit has been reached." }); return;
  }

  const mimeType = (req.body as { mimeType?: unknown }).mimeType;
  if (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIMETYPES.includes(mimeType as typeof ALLOWED_IMAGE_MIMETYPES[number])) {
    trackUpload("receipt", "mime_rejected", buildNumber);
    res.status(415).json({ error: "Only raster image files are accepted (JPEG, PNG, GIF, WebP, HEIC)" }); return;
  }

  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) { res.status(500).json({ error: "Storage not configured" }); return; }

  const uuid = randomUUID();
  const { bucketName, objectName } = splitGcsPath(`${privateObjectDir}/receipt-photos/${uuid}`);
  const objectPath = `/objects/receipt-photos/${uuid}`;
  let uploadUrl: string;
  let token: string;
  try {
    uploadUrl = await signUploadUrl(bucketName, objectName);
    token = createUploadToken({
      objectPath,
      eventId,
      userId: profile.id,
      uploadKind: "receipt_photo",
      mimeType: mimeType as string,
      expiresAt: Date.now() + 900_000, // 15-minute window to complete the upload
    });
  } catch {
    trackUpload("receipt", "signing_fail", buildNumber);
    res.status(500).json({ error: "Upload signing is not configured on this server" }); return;
  }
  res.status(200).json({ uploadUrl, objectPath, token });
});

// Step 2: after the GCS PUT, call confirm to create the DB record.
router.post("/events/:eventId/receipt/photos/confirm", requireAuthMiddleware, async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId!;
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const buildNumber = typeof req.headers["x-app-build"] === "string" ? req.headers["x-app-build"] : null;

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }
  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can upload receipt photos" }); return; }

  // Verify the upload intent token — binds objectPath, eventId, userId,
  // uploadKind, MIME, and expiry; prevents cross-event/cross-user confirmation.
  const tokenStr = (req.body as { token?: unknown }).token;
  if (typeof tokenStr !== "string") {
    trackUpload("receipt", "auth_fail", buildNumber);
    res.status(400).json({ error: "Upload token required" }); return;
  }
  const intent = verifyUploadToken(tokenStr);
  if (!intent) {
    trackUpload("receipt", "auth_fail", buildNumber);
    res.status(400).json({ error: "Invalid or expired upload token" }); return;
  }
  if (intent.eventId !== eventId) {
    trackUpload("receipt", "auth_fail", buildNumber);
    res.status(403).json({ error: "Token was issued for a different event" }); return;
  }
  if (intent.userId !== profile.id) {
    trackUpload("receipt", "auth_fail", buildNumber);
    res.status(403).json({ error: "Token was issued for a different user" }); return;
  }
  if (intent.uploadKind !== "receipt_photo") {
    trackUpload("receipt", "auth_fail", buildNumber);
    res.status(400).json({ error: "Token is for a different upload kind" }); return;
  }

  const objectPath = intent.objectPath;

  // Verify the GCS object actually exists (i.e. the client completed the PUT).
  const { bucketName: bkt, objectName: obj } = gcsPathFromObjectPath(objectPath);
  const gcsFile = objectStorageClient.bucket(bkt).file(obj);
  const [objectExists] = await gcsFile.exists();
  if (!objectExists) {
    trackUpload("receipt", "storage_fail", buildNumber);
    res.status(422).json({ error: "Upload not found in storage — please retry the upload" }); return;
  }

  // Idempotent: return existing record if this objectPath was already confirmed.
  const [existing] = await db
    .select()
    .from(receiptPhotosTable)
    .where(eq(receiptPhotosTable.objectPath, objectPath))
    .limit(1);
  if (existing) {
    const signedImageUrl = await signedUrlForPhoto(objectPath);
    res.status(200).json({ id: existing.id, createdAt: existing.createdAt, signedImageUrl });
    return;
  }

  let [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);
  if (!receipt) {
    [receipt] = await db
      .insert(receiptsTable)
      .values({ eventId, uploadedByUserId: profile.id })
      .returning();
  }

  const [photo] = await db
    .insert(receiptPhotosTable)
    .values({ receiptId: receipt.id, uploadedByUserId: profile.id, objectPath })
    .returning();

  const signedImageUrl = await signedUrlForPhoto(objectPath);
  trackUpload("receipt", "success", buildNumber);
  res.status(201).json({ id: photo.id, createdAt: photo.createdAt, signedImageUrl });
});

router.get("/events/:eventId/receipt/photos", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }

  if (!FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) { res.json([]); return; }

  const rawPhotos = await db
    .select()
    .from(receiptPhotosTable)
    .where(eq(receiptPhotosTable.receiptId, receipt.id))
    .orderBy(asc(receiptPhotosTable.createdAt));

  const photos = await Promise.all(
    rawPhotos.map(async (p) => {
      try {
        const signedImageUrl = await signedUrlForPhoto(p.objectPath);
        return { id: p.id, createdAt: p.createdAt, signedImageUrl };
      } catch {
        return { id: p.id, createdAt: p.createdAt, signedImageUrl: null, error: "unavailable" };
      }
    }),
  );

  res.json(photos);
});

router.get("/events/:eventId/receipt/photos/:photoId/image", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(eventId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }

  if (!FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);
  if (!receipt) { res.status(404).json({ error: "Receipt not found" }); return; }

  const [photo] = await db
    .select()
    .from(receiptPhotosTable)
    .where(
      and(eq(receiptPhotosTable.id, photoId), eq(receiptPhotosTable.receiptId, receipt.id)),
    )
    .limit(1);
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  const { bucketName, objectName } = gcsPathFromObjectPath(photo.objectPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const gcsFile = bucket.file(objectName);

  const [exists] = await gcsFile.exists();
  if (!exists) { res.status(404).json({ error: "Image file not found in storage" }); return; }

  const [metadata] = await gcsFile.getMetadata();
  res.setHeader("Content-Type", (metadata.contentType as string) || "image/jpeg");
  // Force download disposition so the browser never renders the file inline as
  // a top-level document, which would allow any script-capable format (e.g. a
  // previously-stored SVG) to execute in the application's origin context.
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Cache-Control", "private, max-age=300");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));

  gcsFile.createReadStream().pipe(res);
});

router.delete("/events/:eventId/receipt/photos/:photoId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(eventId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can delete photos" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);
  if (!receipt) { res.status(404).json({ error: "Receipt not found" }); return; }

  const [photo] = await db
    .select()
    .from(receiptPhotosTable)
    .where(
      and(eq(receiptPhotosTable.id, photoId), eq(receiptPhotosTable.receiptId, receipt.id)),
    )
    .limit(1);
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  try {
    const { bucketName, objectName } = gcsPathFromObjectPath(photo.objectPath);
    const gcsFile = objectStorageClient.bucket(bucketName).file(objectName);
    await gcsFile.delete({ ignoreNotFound: true });
  } catch {
    // Proceed to DB delete even if GCS delete fails
  }

  await db.delete(receiptPhotosTable).where(eq(receiptPhotosTable.id, photoId));

  res.status(204).send();
});

// ─── Receipt photo image preprocessing helpers ────────────────────────────────

// Clamps the long edge of an image to [minPx, maxPx].
// Images with long edge < minPx are upscaled; > maxPx are downscaled;
// images already in [minPx, maxPx] are left at their original size.
async function clampLongEdge(rawBuffer: Buffer, minPx: number, maxPx: number): Promise<number> {
  const meta = await sharp(rawBuffer).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  return Math.max(minPx, Math.min(maxPx, longEdge));
}

async function preprocessReceiptImage(rawBuffer: Buffer): Promise<Buffer> {
  const targetLongEdge = await clampLongEdge(rawBuffer, 1200, 2000);
  return sharp(rawBuffer)
    .rotate()
    .resize({ width: targetLongEdge, height: targetLongEdge, fit: "inside" })
    .grayscale()
    .normalise()
    .blur(0.5)
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 3.0 })
    .linear(1.4, -30)
    .jpeg({ quality: 90, progressive: false })
    .toBuffer();
}

// Compute an Otsu threshold from the image histogram.
// Otsu's method picks the threshold that maximises the between-class variance
// of foreground (ink) vs background (paper), adapting to each image's contrast
// instead of using a fixed 128.
async function computeOtsuThreshold(rawBuffer: Buffer): Promise<number> {
  const { data } = await sharp(rawBuffer)
    .grayscale()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = data.length;
  if (n === 0) return 128;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) hist[data[i]]++;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;
    if (variance > maxVariance) { maxVariance = variance; threshold = t; }
  }
  return threshold;
}

async function binarizeReceiptImage(rawBuffer: Buffer): Promise<Buffer> {
  const [targetLongEdge, otsuThreshold] = await Promise.all([
    clampLongEdge(rawBuffer, 1200, 2000),
    computeOtsuThreshold(rawBuffer),
  ]);
  return sharp(rawBuffer)
    .rotate()
    .resize({ width: targetLongEdge, height: targetLongEdge, fit: "inside" })
    .grayscale()
    .normalise()
    .threshold(otsuThreshold)
    .jpeg({ quality: 90, progressive: false })
    .toBuffer();
}

// Compute a Laplacian-variance blur score for the image.
// Higher = sharper; lower = blurrier. Used to reject egregiously blurry photos
// before spending an OCR quota slot on them.
async function computeBlurScore(rawBuffer: Buffer): Promise<number> {
  const { data } = await sharp(rawBuffer)
    .grayscale()
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = data.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i];
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (data[i] - mean) ** 2;
  return variance / n;
}

// ─── Receipt photo scan (OCR) ─────────────────────────────────────────────────

router.post("/events/:eventId/receipt/photos/:photoId/scan", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (isNaN(eventId) || isNaN(photoId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can scan receipt photos" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);
  if (!receipt) { res.status(404).json({ error: "Receipt not found" }); return; }

  // Pre-fetch confirmed items for multi-photo deduplication (empty on first scan)
  const existingReceiptItems = await db
    .select({ name: receiptItemsTable.name, price: receiptItemsTable.price })
    .from(receiptItemsTable)
    .where(eq(receiptItemsTable.receiptId, receipt.id));

  const [photo] = await db
    .select()
    .from(receiptPhotosTable)
    .where(and(eq(receiptPhotosTable.id, photoId), eq(receiptPhotosTable.receiptId, receipt.id)))
    .limit(1);
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }

  // Fast path: if the photo was already successfully scanned, reject immediately
  // without consuming any rate-limit quota.
  if (photo.scannedAt !== null) {
    res.status(409).json({ error: "This photo has already been scanned", code: "already_scanned" }); return;
  }

  // Atomically claim the scan lock by setting scanLockedAt only when it is
  // NULL or stale (older than SCAN_LOCK_TIMEOUT_MS).  A stale lock means the
  // server process that claimed it crashed before OCR could finish — treating
  // it as expired lets a new request take over without manual intervention.
  const staleCutoff = new Date(Date.now() - SCAN_LOCK_TIMEOUT_MS);
  const claimed = await db
    .update(receiptPhotosTable)
    .set({ scanLockedAt: new Date() })
    .where(and(
      eq(receiptPhotosTable.id, photo.id),
      isNull(receiptPhotosTable.scannedAt),
      or(isNull(receiptPhotosTable.scanLockedAt), lt(receiptPhotosTable.scanLockedAt, staleCutoff)),
    ))
    .returning({ id: receiptPhotosTable.id });

  if (claimed.length === 0) {
    // Another concurrent request holds the lock (or scan completed between our
    // check above and the update).  Advise the caller to wait and retry.
    // Reject without consuming rate-limit quota since no OCR will run.
    const fresh = await db
      .select({ scannedAt: receiptPhotosTable.scannedAt })
      .from(receiptPhotosTable)
      .where(eq(receiptPhotosTable.id, photo.id))
      .limit(1);
    if (fresh[0]?.scannedAt !== null && fresh[0]?.scannedAt !== undefined) {
      res.status(409).json({ error: "This photo has already been scanned", code: "already_scanned" }); return;
    }
    res.status(409).json({ error: "Another scan is already in progress for this photo. Please wait a moment and try again.", code: "scan_in_progress" }); return;
  }

  // All work after claiming the scan lock is wrapped in try/finally so that
  // any failure — including unexpected throws from GCS helpers, downloads, or
  // runtime errors — releases the lock and lets the photo be retried.
  let scanSucceeded = false;
  let ocrEnhancementVariant: "enhanced" | "binarized_retry" = "enhanced";
  try {
    const { bucketName, objectName } = gcsPathFromObjectPath(photo.objectPath);
    const gcsFile = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await gcsFile.exists();
    if (!exists) {
      res.status(404).json({ error: "Image file not found in storage" }); return;
    }

    const [rawBuffer] = await gcsFile.download();

    // ── Blur detection — runs before rate limit so blurry photos don't burn quota
    const blurScore = await computeBlurScore(rawBuffer);
    if (blurScore < BLUR_SCORE_THRESHOLD) {
      res.status(422).json({ error: "Receipt photo is too blurry to read. Please hold the camera steady and take a clearer photo.", code: "image_too_blurry" });
      return;
    }

    // ── Rate limit (after blur check so genuinely unreadable photos don't count)
    // Lock claim ensures quota is only spent when OCR is about to run,
    // preventing attackers from burning the shared budget with no-op requests.
    if (!(await checkOcrRateLimit(profile.id))) {
      res.status(429).json({ error: "Too many scan requests. Please try again later." }); return;
    }

    // ── Pre-process the image to improve OCR accuracy ─────────────────────────
    // Enhanced pipeline:
    //   auto-rotate → upscale if small (min long-edge 1200px, max 2000px) →
    //   grayscale → normalize → gentle blur (denoise) → sharpen →
    //   linear contrast stretch → JPEG 90.
    // Upscaling is now allowed for low-res shots; denoising runs before
    // sharpening so grain is smoothed rather than amplified; and a stronger
    // contrast stretch brings out faded thermal print.
    const imageBuffer = await preprocessReceiptImage(rawBuffer);

    const base64Image = imageBuffer.toString("base64");

    const PROMPT = `You are a restaurant receipt OCR assistant. Extract structured data from the receipt image even if the image has shadows, glare, or partial occlusion.

Return ONLY valid JSON with this exact shape — no markdown, no extra text:
{"items":[{"name":string,"quantity":number|null,"priceStr":string}],"subtotal":string|null,"serviceFee":string|null,"tax":string|null,"tip":string|null,"total":string|null}

ITEM EXTRACTION RULES:
1. Only include lines that have a readable price. Do NOT invent prices.
2. Lines with NO price that immediately follow a priced item are modifier or side-dish notes. Append them in parentheses to the previous priced item's name. Example: if "LECHON ASADO $18.95" is followed by "ARROZ MORO" and "YUCA CON MOJO" (no prices), output name "LECHON ASADO (ARROZ MORO, YUCA CON MOJO)".
3. quantity is the integer count printed at the start of the line, or null if not shown.
4. priceStr is the UNIT price per single item — no dollar sign, no commas, e.g. "13.95". If quantity > 1 and the printed price is clearly the total for that quantity, divide to get unit price. Example: "2 Mojito $27.90" → quantity: 2, priceStr: "13.95". Example: "3 CAFE CUBANO $7.50" → quantity: 3, priceStr: "2.50".
5. If a line has a quantity and item name but the price is truly unreadable, skip it. Do not guess.
6. Do NOT include: payment method lines, credit/debit card numbers, auth codes, VISA/MC/AMEX/Discover labels, server names, table numbers, date/time lines, signature lines, "Thank you" text, or any line that is not a food/drink item, discount, or fee.
7. Discounts, coupons, comps, and staff-meal credits appear as negative prices. Include them as items with a negative priceStr (e.g., "-5.00"). Do NOT skip them — they reduce the subtotal.

TOTALS RULES:
8. subtotal: the items-only sum before any service fee, tax, or gratuity. If the receipt's printed "SUBTOTAL" line appears after a service charge and already includes it, use the value before the service charge (the items-only total), not the printed label. null if not determinable.
9. serviceFee: dollar amount of any mandatory service charge, hospitality fee, restaurant fee, or administrative fee that is NOT sales tax and NOT a voluntary gratuity. null if none. If a percentage-based mandatory fee is shown (e.g. "SERVICE CHARGE 18%"), extract its dollar amount as serviceFee.
10. tax: sales tax only, or null.
11. tip: dollar amount of any voluntary gratuity or tip added by the customer. Extract it only if a tip amount is clearly printed (e.g., a written-in tip line or a selected suggested amount). Do NOT confuse with mandatory service charges (those go in serviceFee). null if no tip is printed.
12. total: the final amount charged, or null.

SHADOW AND QUALITY RULES:
13. Extract all readable lines even if part of the receipt is shadowed, blurry, or partially obscured. Do not skip entire sections due to image quality — extract what is readable.

items may be an empty array [] only if no line items are legible at all.

EXAMPLE (do not copy these values — use the actual receipt):
Receipt lines:
  2 Mojito           $27.90
  LECHON ASADO       $18.95
    ARROZ MORO
    YUCA CON MOJO
  STAFF DISCOUNT     -$5.00
  Subtotal           $41.85
  Service Charge 18%  $7.53
  Tax                 $3.35
  Tip                $10.00
  TOTAL              $62.73

Correct JSON output:
{"items":[{"name":"Mojito","quantity":2,"priceStr":"13.95"},{"name":"LECHON ASADO (ARROZ MORO, YUCA CON MOJO)","quantity":null,"priceStr":"18.95"},{"name":"STAFF DISCOUNT","quantity":null,"priceStr":"-5.00"}],"subtotal":"41.85","serviceFee":"7.53","tax":"3.35","tip":"10.00","total":"62.73"}`;

    // ── Helper: call OpenAI vision and parse the raw response ────────────────
    type OcrParsed = {
      items: { name: string; quantity: number | null; priceStr: string }[];
      subtotal: string | null;
      serviceFee: string | null;
      tax: string | null;
      tip: string | null;
      total: string | null;
    };

    async function runOcrCall(b64: string): Promise<{ ok: true; content: string } | { ok: false; error: string; detail?: string }> {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 2048,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        });
        const content = response.choices[0]?.message?.content ?? "";
        if (!content) return { ok: false, error: "empty_response" };
        return { ok: true, content };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return { ok: false, error: "ocr_call_failed", detail };
      }
    }

    function parseOcrContent(content: string): OcrParsed | null {
      let parsed: unknown;
      try {
        const cleaned = content
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return null;
      }
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !Array.isArray((parsed as Record<string, unknown>).items)
      ) {
        return null;
      }
      const raw = parsed as Record<string, unknown>;
      const items = (raw.items as unknown[])
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .filter((item) => typeof item.name === "string" && typeof item.priceStr === "string")
        .map((item) => ({
          name: item.name as string,
          quantity: typeof item.quantity === "number" ? item.quantity : null,
          priceStr: item.priceStr as string,
        }));
      return {
        items,
        subtotal: typeof raw.subtotal === "string" ? raw.subtotal : null,
        serviceFee: typeof raw.serviceFee === "string" ? raw.serviceFee : null,
        tax: typeof raw.tax === "string" ? raw.tax : null,
        tip: typeof raw.tip === "string" ? raw.tip : null,
        total: typeof raw.total === "string" ? raw.total : null,
      };
    }

    function computeWarning(result: OcrParsed): string | null {
      const { items, subtotal, serviceFee } = result;
      if (subtotal === null) return null;
      const detectedSubtotal = parseFloat(subtotal);
      if (isNaN(detectedSubtotal)) return null;
      const computedSubtotal = items.reduce((sum, item) => {
        const qty = item.quantity ?? 1;
        const price = parseFloat(item.priceStr);
        return sum + (isNaN(price) ? 0 : qty * price);
      }, 0);
      if (Math.abs(computedSubtotal - detectedSubtotal) <= 0.10) return null;
      const detectedServiceFee = serviceFee !== null ? parseFloat(serviceFee) : NaN;
      const serviceFeeExplainsGap =
        !isNaN(detectedServiceFee) &&
        Math.abs(computedSubtotal + detectedServiceFee - detectedSubtotal) <= 0.10;
      if (serviceFeeExplainsGap) return null;
      return `Item total ($${computedSubtotal.toFixed(2)}) does not match detected subtotal ($${detectedSubtotal.toFixed(2)}). Some items may be missing or prices may need correction.`;
    }

    function needsRetry(result: OcrParsed): boolean {
      if (result.items.length === 0) return true;
      if (computeWarning(result) !== null) return true;
      return false;
    }

    // ── First OCR attempt with the enhanced image ─────────────────────────────
    const firstCallResult = await runOcrCall(base64Image);
    if (!firstCallResult.ok) {
      if (firstCallResult.error === "empty_response") {
        await db.insert(scanErrorLogsTable).values({ errorType: "empty_response", eventId, photoId, userId: profile.id, enhancementVariant: "enhanced" });
        res.status(422).json({ error: "OCR returned an empty response" });
        return;
      }
      await db.insert(scanErrorLogsTable).values({ errorType: "ocr_call_failed", eventId, photoId, userId: profile.id, detail: firstCallResult.detail, enhancementVariant: "enhanced" });
      res.status(500).json({ error: "OCR call failed", detail: firstCallResult.detail });
      return;
    }

    const firstParsed = parseOcrContent(firstCallResult.content);
    if (firstParsed === null) {
      await db.insert(scanErrorLogsTable).values({ errorType: "malformed_json", eventId, photoId, userId: profile.id, enhancementVariant: "enhanced" });
      res.status(422).json({ error: "OCR returned malformed JSON" });
      return;
    }

    // ── Binarized retry if first result is poor ───────────────────────────────
    let finalResult = firstParsed;
    let enhancementVariant: "enhanced" | "binarized_retry" = "enhanced";

    if (needsRetry(firstParsed)) {
      console.log(`[OCR] First attempt yielded ${firstParsed.items.length} items or subtotal mismatch — retrying with binarized image (photo ${photoId})`);
      // The binarized retry is a second model call, so it is counted separately
      // against the per-user and global OCR quota.  If the quota is exhausted we
      // skip the retry (the first result is still usable) rather than failing the
      // whole scan.
      const retryRateLimitOk = await checkOcrRateLimit(profile.id);
      if (!retryRateLimitOk) {
        console.log(`[OCR] Binarized retry skipped — rate limit reached for user ${profile.id} (photo ${photoId})`);
      } else {
        try {
          const binarizedBuffer = await binarizeReceiptImage(rawBuffer);
          const binarizedBase64 = binarizedBuffer.toString("base64");
          const retryCallResult = await runOcrCall(binarizedBase64);
          if (retryCallResult.ok) {
            const retryParsed = parseOcrContent(retryCallResult.content);
            if (retryParsed !== null && retryParsed.items.length > firstParsed.items.length) {
              finalResult = retryParsed;
              enhancementVariant = "binarized_retry";
              console.log(`[OCR] Binarized retry improved item count: ${firstParsed.items.length} → ${retryParsed.items.length} (photo ${photoId})`);
            } else {
              console.log(`[OCR] Binarized retry did not improve result — keeping enhanced version (photo ${photoId})`);
            }
          } else {
            const detail = retryCallResult.detail ?? retryCallResult.error;
            console.error(`[OCR] Binarized retry call failed — keeping enhanced result (photo ${photoId}):`, detail);
            await db.insert(scanErrorLogsTable).values({
              errorType: "binarized_retry_failed",
              eventId,
              photoId,
              userId: profile.id,
              detail,
              enhancementVariant: "binarized_retry",
            }).catch(() => {});
          }
        } catch (retryErr) {
          const detail = retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.error(`[OCR] Binarized retry threw unexpectedly — keeping enhanced result (photo ${photoId}):`, retryErr);
          await db.insert(scanErrorLogsTable).values({
            errorType: "binarized_retry_failed",
            eventId,
            photoId,
            userId: profile.id,
            detail,
            enhancementVariant: "binarized_retry",
          }).catch(() => {});
        }
      }
    }

    ocrEnhancementVariant = enhancementVariant;

    // ── Multi-photo deduplication — remove items already confirmed on this receipt
    let deduplicatedCount = 0;
    if (existingReceiptItems.length > 0) {
      const existingNorm = existingReceiptItems.map((e) => ({
        name: e.name.trim().toLowerCase(),
        priceDollars: e.price / 100,
      }));
      const dedupedItems = finalResult.items.filter((item) => {
        const normName = item.name.trim().toLowerCase();
        const itemPrice = parseFloat(item.priceStr);
        const isDupe = existingNorm.some(
          (e) => e.name === normName && !isNaN(itemPrice) && Math.abs(e.priceDollars - itemPrice) <= 0.02,
        );
        if (isDupe) deduplicatedCount++;
        return !isDupe;
      });
      finalResult = { ...finalResult, items: dedupedItems };
    }

    const { items, subtotal, serviceFee, tax, tip, total } = finalResult;
    const warning = computeWarning(finalResult);

    console.log(`[OCR] photo=${photoId} variant=${enhancementVariant} items=${items.length} deduped=${deduplicatedCount} warning=${warning ? "yes" : "no"}`);

    scanSucceeded = true;
    res.json({
      items,
      subtotal,
      serviceFee,
      tax,
      tip,
      total,
      warning,
      ...(deduplicatedCount > 0 ? { deduplicatedCount } : {}),
    });
  } catch (unexpectedErr) {
    // Catch any runtime error not already handled above (e.g. GCS download
    // failure, DB error mid-scan) so it is recorded before being rethrown.
    if (!res.headersSent) {
      const detail = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
      await db.insert(scanErrorLogsTable).values({ errorType: "unexpected_error", eventId, photoId, userId: profile.id, detail, enhancementVariant: ocrEnhancementVariant }).catch(() => {});
      res.status(500).json({ error: "An unexpected error occurred during scanning" });
    }
    throw unexpectedErr;
  } finally {
    if (scanSucceeded) {
      // Mark the scan as permanently complete and release the lock.
      await db
        .update(receiptPhotosTable)
        .set({ scannedAt: new Date(), scanLockedAt: null })
        .where(eq(receiptPhotosTable.id, photo.id));
    } else {
      // Release the lock so the photo can be retried rather than getting
      // permanently stuck in a locked state.
      await db
        .update(receiptPhotosTable)
        .set({ scanLockedAt: null })
        .where(eq(receiptPhotosTable.id, photo.id));
    }
  }
});

// ─── Scan errors global summary (Clerk-authenticated) ─────────────────────────
//
// GET /scan-errors/global-summary
//   Returns the global byErrorType cross-dimension for any authenticated host.
//   Identical window semantics to /scan-errors/summary but requires a Clerk
//   session instead of the internal secret, so mobile ops staff can call it.

router.get("/scan-errors/global-summary", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }

  const hostParticipation = await db
    .select({ id: eventParticipantsTable.id })
    .from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.userId, profile.id), eq(eventParticipantsTable.role, "host")))
    .limit(1);
  if (hostParticipation.length === 0) { res.status(403).json({ error: "Only event hosts can view global scan error data" }); return; }

  const now = new Date();
  const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parseDate = (raw: unknown): Date | null => {
    if (typeof raw !== "string") return null;
    const asNum = Number(raw);
    if (!isNaN(asNum)) return new Date(asNum);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const since = parseDate(req.query.since) ?? defaultSince;
  const until = parseDate(req.query.until) ?? now;

  const byErrorType = await db
    .select({
      errorType: scanErrorLogsTable.errorType,
      enhancementVariant: scanErrorLogsTable.enhancementVariant,
      count: count(),
    })
    .from(scanErrorLogsTable)
    .where(and(gte(scanErrorLogsTable.occurredAt, since), lt(scanErrorLogsTable.occurredAt, until)))
    .groupBy(scanErrorLogsTable.errorType, scanErrorLogsTable.enhancementVariant)
    .orderBy(desc(count()));

  res.json({ since: since.toISOString(), until: until.toISOString(), byErrorType });
});

// ─── Scan error metrics ───────────────────────────────────────────────────────
//
// GET /scan-errors/summary
//   Returns scan error counts grouped by errorType for a rolling window.
//   Query params:
//     since  — ISO-8601 or Unix ms timestamp (default: 30 days ago)
//     until  — ISO-8601 or Unix ms timestamp (default: now)
//   Response: { since, until, totals: [{ errorType, count }], byVariant: [{ enhancementVariant, count }], byErrorType: [{ errorType, enhancementVariant, count }], byDay: [{ date, errorType, enhancementVariant, count }] }
//
// Internal ops endpoint — requires the x-internal-secret header to match
// the INTERNAL_API_SECRET env var.  Set that variable in production before
// using this endpoint.

router.get("/scan-errors/summary", async (req, res) => {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret || req.headers["x-internal-secret"] !== internalSecret) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const now = new Date();
  const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parseDate = (raw: unknown): Date | null => {
    if (typeof raw !== "string") return null;
    const asNum = Number(raw);
    if (!isNaN(asNum)) return new Date(asNum);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const since = parseDate(req.query.since) ?? defaultSince;
  const until = parseDate(req.query.until) ?? now;

  // Only count rows whose lifecycle is complete — transient/in-progress rows
  // (e.g. from interrupted jobs) must not inflate the summary numbers.
  const finalOnly = and(
    gte(scanErrorLogsTable.occurredAt, since),
    lt(scanErrorLogsTable.occurredAt, until),
    eq(scanErrorLogsTable.status, "final"),
  );

  const [totals, byVariant, byErrorType, byDay] = await Promise.all([
    db
      .select({
        errorType: scanErrorLogsTable.errorType,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(finalOnly)
      .groupBy(scanErrorLogsTable.errorType)
      .orderBy(desc(count())),

    db
      .select({
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(finalOnly)
      .groupBy(scanErrorLogsTable.enhancementVariant)
      .orderBy(desc(count())),

    db
      .select({
        errorType: scanErrorLogsTable.errorType,
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(finalOnly)
      .groupBy(scanErrorLogsTable.errorType, scanErrorLogsTable.enhancementVariant)
      .orderBy(desc(count())),

    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${scanErrorLogsTable.occurredAt}), 'YYYY-MM-DD')`,
        errorType: scanErrorLogsTable.errorType,
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(finalOnly)
      .groupBy(
        sql`date_trunc('day', ${scanErrorLogsTable.occurredAt})`,
        scanErrorLogsTable.errorType,
        scanErrorLogsTable.enhancementVariant,
      )
      .orderBy(
        asc(sql`date_trunc('day', ${scanErrorLogsTable.occurredAt})`),
        asc(scanErrorLogsTable.errorType),
        asc(scanErrorLogsTable.enhancementVariant),
      ),
  ]);

  res.json({ since: since.toISOString(), until: until.toISOString(), totals, byVariant, byErrorType, byDay });
});

// GET /events/:eventId/scan-health
//   Returns per-variant scan error breakdown for a specific event.
//   Auth-protected — requires a Clerk session belonging to the event host.
//   Query params:
//     since  — ISO-8601 or Unix ms timestamp (default: 30 days ago)
//     until  — ISO-8601 or Unix ms timestamp (default: now)
//   Response: { since, until, byVariant: [{ enhancementVariant, count }], byDay: [{ date, enhancementVariant, count }] }

router.get("/events/:eventId/scan-health", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can view scan health" }); return; }

  const now = new Date();
  const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const parseDate = (raw: unknown): Date | null => {
    if (typeof raw !== "string") return null;
    const asNum = Number(raw);
    if (!isNaN(asNum)) return new Date(asNum);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const since = parseDate(req.query.since) ?? defaultSince;
  const until = parseDate(req.query.until) ?? now;

  const baseWhere = and(
    eq(scanErrorLogsTable.eventId, eventId),
    gte(scanErrorLogsTable.occurredAt, since),
    lt(scanErrorLogsTable.occurredAt, until),
  );

  const [byVariant, byDay, byErrorType] = await Promise.all([
    db
      .select({
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(baseWhere)
      .groupBy(scanErrorLogsTable.enhancementVariant)
      .orderBy(desc(count())),

    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${scanErrorLogsTable.occurredAt}), 'YYYY-MM-DD')`,
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(baseWhere)
      .groupBy(
        sql`date_trunc('day', ${scanErrorLogsTable.occurredAt})`,
        scanErrorLogsTable.enhancementVariant,
      )
      .orderBy(
        asc(sql`date_trunc('day', ${scanErrorLogsTable.occurredAt})`),
        asc(scanErrorLogsTable.enhancementVariant),
      ),

    db
      .select({
        errorType: scanErrorLogsTable.errorType,
        enhancementVariant: scanErrorLogsTable.enhancementVariant,
        count: count(),
      })
      .from(scanErrorLogsTable)
      .where(baseWhere)
      .groupBy(scanErrorLogsTable.errorType, scanErrorLogsTable.enhancementVariant)
      .orderBy(desc(count())),
  ]);

  res.json({ since: since.toISOString(), until: until.toISOString(), byVariant, byDay, byErrorType });
});

// ─── Receipt items ────────────────────────────────────────────────────────────

router.post("/events/:eventId/receipt/items", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can add receipt items" }); return; }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const { name, price, quantity } = req.body as { name?: string; price?: string; quantity?: number };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!price?.trim()) { res.status(400).json({ error: "price is required" }); return; }
  const priceNum = parseFloat(price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: "price must be a positive number" });
    return;
  }
  const qty = typeof quantity === "number" ? Math.max(1, Math.floor(quantity)) : 1;

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) { res.status(404).json({ error: "Receipt not found — create a receipt first" }); return; }

  const [item] = await db
    .insert(receiptItemsTable)
    .values({ receiptId: receipt.id, name: name.trim(), price: priceNum.toFixed(2), quantity: qty })
    .returning();

  res.status(201).json(item);
});

router.delete("/events/:eventId/receipt/items/:itemId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(eventId) || isNaN(itemId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Only the host can delete receipt items" }); return; }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) { res.status(404).json({ error: "Receipt not found" }); return; }

  const [item] = await db
    .select()
    .from(receiptItemsTable)
    .where(and(eq(receiptItemsTable.id, itemId), eq(receiptItemsTable.receiptId, receipt.id)))
    .limit(1);

  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  await db.delete(receiptItemsTable).where(eq(receiptItemsTable.id, itemId));

  res.status(204).send();
});

// ─── Bill reset ───────────────────────────────────────────────────────────────

router.delete("/events/:eventId/bill", async (req, res) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event ID" }); return; }

    console.log(`[RESET BILL] eventId=${eventId} clerkUserId=${clerkUserId}`);

    const profile = await resolveProfile(clerkUserId);
    if (!profile) { res.status(401).json({ error: "Profile not found" }); return; }

    const participation = await resolveParticipation(eventId, profile.id);
    if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
    if (participation.role !== "host") { res.status(403).json({ error: "Only the host can reset the bill" }); return; }

    const event = await resolveEvent(eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (event.cancelledAt) { res.status(409).json({ error: "Cannot reset a cancelled event" }); return; }

    // Phase 1: Receipt lookup
    console.log(`[RESET BILL] phase=receipt-lookup eventId=${eventId}`);
    const [receipt] = await db
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.eventId, eventId))
      .limit(1);

    if (!receipt) {
      console.log(`[RESET BILL] no receipt found — already empty, returning reset:true eventId=${eventId}`);
      res.json({ reset: true });
      return;
    }
    console.log(`[RESET BILL] receipt found receiptId=${receipt.id} eventId=${eventId}`);

    // Phase 2: Photo lookup
    console.log(`[RESET BILL] phase=photo-lookup receiptId=${receipt.id}`);
    const photos = await db
      .select({ objectPath: receiptPhotosTable.objectPath })
      .from(receiptPhotosTable)
      .where(eq(receiptPhotosTable.receiptId, receipt.id));
    console.log(`[RESET BILL] found ${photos.length} photo(s) to delete from storage`);

    // Phase 3: GCS deletion — fully isolated; any failure logs and continues
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`[RESET BILL] phase=gcs-delete [${i + 1}/${photos.length}] objectPath=${photo.objectPath}`);
      try {
        const { bucketName, objectName } = gcsPathFromObjectPath(photo.objectPath);
        await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
        console.log(`[RESET BILL] gcs-delete ok [${i + 1}/${photos.length}]`);
      } catch (gcsErr) {
        console.error(`[RESET BILL] gcs-delete FAILED [${i + 1}/${photos.length}] objectPath=${photo.objectPath}`, gcsErr);
        // Intentionally continue — storage failure must not block the DB cascade
      }
    }

    // Phase 4: DB delete (cascades receipt_photos, receipt_items, item_assignments, payment_requests)
    console.log(`[RESET BILL] phase=db-delete receiptId=${receipt.id}`);
    await db.delete(receiptsTable).where(eq(receiptsTable.id, receipt.id));
    console.log(`[RESET BILL] db-delete ok receiptId=${receipt.id}`);

    // Phase 5: Success
    console.log(`[RESET BILL] complete eventId=${eventId}`);
    res.json({ reset: true });
  } catch (error) {
    console.error("RESET BILL ERROR", error);
    res.status(500).json({ error: "Failed to reset bill" });
  }
});

// ─── Item claiming ────────────────────────────────────────────────────────────

router.post("/events/:eventId/receipt/items/:itemId/claim", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(eventId) || isNaN(itemId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Not a participant" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }

  if (!FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(eq(receiptsTable.eventId, eventId))
    .limit(1);

  if (!receipt) { res.status(404).json({ error: "No receipt for this event" }); return; }

  const [item] = await db
    .select()
    .from(receiptItemsTable)
    .where(and(eq(receiptItemsTable.id, itemId), eq(receiptItemsTable.receiptId, receipt.id)))
    .limit(1);

  if (!item) { res.status(404).json({ error: "Item not found in this event" }); return; }

  const [existing] = await db
    .select()
    .from(itemAssignmentsTable)
    .where(
      and(
        eq(itemAssignmentsTable.receiptItemId, itemId),
        eq(itemAssignmentsTable.userId, profile.id),
      ),
    )
    .limit(1);

  let assignment;
  if (existing) {
    [assignment] = await db
      .update(itemAssignmentsTable)
      .set({ claimed: !existing.claimed })
      .where(eq(itemAssignmentsTable.id, existing.id))
      .returning();
  } else {
    [assignment] = await db
      .insert(itemAssignmentsTable)
      .values({ receiptItemId: itemId, userId: profile.id, claimed: true })
      .returning();
  }

  res.status(201).json(assignment);
});

// ─── Host item assignment ─────────────────────────────────────────────────────

router.post("/events/:eventId/receipt/items/:itemId/assign", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (isNaN(eventId) || isNaN(itemId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
  if (participation.role !== "host") { res.status(403).json({ error: "Host only" }); return; }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const { userId, guestParticipantId: guestPId, claimed } = req.body as {
    userId?: number;
    guestParticipantId?: number;
    claimed: boolean;
  };

  if (typeof claimed !== "boolean") {
    res.status(400).json({ error: "claimed (boolean) required" });
    return;
  }
  const hasUser = typeof userId === "number";
  const hasGuest = typeof guestPId === "number";
  if (hasUser === hasGuest) {
    res.status(400).json({ error: "Exactly one of userId or guestParticipantId required" });
    return;
  }

  const [receipt] = await db.select().from(receiptsTable).where(eq(receiptsTable.eventId, eventId)).limit(1);
  if (!receipt) { res.status(404).json({ error: "No receipt for this event" }); return; }

  const [item] = await db.select().from(receiptItemsTable)
    .where(and(eq(receiptItemsTable.id, itemId), eq(receiptItemsTable.receiptId, receipt.id)))
    .limit(1);
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  if (hasGuest) {
    const [guestRow] = await db
      .select()
      .from(eventParticipantsTable)
      .where(and(
        eq(eventParticipantsTable.id, guestPId!),
        eq(eventParticipantsTable.eventId, eventId),
        isNull(eventParticipantsTable.userId),
      ))
      .limit(1);
    if (!guestRow) {
      res.status(400).json({ error: "Guest not found in this event" });
      return;
    }

    const [existing] = await db.select().from(itemAssignmentsTable)
      .where(and(eq(itemAssignmentsTable.receiptItemId, itemId), eq(itemAssignmentsTable.guestParticipantId, guestPId!)))
      .limit(1);

    let assignment;
    if (existing) {
      [assignment] = await db.update(itemAssignmentsTable)
        .set({ claimed })
        .where(eq(itemAssignmentsTable.id, existing.id))
        .returning();
    } else {
      [assignment] = await db.insert(itemAssignmentsTable)
        .values({ receiptItemId: itemId, guestParticipantId: guestPId!, claimed })
        .returning();
    }
    res.status(201).json(assignment);
    return;
  }

  const targetParticipation = await resolveParticipation(eventId, userId!);
  if (!targetParticipation || !FULL_ACCESS_ROLES.includes(targetParticipation.role)) {
    res.status(400).json({ error: "Target user is not an active participant" });
    return;
  }

  const [existing] = await db.select().from(itemAssignmentsTable)
    .where(and(eq(itemAssignmentsTable.receiptItemId, itemId), eq(itemAssignmentsTable.userId, userId!)))
    .limit(1);

  let assignment;
  if (existing) {
    [assignment] = await db.update(itemAssignmentsTable)
      .set({ claimed })
      .where(eq(itemAssignmentsTable.id, existing.id))
      .returning();
  } else {
    [assignment] = await db.insert(itemAssignmentsTable)
      .values({ receiptItemId: itemId, userId: userId!, claimed })
      .returning();
  }

  res.status(201).json(assignment);
});

// ─── Bulk item assignment ─────────────────────────────────────────────────────

router.patch("/events/:eventId/receipt/items/bulk-assignments", async (req, res) => {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event ID" }); return; }

    const profile = await resolveProfile(clerkUserId);
    if (!profile) { res.status(401).json({ error: "Profile not found" }); return; }

    const participation = await resolveParticipation(eventId, profile.id);
    if (!participation) { res.status(403).json({ error: "Not a participant" }); return; }
    if (participation.role !== "host") { res.status(403).json({ error: "Host only" }); return; }

    const event = await resolveEvent(eventId);
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

    const { itemIds, action, userIds, guestParticipantIds } = req.body as {
      itemIds: number[];
      action: "replace" | "assign_to_me" | "clear" | "assign_unclaimed_to_me";
      userIds?: number[];
      guestParticipantIds?: number[];
    };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: "itemIds must be a non-empty array" }); return;
    }
    if (!["replace", "assign_to_me", "clear", "assign_unclaimed_to_me"].includes(action)) {
      res.status(400).json({ error: "Invalid action" }); return;
    }
    if (action === "replace") {
      const hasUsers = Array.isArray(userIds) && userIds.length > 0;
      const hasGuests = Array.isArray(guestParticipantIds) && guestParticipantIds.length > 0;
      if (!hasUsers && !hasGuests) {
        res.status(400).json({ error: "userIds or guestParticipantIds required for replace action" }); return;
      }
    }

    const [receipt] = await db.select().from(receiptsTable).where(eq(receiptsTable.eventId, eventId)).limit(1);
    if (!receipt) { res.status(404).json({ error: "No receipt for this event" }); return; }

    // Validate all itemIds belong to this event's receipt (prevents cross-event tampering)
    const validItems = await db
      .select({ id: receiptItemsTable.id })
      .from(receiptItemsTable)
      .where(and(eq(receiptItemsTable.receiptId, receipt.id), inArray(receiptItemsTable.id, itemIds)));

    if (validItems.length !== itemIds.length) {
      res.status(400).json({ error: "One or more item IDs do not belong to this event" }); return;
    }

    await db.transaction(async (tx) => {
      if (action === "clear") {
        await tx.delete(itemAssignmentsTable).where(inArray(itemAssignmentsTable.receiptItemId, itemIds));

      } else if (action === "assign_to_me") {
        await tx.delete(itemAssignmentsTable).where(inArray(itemAssignmentsTable.receiptItemId, itemIds));
        await tx.insert(itemAssignmentsTable)
          .values(itemIds.map((id) => ({ receiptItemId: id, userId: profile.id, claimed: true })))
          .onConflictDoNothing();

      } else if (action === "replace") {
        // Validate that every target userId is an active (full-access) participant in this event
        const safeUserIds = Array.isArray(userIds) && userIds.length > 0 ? userIds : [];
        if (safeUserIds.length > 0) {
          const targetParticipations = await tx
            .select({ userId: eventParticipantsTable.userId, role: eventParticipantsTable.role })
            .from(eventParticipantsTable)
            .where(
              and(
                eq(eventParticipantsTable.eventId, eventId),
                inArray(eventParticipantsTable.userId, safeUserIds),
              ),
            );
          const validUserIds = new Set(
            targetParticipations
              .filter((p) => FULL_ACCESS_ROLES.includes(p.role))
              .map((p) => p.userId),
          );
          const invalidIds = safeUserIds.filter((uid) => !validUserIds.has(uid));
          if (invalidIds.length > 0) {
            throw Object.assign(new Error("One or more users are not active participants in this event"), { statusCode: 400 });
          }
        }

        // Validate that every guestParticipantId is an actual guest of this event
        const safeGuestIds = Array.isArray(guestParticipantIds) && guestParticipantIds.length > 0 ? guestParticipantIds : [];
        if (safeGuestIds.length > 0) {
          const validGuests = await tx
            .select({ id: eventParticipantsTable.id })
            .from(eventParticipantsTable)
            .where(
              and(
                eq(eventParticipantsTable.eventId, eventId),
                eq(eventParticipantsTable.role, "guest"),
                inArray(eventParticipantsTable.id, safeGuestIds),
              ),
            );
          const validGuestIdSet = new Set(validGuests.map((p) => p.id));
          const invalidGuestIds = safeGuestIds.filter((id) => !validGuestIdSet.has(id));
          if (invalidGuestIds.length > 0) {
            throw Object.assign(new Error("One or more guest IDs are not active guests in this event"), { statusCode: 400 });
          }
        }

        await tx.delete(itemAssignmentsTable).where(inArray(itemAssignmentsTable.receiptItemId, itemIds));
        const rows = [
          ...itemIds.flatMap((itemId) =>
            safeUserIds.map((uid) => ({ receiptItemId: itemId, userId: uid, guestParticipantId: null as number | null, claimed: true }))
          ),
          ...itemIds.flatMap((itemId) =>
            safeGuestIds.map((gid) => ({ receiptItemId: itemId, userId: null as number | null, guestParticipantId: gid, claimed: true }))
          ),
        ];
        if (rows.length > 0) {
          await tx.insert(itemAssignmentsTable).values(rows).onConflictDoNothing();
        }

      } else if (action === "assign_unclaimed_to_me") {
        // Only target items that currently have zero assignment rows
        const alreadyAssigned = await tx
          .select({ receiptItemId: itemAssignmentsTable.receiptItemId })
          .from(itemAssignmentsTable)
          .where(inArray(itemAssignmentsTable.receiptItemId, itemIds));
        const assignedIds = new Set(alreadyAssigned.map((r) => r.receiptItemId));
        const unclaimedIds = itemIds.filter((id) => !assignedIds.has(id));
        if (unclaimedIds.length > 0) {
          await tx.insert(itemAssignmentsTable)
            .values(unclaimedIds.map((id) => ({ receiptItemId: id, userId: profile.id, claimed: true })))
            .onConflictDoNothing();
        }
      }
    });

    res.json({ updated: itemIds.length });
  } catch (error: any) {
    if (error?.statusCode === 400) {
      res.status(400).json({ error: error.message }); return;
    }
    console.error("BULK ASSIGN ERROR", error);
    res.status(500).json({ error: "Failed to apply bulk assignment" });
  }
});

// ─── POST /events/:eventId/transfer-host ──────────────────────────────────────

router.post("/events/:eventId/transfer-host", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const targetUserId = parseInt(req.body.targetUserId, 10);
  if (isNaN(targetUserId)) { res.status(400).json({ error: "Invalid targetUserId" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  if (targetUserId === profile.id) {
    res.status(400).json({ error: "Cannot transfer host to yourself" });
    return;
  }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can transfer host ownership" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }

  const [targetParticipation] = await db
    .select()
    .from(eventParticipantsTable)
    .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.userId, targetUserId)))
    .limit(1);

  if (!targetParticipation) {
    res.status(404).json({ error: "Target participant not found" });
    return;
  }

  if (targetParticipation.role !== "accepted" && targetParticipation.role !== "participant") {
    res.status(400).json({ error: "Can only transfer host to an accepted or active participant" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-swap: only proceed if the caller is still the recorded owner.
      // A concurrent transfer that already committed will have changed ownerUserId,
      // so this update will match 0 rows and we abort with a 409.
      const updatedEvents = await tx
        .update(eventsTable)
        .set({ ownerUserId: targetUserId })
        .where(and(eq(eventsTable.id, eventId), eq(eventsTable.ownerUserId, profile.id)))
        .returning({ id: eventsTable.id });

      if (updatedEvents.length === 0) {
        throw Object.assign(new Error("Host transfer already in progress or completed by a concurrent request"), { statusCode: 409 });
      }

      // Demote the previous host only if their row still carries the host role,
      // preventing a no-op from silently leaving a stale host entry.
      await tx
        .update(eventParticipantsTable)
        .set({ role: "accepted" })
        .where(and(
          eq(eventParticipantsTable.eventId, eventId),
          eq(eventParticipantsTable.userId, profile.id),
          eq(eventParticipantsTable.role, "host"),
        ));

      await tx
        .update(eventParticipantsTable)
        .set({ role: "host" })
        .where(and(eq(eventParticipantsTable.eventId, eventId), eq(eventParticipantsTable.userId, targetUserId)));

      await tx
        .update(paymentRequestsTable)
        .set({ hostUserId: targetUserId })
        .where(and(eq(paymentRequestsTable.eventId, eventId), eq(paymentRequestsTable.hostUserId, profile.id)));
    });
  } catch (err: any) {
    if (err?.statusCode === 409) {
      res.status(409).json({ error: err.message }); return;
    }
    console.error("TRANSFER HOST ERROR", err);
    res.status(500).json({ error: "Failed to transfer host" }); return;
  }

  res.json({ eventId, newHostUserId: targetUserId, previousHostUserId: profile.id });
});

// ─── PATCH /events/:eventId ───────────────────────────────────────────────────

router.patch("/events/:eventId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can edit this event" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) {
    res.status(409).json({ error: "Cannot edit a cancelled event" });
    return;
  }

  const { title, restaurantName, destinationAddress, destinationLat, destinationLng, destinationPlaceId, startsAt } =
    req.body as {
      title?: unknown;
      restaurantName?: unknown;
      destinationAddress?: unknown;
      destinationLat?: unknown;
      destinationLng?: unknown;
      destinationPlaceId?: unknown;
      startsAt?: unknown;
    };

  const patch: Partial<{
    title: string;
    restaurantName: string | null;
    destinationAddress: string | null;
    destinationLat: number | null;
    destinationLng: number | null;
    destinationPlaceId: string | null;
    startsAt: Date | null;
  }> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "title must be a non-empty string" });
      return;
    }
    patch.title = title.trim();
  }

  if (restaurantName !== undefined) {
    patch.restaurantName = (restaurantName === null || restaurantName === "") ? null : String(restaurantName);
  }

  if (destinationAddress !== undefined) {
    patch.destinationAddress = (destinationAddress === null || destinationAddress === "") ? null : String(destinationAddress);
  }

  if (destinationLat !== undefined) {
    patch.destinationLat = destinationLat === null ? null : parseFloat(String(destinationLat));
  }

  if (destinationLng !== undefined) {
    patch.destinationLng = destinationLng === null ? null : parseFloat(String(destinationLng));
  }

  if (destinationPlaceId !== undefined) {
    patch.destinationPlaceId = (destinationPlaceId === null || destinationPlaceId === "") ? null : String(destinationPlaceId);
  }

  if (startsAt !== undefined) {
    if (startsAt === null) {
      patch.startsAt = null;
    } else {
      const d = new Date(String(startsAt));
      if (isNaN(d.getTime())) {
        res.status(400).json({ error: "startsAt must be a valid ISO date string" });
        return;
      }
      patch.startsAt = d;
    }
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set(patch)
    .where(eq(eventsTable.id, eventId))
    .returning();

  res.json(updated);
});

// ─── POST /events/:eventId/cancel ─────────────────────────────────────────────

router.post("/events/:eventId/cancel", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation) { res.status(404).json({ error: "Event not found" }); return; }
  if (participation.role !== "host") {
    res.status(403).json({ error: "Only the host can cancel this event" });
    return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event already cancelled" }); return; }

  const [updated] = await db
    .update(eventsTable)
    .set({ cancelledAt: new Date() })
    .where(eq(eventsTable.id, eventId))
    .returning();

  res.json({ id: updated.id, cancelledAt: updated.cancelledAt });
});

// ─── GET /places/discover ─────────────────────────────────────────────────────

const PLACES_DISCOVER_USER_LIMIT = 20;
const PLACES_DISCOVER_GLOBAL_LIMIT = 500;

router.get("/places/discover", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await resolveProfile(auth.userId);
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }

  const { cuisines, radius, lat, lng, zip } = req.query as {
    cuisines?: string;
    radius?: string;
    lat?: string;
    lng?: string;
    zip?: string;
  };

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) { res.status(503).json({ error: "Venue discovery unavailable" }); return; }

  const clientIp = getClientIp(req);
  const trusted = await hasEventParticipation(profile.id);
  if (!(await checkPlacesRateLimit("places_discover", auth.userId, clientIp, trusted))) {
    res.status(429).json({ error: "Too many discovery requests. Please try again later." }); return;
  }

  let latN = lat ? parseFloat(lat) : NaN;
  let lngN = lng ? parseFloat(lng) : NaN;
  const radiusM = radius ? Math.min(parseFloat(radius), 50000) : 1500; // radius in meters; default 1.5km

  // Geocode ZIP if no direct coords
  if ((isNaN(latN) || isNaN(lngN)) && zip?.trim()) {
    try {
      const biasParams = new URLSearchParams({ q: zip.trim(), format: "json", limit: "1", "accept-language": "en", countrycodes: "us" });
      const biasRes = await fetch(`https://nominatim.openstreetmap.org/search?${biasParams}`, {
        headers: { "User-Agent": "owmo-app/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(4000),
      });
      if (biasRes.ok) {
        const biasData = (await biasRes.json()) as Array<{ lat: string; lon: string }>;
        if (biasData[0]) { latN = parseFloat(biasData[0].lat); lngN = parseFloat(biasData[0].lon); }
      }
    } catch { /* ignore */ }
  }

  if (isNaN(latN) || isNaN(lngN)) {
    res.status(400).json({ error: "lat/lng or zip is required for discovery" }); return;
  }

  const cuisineTypes = cuisines?.split(",").map((c) => c.trim()).filter(Boolean) ?? [];

  try {
    // Use Nearby Search (new) endpoint for type-filtered discovery
    const body: Record<string, unknown> = {
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: latN, longitude: lngN },
          radius: radiusM,
        },
      },
      rankPreference: "POPULARITY",
    };

    if (cuisineTypes.length > 0) {
      // Map cuisine names to Google Places types
      const typeMap: Record<string, string[]> = {
        italian: ["italian_restaurant"],
        japanese: ["japanese_restaurant", "sushi_restaurant", "ramen_restaurant"],
        chinese: ["chinese_restaurant"],
        mexican: ["mexican_restaurant"],
        thai: ["thai_restaurant"],
        indian: ["indian_restaurant"],
        american: ["american_restaurant", "hamburger_restaurant"],
        pizza: ["pizza_restaurant"],
        seafood: ["seafood_restaurant"],
        coffee: ["coffee_shop", "cafe"],
        bar: ["bar", "pub"],
        brunch: ["brunch_restaurant", "breakfast_restaurant"],
        vegan: ["vegan_restaurant", "vegetarian_restaurant"],
        korean: ["korean_restaurant"],
        mediterranean: ["mediterranean_restaurant", "greek_restaurant"],
        french: ["french_restaurant"],
      };
      const mappedTypes = cuisineTypes.flatMap((c) => typeMap[c.toLowerCase()] ?? [`${c.toLowerCase()}_restaurant`]);
      if (mappedTypes.length > 0) {
        body.includedTypes = [...new Set(mappedTypes)].slice(0, 50);
      }
    } else {
      body.includedTypes = ["restaurant", "food"];
    }

    const googleRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName,places.photos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text().catch(() => "");
      console.error("Google Nearby Search error:", googleRes.status, errText);
      res.status(502).json({ error: "Discovery unavailable" }); return;
    }

    const data = (await googleRes.json()) as {
      places?: Array<{
        id: string;
        displayName: { text: string };
        formattedAddress?: string;
        location: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        primaryTypeDisplayName?: { text: string };
        photos?: Array<{ name: string }>;
      }>;
    };

    const priceLevelMap: Record<string, string> = {
      PRICE_LEVEL_FREE: "Free",
      PRICE_LEVEL_INEXPENSIVE: "$",
      PRICE_LEVEL_MODERATE: "$$",
      PRICE_LEVEL_EXPENSIVE: "$$$",
      PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
    };

    const results = (data.places ?? []).map((place) => ({
      placeId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress ?? "",
      lat: place.location.latitude,
      lng: place.location.longitude,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ? (priceLevelMap[place.priceLevel] ?? null) : null,
      primaryType: place.primaryTypeDisplayName?.text ?? null,
      photoUrl: place.photos?.[0]?.name ? `/api/places/photos?ref=${encodeURIComponent(place.photos[0].name)}&w=400` : null,
    }));

    res.json(results);
  } catch {
    res.status(502).json({ error: "Discovery unavailable" });
  }
});

// ─── POST /events/:eventId/suggestions ────────────────────────────────────────

const SUGGESTION_CAP = 4;

router.post("/events/:eventId/suggestions", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }
  if (event.destinationRequired) { res.status(400).json({ error: "This event already has a destination" }); return; }
  if (event.destinationDecidedAt) { res.status(400).json({ error: "Destination has already been decided" }); return; }
  if (event.votingOpenedAt) { res.status(400).json({ error: "Voting is already open; suggestions are locked" }); return; }

  const { placeId, placeName: manualPlaceName, placeAddress: manualPlaceAddress } = req.body as { placeId?: string; placeName?: string; placeAddress?: string };
  if (!placeId?.trim()) { res.status(400).json({ error: "placeId is required" }); return; }

  const trimmedPlaceId = placeId.trim();
  const isManual = trimmedPlaceId.startsWith("manual-");

  let details: { placeId: string; placeName: string; placeAddress: string | null; placeLat: number | null; placeLng: number | null; rating: number | null; photoUrl: string | null } | null = null;

  if (isManual) {
    if (!manualPlaceName?.trim()) { res.status(400).json({ error: "placeName is required for manual entries" }); return; }
    details = {
      placeId: trimmedPlaceId,
      placeName: manualPlaceName.trim(),
      placeAddress: manualPlaceAddress?.trim() || null,
      placeLat: null,
      placeLng: null,
      rating: null,
      photoUrl: null,
    };
  } else {
    // Resolve canonical place details server-side from Google Places
    const fetched = await fetchCanonicalPlaceDetails(trimmedPlaceId);
    if (!fetched) { res.status(503).json({ error: "Venue details unavailable. Try again or check the Google Places API key." }); return; }
    if (!fetched.placeName) { res.status(502).json({ error: "Could not retrieve venue name from Google Places" }); return; }
    details = fetched;
  }

  // Enforce cap
  const [{ activeSuggestions }] = await db
    .select({ activeSuggestions: count() })
    .from(eventVenueSuggestionsTable)
    .where(and(eq(eventVenueSuggestionsTable.eventId, eventId), eq(eventVenueSuggestionsTable.rescinded, false)));

  if (activeSuggestions >= SUGGESTION_CAP) {
    res.status(400).json({ error: `Maximum of ${SUGGESTION_CAP} suggestions allowed` }); return;
  }

  // Check for duplicate placeId for this event (skip for manual — each has a unique UUID)
  if (!isManual) {
    const [existing] = await db
      .select()
      .from(eventVenueSuggestionsTable)
      .where(and(
        eq(eventVenueSuggestionsTable.eventId, eventId),
        eq(eventVenueSuggestionsTable.placeId, details.placeId),
        eq(eventVenueSuggestionsTable.rescinded, false),
      ))
      .limit(1);

    if (existing) { res.status(409).json({ error: "This venue is already suggested" }); return; }
  }

  const [inserted] = await db
    .insert(eventVenueSuggestionsTable)
    .values({
      eventId,
      proposerUserId: profile.id,
      placeId: details.placeId,
      placeName: details.placeName,
      placeAddress: details.placeAddress,
      placeLat: details.placeLat,
      placeLng: details.placeLng,
      rating: details.rating,
      photoUrl: details.photoUrl,
    })
    .returning();

  // Notify host + other participants (fire-and-forget)
  void (async () => {
    const recipientIds = await getParticipantUserIds(eventId, profile.id);
    const tokens = await getUnmutedTokensForEvent(eventId, recipientIds);
    void sendExpoPush(
      tokens,
      "📍 New venue suggested!",
      `${resolveDisplayName(profile.displayName, profile.handle)} suggested ${details.placeName}`,
      { screen: "event", eventId, anchor: "voting" },
    );
  })();

  res.status(201).json({
    ...inserted,
    proposerDisplayName: resolveDisplayName(profile.displayName, profile.handle),
    voteCount: 0,
    myVote: false,
  });
});

// ─── DELETE /events/:eventId/suggestions/:suggestionId ────────────────────────

router.delete("/events/:eventId/suggestions/:suggestionId", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const suggestionId = parseInt(req.params.suggestionId, 10);
  if (isNaN(eventId) || isNaN(suggestionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const [suggestion] = await db
    .select()
    .from(eventVenueSuggestionsTable)
    .where(and(eq(eventVenueSuggestionsTable.id, suggestionId), eq(eventVenueSuggestionsTable.eventId, eventId)))
    .limit(1);

  if (!suggestion) { res.status(404).json({ error: "Suggestion not found" }); return; }
  if (suggestion.proposerUserId !== profile.id) {
    res.status(403).json({ error: "You can only rescind your own suggestions" }); return;
  }
  if (suggestion.rescinded) { res.status(400).json({ error: "Suggestion already rescinded" }); return; }

  const event = await resolveEvent(eventId);
  if (event?.votingOpenedAt) { res.status(400).json({ error: "Cannot rescind after voting has opened" }); return; }

  await db
    .update(eventVenueSuggestionsTable)
    .set({ rescinded: true })
    .where(eq(eventVenueSuggestionsTable.id, suggestionId));

  res.status(204).send();
});

// ─── POST /events/:eventId/suggestions/:suggestionId/votes ────────────────────

router.post("/events/:eventId/suggestions/:suggestionId/votes", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  const suggestionId = parseInt(req.params.suggestionId, 10);
  if (isNaN(eventId) || isNaN(suggestionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || !FULL_ACCESS_ROLES.includes(participation.role)) {
    res.status(403).json({ error: "Not a participant" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }
  if (!event.votingOpenedAt) { res.status(400).json({ error: "Voting is not open yet" }); return; }
  if (event.destinationDecidedAt) { res.status(400).json({ error: "Voting has already closed" }); return; }

  const now = new Date();
  if (event.votingDeadline && now > event.votingDeadline) {
    res.status(400).json({ error: "Voting deadline has passed" }); return;
  }

  const [suggestion] = await db
    .select()
    .from(eventVenueSuggestionsTable)
    .where(and(
      eq(eventVenueSuggestionsTable.id, suggestionId),
      eq(eventVenueSuggestionsTable.eventId, eventId),
      eq(eventVenueSuggestionsTable.rescinded, false),
    ))
    .limit(1);

  if (!suggestion) { res.status(404).json({ error: "Suggestion not found" }); return; }

  // Check if already voted — one vote per user per event (enforced by DB unique constraint too)
  const [existingVote] = await db
    .select()
    .from(eventVenueVotesTable)
    .where(and(
      eq(eventVenueVotesTable.eventId, eventId),
      eq(eventVenueVotesTable.voterUserId, profile.id),
    ))
    .limit(1);

  if (existingVote) { res.status(409).json({ error: "You have already voted" }); return; }

  await db.insert(eventVenueVotesTable).values({ eventId, suggestionId, voterUserId: profile.id });

  // Notify all other participants of the new vote (fire-and-forget)
  void (async () => {
    const recipientIds = await getParticipantUserIds(eventId, profile.id);
    const tokens = await getUnmutedTokensForEvent(eventId, recipientIds);
    void sendExpoPush(
      tokens,
      "👍 New vote on a venue!",
      `${resolveDisplayName(profile.displayName, profile.handle)} voted for ${suggestion.placeName}`,
      { screen: "event", eventId, anchor: "voting" },
    );
  })();

  // Return updated suggestion with vote counts
  const votes = await db
    .select()
    .from(eventVenueVotesTable)
    .where(eq(eventVenueVotesTable.suggestionId, suggestionId));

  res.status(201).json({
    ...suggestion,
    voteCount: votes.length,
    myVote: true,
  });
});

// ─── POST /events/:eventId/voting/open ────────────────────────────────────────

router.post("/events/:eventId/voting/open", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can open voting" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.cancelledAt) { res.status(409).json({ error: "Event has been cancelled" }); return; }
  if (event.destinationRequired) { res.status(400).json({ error: "This event already has a destination" }); return; }
  if (event.votingOpenedAt) { res.status(400).json({ error: "Voting is already open" }); return; }
  if (event.destinationDecidedAt) { res.status(400).json({ error: "Destination has already been decided" }); return; }

  const { durationHours } = req.body as { durationHours?: unknown };
  if (durationHours !== 24 && durationHours !== 48) {
    res.status(400).json({ error: "durationHours must be 24 or 48" }); return;
  }

  const [{ activeSuggestions }] = await db
    .select({ activeSuggestions: count() })
    .from(eventVenueSuggestionsTable)
    .where(and(eq(eventVenueSuggestionsTable.eventId, eventId), eq(eventVenueSuggestionsTable.rescinded, false)));

  if (activeSuggestions < 2) {
    res.status(400).json({ error: "At least 2 suggestions required to open voting" }); return;
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  const [updated] = await db
    .update(eventsTable)
    .set({ votingOpenedAt: now, votingDeadline: deadline })
    .where(eq(eventsTable.id, eventId))
    .returning();

  res.json({ votingOpenedAt: updated.votingOpenedAt, votingDeadline: updated.votingDeadline });

  // Notify all participants that voting has opened (fire-and-forget)
  void (async () => {
    const participantIds = await getParticipantUserIds(eventId);
    const tokens = await getUnmutedTokensForEvent(eventId, participantIds);
    void sendExpoPush(
      tokens,
      `🗳️ Vote for a venue in ${event.title ?? "your event"}!`,
      `Voting is open — you have ${durationHours} hours to cast your vote.`,
      { screen: "event", eventId, anchor: "voting" },
    );
  })();
});

// ─── PATCH /events/:eventId/voting/deadline ───────────────────────────────────

router.patch("/events/:eventId/voting/deadline", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can extend the deadline" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (!event.votingOpenedAt) { res.status(400).json({ error: "Voting has not been opened" }); return; }
  if (event.destinationDecidedAt) { res.status(400).json({ error: "Voting has already closed" }); return; }

  const now = new Date();
  if (event.votingDeadline && event.votingDeadline <= now) {
    res.status(400).json({ error: "Voting deadline has already passed; cannot extend" }); return;
  }

  const { durationHours } = req.body as { durationHours?: unknown };
  if (durationHours !== 24 && durationHours !== 48) {
    res.status(400).json({ error: "durationHours must be 24 or 48" }); return;
  }

  // Always extend forward from the current deadline (never shorten the window)
  const baseTime = event.votingDeadline && event.votingDeadline > now ? event.votingDeadline : now;
  const newDeadline = new Date(baseTime.getTime() + durationHours * 60 * 60 * 1000);

  const [updated] = await db
    .update(eventsTable)
    .set({ votingDeadline: newDeadline })
    .where(eq(eventsTable.id, eventId))
    .returning();

  res.json({ votingDeadline: updated.votingDeadline });
});

// ─── POST /events/:eventId/voting/close ──────────────────────────────────────

router.post("/events/:eventId/voting/close", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

  const profile = await resolveProfile(clerkUserId);
  if (!profile) { res.status(403).json({ error: "Profile not found" }); return; }

  const participation = await resolveParticipation(eventId, profile.id);
  if (!participation || participation.role !== "host") {
    res.status(403).json({ error: "Only the host can close voting" }); return;
  }

  const event = await resolveEvent(eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (!event.votingOpenedAt) { res.status(400).json({ error: "Voting has not been opened" }); return; }
  if (event.destinationDecidedAt) { res.status(400).json({ error: "Voting has already closed" }); return; }

  const { suggestionId: tiebreakerId } = req.body as { suggestionId?: unknown };

  // Get all active suggestions with vote counts
  const rawSuggestions = await db
    .select()
    .from(eventVenueSuggestionsTable)
    .where(and(eq(eventVenueSuggestionsTable.eventId, eventId), eq(eventVenueSuggestionsTable.rescinded, false)));

  const suggestionIds = rawSuggestions.map((s) => s.id);
  const allVotes = suggestionIds.length > 0
    ? await db.select().from(eventVenueVotesTable).where(inArray(eventVenueVotesTable.suggestionId, suggestionIds))
    : [];

  const voteCounts = rawSuggestions.map((s) => ({
    ...s,
    voteCount: allVotes.filter((v) => v.suggestionId === s.id).length,
  }));

  // Determine winner
  const maxVotes = Math.max(...voteCounts.map((s) => s.voteCount));
  const leaders = voteCounts.filter((s) => s.voteCount === maxVotes);

  let winner = leaders.length === 1 ? leaders[0] : null;

  // Tie-breaking: host may only choose from the tied leaders
  if (!winner && typeof tiebreakerId === "number") {
    const isLeader = leaders.some((l) => l.id === tiebreakerId);
    if (!isLeader) {
      res.status(400).json({ error: "Tiebreaker must be one of the tied leaders" }); return;
    }
    winner = leaders.find((l) => l.id === tiebreakerId)!;
  }

  if (!winner) {
    // Return tied state for host to resolve
    res.json({
      status: "tied",
      tiedIds: leaders.map((s) => s.id),
      winnerId: null,
      votingDeadline: event.votingDeadline,
      votingOpenedAt: event.votingOpenedAt,
    });
    return;
  }

  // Lock in the winner and transition event to destination-set state
  const now = new Date();
  await db.update(eventsTable).set({
    destinationDecidedAt: now,
    destinationRequired: true,
    restaurantName: winner.placeName,
    destinationAddress: winner.placeAddress,
    destinationLat: winner.placeLat,
    destinationLng: winner.placeLng,
    destinationPlaceId: winner.placeId,
  }).where(eq(eventsTable.id, eventId));

  // Notify all participants of the result (fire-and-forget)
  const wasTiebreak = typeof tiebreakerId === "number";
  void (async () => {
    const participantIds = await getParticipantUserIds(eventId);
    const tokens = await getUnmutedTokensForEvent(eventId, participantIds);
    const title = wasTiebreak
      ? `🏆 Tie broken! ${winner!.placeName} is the winner`
      : `📍 ${winner!.placeName} is the chosen spot for ${event.title ?? "your event"}!`;
    const body = wasTiebreak
      ? `The host has chosen ${winner!.placeName} for ${event.title ?? "your event"}. Tap to see the details.`
      : "The destination has been confirmed. Tap to see the details.";
    void sendExpoPush(tokens, title, body, { screen: "event", eventId });
  })();

  res.json({
    status: "decided",
    winnerId: winner.id,
    tiedIds: [],
    votingDeadline: event.votingDeadline,
    votingOpenedAt: event.votingOpenedAt,
  });
});

// ─── 2-hour voting deadline reminder scheduler ────────────────────────────────

const remindersSent = new Set<number>();

async function runVotingScheduler(): Promise<void> {
  try {
    const now = new Date();

    // 1. Auto-finalize any events whose deadline has passed
    const expired = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(
        and(
          isNotNull(eventsTable.votingOpenedAt),
          isNull(eventsTable.destinationDecidedAt),
          isNotNull(eventsTable.votingDeadline),
          lt(eventsTable.votingDeadline, now),
        ),
      );
    for (const { id } of expired) {
      await autoFinalizeVoting(id);
    }

    // 2. Send 2-hour reminders for events approaching deadline
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const approaching = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          isNotNull(eventsTable.votingOpenedAt),
          isNull(eventsTable.destinationDecidedAt),
          isNotNull(eventsTable.votingDeadline),
          gte(eventsTable.votingDeadline, now),
          lt(eventsTable.votingDeadline, twoHoursFromNow),
        ),
      );
    for (const event of approaching) {
      if (remindersSent.has(event.id)) continue;
      remindersSent.add(event.id);
      const participantIds = await getParticipantUserIds(event.id);
      const tokens = await getUnmutedTokensForEvent(event.id, participantIds);
      const minutesLeft = event.votingDeadline
        ? Math.round((event.votingDeadline.getTime() - now.getTime()) / 60_000)
        : 120;
      void sendExpoPush(
        tokens,
        "⏰ Vote before time's up!",
        `Voting for ${event.title ?? "your event"} closes in ~${minutesLeft} min`,
        { screen: "event", eventId: event.id, anchor: "voting" },
      );
    }
  } catch { /* ignore scheduler errors */ }
}

setInterval(() => { void runVotingScheduler(); }, 5 * 60 * 1000);

export default router;
