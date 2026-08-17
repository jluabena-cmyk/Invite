/**
 * Tests for the pre-signed photo upload endpoints:
 *   POST /events/:eventId/photos/upload-url
 *   POST /events/:eventId/photos/confirm
 *   POST /events/:eventId/receipt/photos/upload-url
 *   POST /events/:eventId/receipt/photos/confirm
 *
 * Security coverage:
 *   - Unauthenticated / non-participant access → 403
 *   - Role enforcement (host-only receipt, full-access gallery)
 *   - MIME type allowlist enforcement
 *   - Forged / tampered token → 400
 *   - Cross-event confirmation (token from event A used in event B) → 403
 *   - Cross-user confirmation (token issued to user A, used by user B) → 403
 *   - Wrong upload-kind (gallery token at receipt endpoint) → 400
 *   - GCS object not present after declared PUT → 422
 *   - Idempotent double-confirm → 200 (same record)
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  receiptsTable,
  receiptPhotosTable,
  eventPhotosTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// GCS existence mock — toggle per-test to simulate upload presence/absence.
const { gcsExists } = vi.hoisted(() => ({ gcsExists: { value: true } }));

vi.mock("../lib/objectStorage", () => ({
  objectStorageClient: {
    bucket: () => ({
      file: () => ({
        exists: () => Promise.resolve([gcsExists.value]),
        delete: () => Promise.resolve([{}]),
      }),
    }),
  },
}));

// Clerk auth mock — reads currentClerkUserId at call time so beforeEach resets work.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: currentClerkUserId }),
}));

// GCS sidecar mock — signUploadUrl / signDownloadUrl call http://127.0.0.1:1106.
const SIDECAR_PREFIX = "http://127.0.0.1:1106";
const FAKE_SIGNED_URL = "https://storage.googleapis.com/fake-bucket/fake-object?sig=test";
const realFetch = global.fetch;

// ── Clerk state ───────────────────────────────────────────────────────────────
let currentClerkUserId = "test_presign_host_001";

// ── Constants ─────────────────────────────────────────────────────────────────
const HOST_CLERK_ID = "test_presign_host_001";
const PARTICIPANT_CLERK_ID = "test_presign_participant_002";
const OUTSIDER_CLERK_ID = "test_presign_outsider_003";

// ── Seed state ────────────────────────────────────────────────────────────────
let eventId: number;
let eventId2: number; // second event — same host, used for cross-event tests

const cleanup = {
  receiptPhotoIds: [] as number[],
  eventPhotoIds: [] as number[],
  receiptIds: [] as number[],
  participantIds: [] as number[],
  eventIds: [] as number[],
  profileIds: [] as number[],
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.PRIVATE_OBJECT_DIR = "fake-test-bucket";

  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.startsWith(SIDECAR_PREFIX)) {
      return Promise.resolve(
        new Response(JSON.stringify({ signed_url: FAKE_SIGNED_URL }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return realFetch(input, init);
  });

  const ts = Date.now();

  // Use onConflictDoUpdate so a stale row from a previously crashed run is
  // refreshed in place rather than causing a unique-constraint violation.
  const [host] = await db
    .insert(userProfilesTable)
    .values({ clerkUserId: HOST_CLERK_ID, email: `presign_host_${ts}@test.invalid`, handle: `presignhost${ts}` })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: { email: `presign_host_${ts}@test.invalid`, handle: `presignhost${ts}` },
    })
    .returning();
  cleanup.profileIds.push(host.id);

  const [participant] = await db
    .insert(userProfilesTable)
    .values({ clerkUserId: PARTICIPANT_CLERK_ID, email: `presign_part_${ts}@test.invalid`, handle: `presignpart${ts}` })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: { email: `presign_part_${ts}@test.invalid`, handle: `presignpart${ts}` },
    })
    .returning();
  cleanup.profileIds.push(participant.id);

  const [outsider] = await db
    .insert(userProfilesTable)
    .values({ clerkUserId: OUTSIDER_CLERK_ID, email: `presign_out_${ts}@test.invalid`, handle: `presignout${ts}` })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkUserId,
      set: { email: `presign_out_${ts}@test.invalid`, handle: `presignout${ts}` },
    })
    .returning();
  cleanup.profileIds.push(outsider.id);

  // Event 1
  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Presign Test Event 1" })
    .returning();
  eventId = event.id;
  cleanup.eventIds.push(event.id);

  const [hp] = await db.insert(eventParticipantsTable).values({ eventId: event.id, userId: host.id, role: "host" }).returning();
  cleanup.participantIds.push(hp.id);
  const [pp] = await db.insert(eventParticipantsTable).values({ eventId: event.id, userId: participant.id, role: "participant" }).returning();
  cleanup.participantIds.push(pp.id);

  // Event 2 — host is also host here, used for cross-event confirmation tests
  const [event2] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Presign Test Event 2" })
    .returning();
  eventId2 = event2.id;
  cleanup.eventIds.push(event2.id);

  const [hp2] = await db.insert(eventParticipantsTable).values({ eventId: event2.id, userId: host.id, role: "host" }).returning();
  cleanup.participantIds.push(hp2.id);
});

afterAll(async () => {
  vi.unstubAllGlobals();

  if (cleanup.receiptPhotoIds.length)
    await db.delete(receiptPhotosTable).where(inArray(receiptPhotosTable.id, cleanup.receiptPhotoIds));
  if (cleanup.eventPhotoIds.length)
    await db.delete(eventPhotosTable).where(inArray(eventPhotosTable.id, cleanup.eventPhotoIds));
  if (cleanup.receiptIds.length)
    await db.delete(receiptsTable).where(inArray(receiptsTable.id, cleanup.receiptIds));
  if (cleanup.participantIds.length)
    await db.delete(eventParticipantsTable).where(inArray(eventParticipantsTable.id, cleanup.participantIds));
  if (cleanup.eventIds.length)
    await db.delete(eventsTable).where(inArray(eventsTable.id, cleanup.eventIds));
  // Also delete any orphaned receipts referencing these profiles (e.g. left by a
  // previously crashed run whose afterAll never executed).  receipts.onDelete is
  // "restrict", so these must be removed before the profile rows can be deleted.
  if (cleanup.profileIds.length)
    await db.delete(receiptsTable).where(inArray(receiptsTable.uploadedByUserId, cleanup.profileIds));
  if (cleanup.profileIds.length)
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.id, cleanup.profileIds));

  delete process.env.PRIVATE_OBJECT_DIR;
});

beforeEach(() => {
  currentClerkUserId = HOST_CLERK_ID;
  gcsExists.value = true;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getReceiptUploadToken(forEventId = eventId) {
  const res = await request(app)
    .post(`/api/events/${forEventId}/receipt/photos/upload-url`)
    .send({ mimeType: "image/jpeg" });
  expect(res.status).toBe(200);
  return res.body as { uploadUrl: string; objectPath: string; token: string };
}

async function getGalleryUploadToken(forEventId = eventId) {
  const res = await request(app)
    .post(`/api/events/${forEventId}/photos/upload-url`)
    .send({ mimeType: "image/jpeg" });
  expect(res.status).toBe(200);
  return res.body as { uploadUrl: string; objectPath: string; token: string };
}

// ── Signing-key configuration regression ─────────────────────────────────────
// Verifies that a missing SESSION_SECRET fails closed: the server refuses to
// issue tokens (500) and refuses to accept any token presented to confirm (400).
// This prevents a misconfigured deployment from silently accepting forged tokens.

describe("SESSION_SECRET not set", () => {
  it("returns 500 on upload-url when SESSION_SECRET is absent — no tokens can be issued", async () => {
    const savedSecret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const res = await request(app)
        .post(`/api/events/${eventId}/receipt/photos/upload-url`)
        .send({ mimeType: "image/jpeg" });
      expect(res.status).toBe(500);
    } finally {
      process.env.SESSION_SECRET = savedSecret;
    }
  });

  it("returns 400 on confirm when SESSION_SECRET is absent — no previously-issued token is accepted", async () => {
    // Obtain a real token while the secret is set, then clear the secret.
    // Even a legitimately-issued token must be rejected when the key is gone.
    const { token } = await getReceiptUploadToken();
    const savedSecret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const res = await request(app)
        .post(`/api/events/${eventId}/receipt/photos/confirm`)
        .send({ token });
      expect(res.status).toBe(400);
    } finally {
      process.env.SESSION_SECRET = savedSecret;
    }
  });
});

// ── Receipt: upload-url ───────────────────────────────────────────────────────

describe("POST /events/:eventId/receipt/photos/upload-url", () => {
  it("returns 403 when caller is not a participant", async () => {
    currentClerkUserId = OUTSIDER_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/upload-url`).send({ mimeType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is a participant (not the host)", async () => {
    currentClerkUserId = PARTICIPANT_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/upload-url`).send({ mimeType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("returns 415 for a disallowed MIME type", async () => {
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/upload-url`).send({ mimeType: "image/svg+xml" });
    expect(res.status).toBe(415);
  });

  it("returns uploadUrl, objectPath, and a signed token for the host", async () => {
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/upload-url`).send({ mimeType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe(FAKE_SIGNED_URL);
    expect(typeof res.body.objectPath).toBe("string");
    expect(res.body.objectPath).toMatch(/^\/objects\/receipt-photos\//);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
  });
});

// ── Receipt: confirm ──────────────────────────────────────────────────────────

describe("POST /events/:eventId/receipt/photos/confirm", () => {
  it("returns 400 when no token is provided", async () => {
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for a forged token", async () => {
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token: "forged.token.string" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when caller is a participant (not the host)", async () => {
    const { token } = await getReceiptUploadToken();
    currentClerkUserId = PARTICIPANT_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token });
    expect(res.status).toBe(403);
  });

  it("cross-event: returns 403 when token was issued for a different event", async () => {
    // Token issued for event1, confirmed against event2 path
    const { token } = await getReceiptUploadToken(eventId);
    const res = await request(app).post(`/api/events/${eventId2}/receipt/photos/confirm`).send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/different event/i);
  });

  it("wrong upload-kind: returns 400 when a gallery token is used at the receipt endpoint", async () => {
    // Get a gallery token (event_photo kind) and try to use it at the receipt endpoint
    const { token: galleryToken } = await getGalleryUploadToken();
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token: galleryToken });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different upload kind/i);
  });

  it("returns 422 when the GCS object does not exist (PUT was not completed)", async () => {
    const { token } = await getReceiptUploadToken();
    gcsExists.value = false;
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token });
    expect(res.status).toBe(422);
  });

  it("creates a receipt and photo record on first confirm (201)", async () => {
    const { token } = await getReceiptUploadToken();
    const res = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("number");
    expect(res.body.signedImageUrl).toBe(FAKE_SIGNED_URL);
    cleanup.receiptPhotoIds.push(res.body.id);
    const [receipt] = await db.select().from(receiptsTable).where(eq(receiptsTable.eventId, eventId)).limit(1);
    if (receipt) cleanup.receiptIds.push(receipt.id);
  });

  it("is idempotent — second confirm returns the same record (200)", async () => {
    const { token } = await getReceiptUploadToken();
    const first = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token });
    expect(first.status).toBe(201);
    cleanup.receiptPhotoIds.push(first.body.id);

    const second = await request(app).post(`/api/events/${eventId}/receipt/photos/confirm`).send({ token });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });
});

// ── Gallery: upload-url ───────────────────────────────────────────────────────

describe("POST /events/:eventId/photos/upload-url", () => {
  it("returns 403 for someone not in the event", async () => {
    currentClerkUserId = OUTSIDER_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/photos/upload-url`).send({ mimeType: "image/jpeg" });
    expect(res.status).toBe(403);
  });

  it("returns 415 for a disallowed MIME type", async () => {
    const res = await request(app).post(`/api/events/${eventId}/photos/upload-url`).send({ mimeType: "application/pdf" });
    expect(res.status).toBe(415);
  });

  it("allows a full-access participant (not just the host) to get an upload URL", async () => {
    currentClerkUserId = PARTICIPANT_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/photos/upload-url`).send({ mimeType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe(FAKE_SIGNED_URL);
    expect(res.body.objectPath).toMatch(/^\/objects\/event-photos\//);
    expect(typeof res.body.token).toBe("string");
  });

  it("also works for the host", async () => {
    const res = await request(app).post(`/api/events/${eventId}/photos/upload-url`).send({ mimeType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.objectPath).toMatch(/^\/objects\/event-photos\//);
  });
});

// ── Gallery: confirm ──────────────────────────────────────────────────────────

describe("POST /events/:eventId/photos/confirm", () => {
  it("returns 400 when no token is provided", async () => {
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for a forged token", async () => {
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token: "invalid.token" });
    expect(res.status).toBe(400);
  });

  it("returns 403 for an outsider even with a forged-looking token", async () => {
    currentClerkUserId = OUTSIDER_CLERK_ID;
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token: "x.y" });
    expect(res.status).toBe(403);
  });

  it("cross-event: returns 403 when token was issued for a different event", async () => {
    // Token issued for event1; try to confirm at event2 path (host is in both)
    const { token } = await getGalleryUploadToken(eventId);
    const res = await request(app).post(`/api/events/${eventId2}/photos/confirm`).send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/different event/i);
  });

  it("cross-user: returns 403 when token was issued to a different user", async () => {
    // Host gets a token, then participant (also full-access) tries to use it
    const { token } = await getGalleryUploadToken(eventId); // issued to HOST
    currentClerkUserId = PARTICIPANT_CLERK_ID; // logged in as PARTICIPANT
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/different user/i);
  });

  it("wrong upload-kind: returns 400 when a receipt token is used at the gallery endpoint", async () => {
    const { token: receiptToken } = await getReceiptUploadToken();
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token: receiptToken });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different upload kind/i);
  });

  it("returns 422 when the GCS object does not exist (PUT was not completed)", async () => {
    const { token } = await getGalleryUploadToken();
    gcsExists.value = false;
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token });
    expect(res.status).toBe(422);
  });

  it("creates a gallery photo record on first confirm (201)", async () => {
    const { token } = await getGalleryUploadToken();
    const res = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("number");
    expect(res.body.signedImageUrl).toBe(FAKE_SIGNED_URL);
    cleanup.eventPhotoIds.push(res.body.id);
  });

  it("is idempotent — second confirm returns the same record (200)", async () => {
    const { token } = await getGalleryUploadToken();
    const first = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token });
    expect(first.status).toBe(201);
    cleanup.eventPhotoIds.push(first.body.id);

    const second = await request(app).post(`/api/events/${eventId}/photos/confirm`).send({ token });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });
});
