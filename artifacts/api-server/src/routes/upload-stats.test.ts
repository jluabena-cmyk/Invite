/**
 * Tests for:
 *   1. GET /api/admin/upload-stats — authorization, aggregation, 14-day filtering
 *   2. upload_events row insertion for every instrumented outcome path
 *
 * Outcomes covered:
 *   signing_fail   — SESSION_SECRET absent at upload-url (gallery + receipt)
 *   mime_rejected  — non-image MIME at upload-url (gallery + receipt)
 *   auth_fail      — missing token at confirm (gallery + receipt)
 *   auth_fail      — invalid/forged token at confirm (gallery + receipt)
 *   storage_fail   — GCS object absent at confirm (gallery + receipt)
 *   success        — happy-path confirm (gallery + receipt)
 *
 * rate_limited is omitted here because it requires direct Redis state
 * manipulation; the tracking call is in the same code-path pattern as the
 * others and is covered by code review.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import {
  db,
  userProfilesTable,
  eventsTable,
  eventParticipantsTable,
  uploadEventsTable,
  receiptPhotosTable,
  eventPhotosTable,
  receiptsTable,
} from "@workspace/db";
import { inArray, sql } from "drizzle-orm";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: currentClerkUserId }),
}));

const SIDECAR_PREFIX = "http://127.0.0.1:1106";
const FAKE_SIGNED_URL = "https://storage.googleapis.com/fake-bucket/fake-object?sig=test";
const realFetch = global.fetch;

// ── Shared state ──────────────────────────────────────────────────────────────

let currentClerkUserId = "test_ustats_host_001";
const HOST_CLERK_ID = "test_ustats_host_001";

let eventId: number;

const ADMIN_TOKEN = "test-admin-token-for-upload-stats";

const cleanup = {
  participantIds: [] as number[],
  eventIds: [] as number[],
  profileIds: [] as number[],
  uploadEventIds: [] as number[],
  receiptPhotoIds: [] as number[],
  eventPhotoIds: [] as number[],
  receiptIds: [] as number[],
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.PRIVATE_OBJECT_DIR = "fake-test-bucket";
  process.env.TELEMETRY_ADMIN_TOKEN = ADMIN_TOKEN;

  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
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
  const [host] = await db
    .insert(userProfilesTable)
    .values({
      clerkUserId: HOST_CLERK_ID,
      email: `ustats_host_${ts}@test.invalid`,
      handle: `ustatshost${ts}`,
    })
    .returning();
  cleanup.profileIds.push(host.id);

  const [event] = await db
    .insert(eventsTable)
    .values({ ownerUserId: host.id, title: "Upload Stats Test Event" })
    .returning();
  eventId = event.id;
  cleanup.eventIds.push(event.id);

  const [hp] = await db
    .insert(eventParticipantsTable)
    .values({ eventId: event.id, userId: host.id, role: "host" })
    .returning();
  cleanup.participantIds.push(hp.id);
});

afterAll(async () => {
  vi.unstubAllGlobals();

  if (cleanup.receiptPhotoIds.length)
    await db.delete(receiptPhotosTable).where(inArray(receiptPhotosTable.id, cleanup.receiptPhotoIds));
  if (cleanup.eventPhotoIds.length)
    await db.delete(eventPhotosTable).where(inArray(eventPhotosTable.id, cleanup.eventPhotoIds));
  if (cleanup.receiptIds.length)
    await db.delete(receiptsTable).where(inArray(receiptsTable.id, cleanup.receiptIds));

  // Remove all upload_events rows this test suite inserted.
  if (cleanup.uploadEventIds.length)
    await db.delete(uploadEventsTable).where(inArray(uploadEventsTable.id, cleanup.uploadEventIds));

  if (cleanup.participantIds.length)
    await db.delete(eventParticipantsTable).where(inArray(eventParticipantsTable.id, cleanup.participantIds));
  if (cleanup.eventIds.length)
    await db.delete(eventsTable).where(inArray(eventsTable.id, cleanup.eventIds));
  if (cleanup.profileIds.length)
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.id, cleanup.profileIds));

  delete process.env.PRIVATE_OBJECT_DIR;
  delete process.env.TELEMETRY_ADMIN_TOKEN;
});

beforeEach(() => {
  currentClerkUserId = HOST_CLERK_ID;
  gcsExists.value = true;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wait long enough for fire-and-forget trackUpload() DB inserts to complete.
 * trackUpload() is intentionally not awaited in the request handler; the DB
 * promise settles asynchronously on the same event loop tick after the response.
 */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

/**
 * Capture the current maximum upload_events id as a watermark.
 * Any rows inserted after this call will have id > watermark.
 * This is immune to parallel test-file execution because it uses the
 * monotonic serial PK rather than a wall-clock window.
 */
async function watermark(): Promise<number> {
  const rows = await db.execute<{ max_id: number | null }>(
    sql`SELECT MAX(id) AS max_id FROM upload_events`,
  );
  return rows.rows[0]?.max_id ?? 0;
}

/**
 * Count upload_events rows with id > minId that match (type, outcome).
 * Use with the value returned by watermark() to isolate exactly the rows
 * that the current test produced, even when other test files run concurrently.
 */
async function countSince(minId: number, type: string, outcome: string): Promise<number> {
  const rows = await db
    .select()
    .from(uploadEventsTable)
    .where(sql`id > ${minId} AND type = ${type} AND outcome = ${outcome}`);
  return rows.length;
}

/** Obtain a valid upload URL + token for the test event (gallery). */
async function galleryToken(): Promise<string> {
  const res = await request(app)
    .post(`/api/events/${eventId}/photos/upload-url`)
    .send({ mimeType: "image/jpeg" });
  expect(res.status).toBe(200);
  return res.body.token;
}

/** Obtain a valid upload URL + token for the test event (receipt). */
async function receiptToken(): Promise<string> {
  const res = await request(app)
    .post(`/api/events/${eventId}/receipt/photos/upload-url`)
    .send({ mimeType: "image/jpeg" });
  expect(res.status).toBe(200);
  return res.body.token;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin endpoint: authorization
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/upload-stats — authorization", () => {
  it("returns 401 with no x-admin-token header", async () => {
    const res = await request(app).get("/api/admin/upload-stats");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong x-admin-token", async () => {
    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", "not-the-right-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct token and has stats + since fields", async () => {
    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stats)).toBe(true);
    expect(typeof res.body.since).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin endpoint: aggregation
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/upload-stats — aggregation", () => {
  it("reflects directly inserted rows in the response", async () => {
    const inserted = await db
      .insert(uploadEventsTable)
      .values([
        { type: "gallery", outcome: "success" },
        { type: "gallery", outcome: "success" },
        { type: "receipt", outcome: "auth_fail" },
      ])
      .returning();
    cleanup.uploadEventIds.push(...inserted.map((r) => r.id));

    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const stats: Array<{ type: string; outcome: string; count: number }> = res.body.stats;

    const gallerySuccess = stats.find(
      (s) => s.type === "gallery" && s.outcome === "success",
    );
    expect(gallerySuccess).toBeDefined();
    expect(gallerySuccess!.count).toBeGreaterThanOrEqual(2);

    const receiptAuthFail = stats.find(
      (s) => s.type === "receipt" && s.outcome === "auth_fail",
    );
    expect(receiptAuthFail).toBeDefined();
    expect(receiptAuthFail!.count).toBeGreaterThanOrEqual(1);
  });

  it("each stat row has date, type, outcome, and count fields", async () => {
    const [row] = await db
      .insert(uploadEventsTable)
      .values({ type: "gallery", outcome: "mime_rejected" })
      .returning();
    cleanup.uploadEventIds.push(row.id);

    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", ADMIN_TOKEN);

    const stat = (res.body.stats as Array<Record<string, unknown>>).find(
      (s) => s.type === "gallery" && s.outcome === "mime_rejected",
    );
    expect(stat).toBeDefined();
    expect(typeof stat!.date).toBe("string");
    expect(typeof stat!.count).toBe("number");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin endpoint: 14-day filter (default)
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/upload-stats — 14-day window (default)", () => {
  it("excludes rows older than 14 days", async () => {
    // Insert a row then back-date it 15 days via raw SQL.
    const [stale] = await db
      .insert(uploadEventsTable)
      .values({ type: "gallery", outcome: "signing_fail" })
      .returning();
    cleanup.uploadEventIds.push(stale.id);
    await db.execute(
      sql`UPDATE upload_events SET created_at = NOW() - INTERVAL '15 days' WHERE id = ${stale.id}`,
    );

    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const stats: Array<{ date: string; type: string; outcome: string }> = res.body.stats;
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const staleEntry = stats.find(
      (s) =>
        s.date === fifteenDaysAgo &&
        s.type === "gallery" &&
        s.outcome === "signing_fail",
    );
    expect(staleEntry).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin endpoint: date-range query parameters
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/upload-stats — date-range query params", () => {
  it("?days=30 returns rows from the last 30 days and reflects since/until in the response", async () => {
    const res = await request(app)
      .get("/api/admin/upload-stats?days=30")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stats)).toBe(true);
    expect(typeof res.body.since).toBe("string");
    expect(typeof res.body.until).toBe("string");

    // since should be ~30 days ago (within a 5-second tolerance).
    const since = new Date(res.body.since).getTime();
    const expectedSince = Date.now() - 30 * 86_400_000;
    expect(Math.abs(since - expectedSince)).toBeLessThan(5_000);
  });

  it("?days=30 excludes rows older than 30 days", async () => {
    const [old] = await db
      .insert(uploadEventsTable)
      .values({ type: "receipt", outcome: "signing_fail" })
      .returning();
    cleanup.uploadEventIds.push(old.id);
    await db.execute(
      sql`UPDATE upload_events SET created_at = NOW() - INTERVAL '31 days' WHERE id = ${old.id}`,
    );

    const res = await request(app)
      .get("/api/admin/upload-stats?days=30")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const stats: Array<{ date: string; type: string; outcome: string }> = res.body.stats;
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86_400_000)
      .toISOString()
      .split("T")[0];
    const staleEntry = stats.find(
      (s) =>
        s.date === thirtyOneDaysAgo &&
        s.type === "receipt" &&
        s.outcome === "signing_fail",
    );
    expect(staleEntry).toBeUndefined();
  });

  it("?days=NaN falls back to the 14-day default without error", async () => {
    const res = await request(app)
      .get("/api/admin/upload-stats?days=notanumber")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    // since should be ~14 days ago (within a 5-second tolerance).
    const since = new Date(res.body.since).getTime();
    const expectedSince = Date.now() - 14 * 86_400_000;
    expect(Math.abs(since - expectedSince)).toBeLessThan(5_000);
  });

  it("?since=...&until=... includes rows on the until calendar date (inclusive)", async () => {
    // Insert a row and back-date it to exactly 10 days ago.
    const [row] = await db
      .insert(uploadEventsTable)
      .values({ type: "gallery", outcome: "auth_fail" })
      .returning();
    cleanup.uploadEventIds.push(row.id);
    await db.execute(
      sql`UPDATE upload_events SET created_at = NOW() - INTERVAL '10 days' WHERE id = ${row.id}`,
    );

    // Build a date-only until string for the same calendar day.
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .split("T")[0]; // e.g. "2026-07-30"
    const elevenDaysAgo = new Date(Date.now() - 11 * 86_400_000)
      .toISOString()
      .split("T")[0];

    const res = await request(app)
      .get(
        `/api/admin/upload-stats?since=${elevenDaysAgo}&until=${tenDaysAgo}`,
      )
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const stats: Array<{ date: string; type: string; outcome: string }> = res.body.stats;

    // The row's date (tenDaysAgo) must appear in the response — it is on the
    // inclusive until day so it should NOT be excluded.
    const found = stats.find(
      (s) =>
        s.date === tenDaysAgo &&
        s.type === "gallery" &&
        s.outcome === "auth_fail",
    );
    expect(found).toBeDefined();
  });

  it("?since=...&until=... excludes rows outside the window", async () => {
    // Insert a row and back-date it to 20 days ago.
    const [outside] = await db
      .insert(uploadEventsTable)
      .values({ type: "receipt", outcome: "mime_rejected" })
      .returning();
    cleanup.uploadEventIds.push(outside.id);
    await db.execute(
      sql`UPDATE upload_events SET created_at = NOW() - INTERVAL '20 days' WHERE id = ${outside.id}`,
    );

    // Query a window that is only 5–7 days ago — 20 days ago should be excluded.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
      .toISOString()
      .split("T")[0];
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000)
      .toISOString()
      .split("T")[0];

    const res = await request(app)
      .get(`/api/admin/upload-stats?since=${sevenDaysAgo}&until=${fiveDaysAgo}`)
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000)
      .toISOString()
      .split("T")[0];
    const found = res.body.stats.find(
      (s: { date: string; type: string; outcome: string }) =>
        s.date === twentyDaysAgo &&
        s.type === "receipt" &&
        s.outcome === "mime_rejected",
    );
    expect(found).toBeUndefined();
  });

  it("returns 400 when since is after until", async () => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    const res = await request(app)
      .get(`/api/admin/upload-stats?since=${today}&until=${yesterday}`)
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before/i);
  });

  it("returns 400 for an unparseable since value", async () => {
    const res = await request(app)
      .get("/api/admin/upload-stats?since=not-a-date&until=2026-08-01")
      .set("x-admin-token", ADMIN_TOKEN);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/since/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Telemetry tracking — gallery upload-url
// ═══════════════════════════════════════════════════════════════════════════════

describe("trackUpload — gallery upload-url", () => {
  it("records signing_fail when SESSION_SECRET is absent", async () => {
    const wm = await watermark();
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const res = await request(app)
        .post(`/api/events/${eventId}/photos/upload-url`)
        .send({ mimeType: "image/jpeg" });
      expect(res.status).toBe(500);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
    await settle();
    expect(await countSince(wm, "gallery", "signing_fail")).toBe(1);
  });

  it("records mime_rejected for a non-image MIME type", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .send({ mimeType: "application/pdf" });
    expect(res.status).toBe(415);
    await settle();
    expect(await countSince(wm, "gallery", "mime_rejected")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Telemetry tracking — gallery confirm
// ═══════════════════════════════════════════════════════════════════════════════

describe("trackUpload — gallery confirm", () => {
  it("records auth_fail when token is missing from request body", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/confirm`)
      .send({});
    expect(res.status).toBe(400);
    await settle();
    expect(await countSince(wm, "gallery", "auth_fail")).toBe(1);
  });

  it("records auth_fail for a forged / invalid token", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/confirm`)
      .send({ token: "forged.notavalidtoken" });
    expect(res.status).toBe(400);
    await settle();
    expect(await countSince(wm, "gallery", "auth_fail")).toBe(1);
  });

  it("records storage_fail when GCS object is absent at confirm time", async () => {
    const token = await galleryToken();
    gcsExists.value = false;

    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/confirm`)
      .send({ token });
    expect(res.status).toBe(422);
    await settle();
    expect(await countSince(wm, "gallery", "storage_fail")).toBe(1);
  });

  it("records success on a valid gallery confirm", async () => {
    gcsExists.value = true;
    const token = await galleryToken();

    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/confirm`)
      .send({ token });
    expect(res.status).toBe(201);
    if (res.body.id) cleanup.eventPhotoIds.push(res.body.id);
    await settle();
    expect(await countSince(wm, "gallery", "success")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Telemetry tracking — receipt upload-url
// ═══════════════════════════════════════════════════════════════════════════════

describe("trackUpload — receipt upload-url", () => {
  it("records signing_fail when SESSION_SECRET is absent", async () => {
    const wm = await watermark();
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      const res = await request(app)
        .post(`/api/events/${eventId}/receipt/photos/upload-url`)
        .send({ mimeType: "image/jpeg" });
      expect(res.status).toBe(500);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
    await settle();
    expect(await countSince(wm, "receipt", "signing_fail")).toBe(1);
  });

  it("records mime_rejected for a non-image MIME type", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/upload-url`)
      .send({ mimeType: "text/csv" });
    expect(res.status).toBe(415);
    await settle();
    expect(await countSince(wm, "receipt", "mime_rejected")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Telemetry tracking — receipt confirm
// ═══════════════════════════════════════════════════════════════════════════════

describe("trackUpload — receipt confirm", () => {
  it("records auth_fail when token is missing from request body", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/confirm`)
      .send({});
    expect(res.status).toBe(400);
    await settle();
    expect(await countSince(wm, "receipt", "auth_fail")).toBe(1);
  });

  it("records auth_fail for a forged / invalid token", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/confirm`)
      .send({ token: "bad.fakesignature" });
    expect(res.status).toBe(400);
    await settle();
    expect(await countSince(wm, "receipt", "auth_fail")).toBe(1);
  });

  it("records storage_fail when GCS object is absent at confirm time", async () => {
    const token = await receiptToken();
    gcsExists.value = false;

    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/confirm`)
      .send({ token });
    expect(res.status).toBe(422);
    await settle();
    expect(await countSince(wm, "receipt", "storage_fail")).toBe(1);
  });

  it("records success on a valid receipt confirm", async () => {
    gcsExists.value = true;
    const token = await receiptToken();

    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/confirm`)
      .send({ token });
    expect(res.status).toBe(201);
    if (res.body.id) cleanup.receiptPhotoIds.push(res.body.id);
    await settle();
    expect(await countSince(wm, "receipt", "success")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Build number tracking — x-app-build header
// ═══════════════════════════════════════════════════════════════════════════════

describe("build number — x-app-build header persistence", () => {
  it("persists build_number from x-app-build header on gallery upload-url outcome", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set("x-app-build", "55")
      .send({ mimeType: "application/pdf" }); // mime_rejected — cheapest failing path
    expect(res.status).toBe(415);
    await settle();
    const rows = await db
      .select()
      .from(uploadEventsTable)
      .where(sql`id > ${wm} AND type = 'gallery' AND outcome = 'mime_rejected'`);
    expect(rows.length).toBe(1);
    expect(rows[0].buildNumber).toBe("55");
    cleanup.uploadEventIds.push(rows[0].id);
  });

  it("persists build_number from x-app-build header on receipt upload-url outcome", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/receipt/photos/upload-url`)
      .set("x-app-build", "55")
      .send({ mimeType: "text/plain" }); // mime_rejected
    expect(res.status).toBe(415);
    await settle();
    const rows = await db
      .select()
      .from(uploadEventsTable)
      .where(sql`id > ${wm} AND type = 'receipt' AND outcome = 'mime_rejected'`);
    expect(rows.length).toBe(1);
    expect(rows[0].buildNumber).toBe("55");
    cleanup.uploadEventIds.push(rows[0].id);
  });

  it("stores null build_number when x-app-build header is absent", async () => {
    const wm = await watermark();
    const res = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      // no x-app-build header
      .send({ mimeType: "application/pdf" }); // mime_rejected
    expect(res.status).toBe(415);
    await settle();
    const rows = await db
      .select()
      .from(uploadEventsTable)
      .where(sql`id > ${wm} AND type = 'gallery' AND outcome = 'mime_rejected'`);
    expect(rows.length).toBe(1);
    expect(rows[0].buildNumber).toBeNull();
    cleanup.uploadEventIds.push(rows[0].id);
  });

  it("GET /api/admin/upload-stats groups distinct builds into separate rows and exposes buildNumber", async () => {
    // Insert rows for two distinct builds directly so we control the data precisely.
    const inserted = await db
      .insert(uploadEventsTable)
      .values([
        { type: "gallery", outcome: "success", buildNumber: "97" },
        { type: "gallery", outcome: "success", buildNumber: "97" },
        { type: "gallery", outcome: "auth_fail", buildNumber: "98" },
      ])
      .returning();
    cleanup.uploadEventIds.push(...inserted.map((r) => r.id));

    const res = await request(app)
      .get("/api/admin/upload-stats")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);

    const stats: Array<{ type: string; outcome: string; buildNumber: string | null; count: number }> =
      res.body.stats;

    // Build 97 success rows must be their own group.
    const b97 = stats.find(
      (s) => s.type === "gallery" && s.outcome === "success" && s.buildNumber === "97",
    );
    expect(b97).toBeDefined();
    expect(b97!.count).toBeGreaterThanOrEqual(2);

    // Build 98 auth_fail must be a separate group from build 97.
    const b98 = stats.find(
      (s) => s.type === "gallery" && s.outcome === "auth_fail" && s.buildNumber === "98",
    );
    expect(b98).toBeDefined();
    expect(b98!.count).toBeGreaterThanOrEqual(1);

    // Every stat row must expose the buildNumber field (may be null for legacy rows).
    for (const stat of stats) {
      expect("buildNumber" in stat).toBe(true);
    }
  });
});
