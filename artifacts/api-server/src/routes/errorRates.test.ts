import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { and, eq, gte } from "drizzle-orm";
import app from "../app";
import { db, apiErrorCountsTable } from "@workspace/db";
import { toHourBucket } from "../middleware/errorRateTracker";

const ADMIN_TOKEN = process.env.TELEMETRY_ADMIN_TOKEN ?? "";

// Endpoints exercised during tests — cleaned up before and after each test.
const TEST_ENDPOINTS = [
  "/api/telemetry/launch", // will produce a 400 (validation failure)
  "/api/ping",             // will produce a 200
];

/** Remove any error-count rows for our test endpoints to keep tests isolated. */
async function cleanup() {
  for (const ep of TEST_ENDPOINTS) {
    await db
      .delete(apiErrorCountsTable)
      .where(eq(apiErrorCountsTable.endpoint, ep));
  }
}

beforeEach(cleanup);
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Unit tests — toHourBucket()
// ---------------------------------------------------------------------------

describe("toHourBucket()", () => {
  it("strips minutes, seconds, and milliseconds, keeping the UTC hour", () => {
    const d = new Date("2024-06-15T13:47:22.500Z");
    const bucket = toHourBucket(d);
    expect(bucket.toISOString()).toBe("2024-06-15T13:00:00.000Z");
  });

  it("returns the same value when the input is already at the top of the hour", () => {
    const d = new Date("2024-06-15T08:00:00.000Z");
    const bucket = toHourBucket(d);
    expect(bucket.toISOString()).toBe("2024-06-15T08:00:00.000Z");
  });

  it("handles midnight boundary (23:59:59 → 23:00, 00:01 → 00:00)", () => {
    const justBeforeMidnight = new Date("2024-03-10T23:59:59.999Z");
    expect(toHourBucket(justBeforeMidnight).toISOString()).toBe(
      "2024-03-10T23:00:00.000Z",
    );

    const justAfterMidnight = new Date("2024-03-11T00:01:00.000Z");
    expect(toHourBucket(justAfterMidnight).toISOString()).toBe(
      "2024-03-11T00:00:00.000Z",
    );
  });

  it("handles a DST spring-forward date without drifting (uses UTC, not local)", () => {
    // 2024-03-10 02:00 is when the US springs forward — UTC is unaffected.
    const d = new Date("2024-03-10T07:45:00.000Z"); // 02:45 US/Eastern before spring-forward
    const bucket = toHourBucket(d);
    expect(bucket.toISOString()).toBe("2024-03-10T07:00:00.000Z");
  });

  it("handles a DST fall-back date without drifting (uses UTC, not local)", () => {
    // 2024-11-03 06:00 UTC = 01:00 EST right after fall-back from 02:00 EDT
    const d = new Date("2024-11-03T06:30:00.000Z");
    const bucket = toHourBucket(d);
    expect(bucket.toISOString()).toBe("2024-11-03T06:00:00.000Z");
  });

  it("produces a plain Date (not moment/luxon) with getTime() reflecting the bucket", () => {
    const d = new Date("2024-01-01T12:34:56.789Z");
    const bucket = toHourBucket(d);
    expect(bucket instanceof Date).toBe(true);
    expect(bucket.getTime()).toBe(new Date("2024-01-01T12:00:00.000Z").getTime());
  });
});

// ---------------------------------------------------------------------------
// Integration tests — errorRateTracker middleware
// ---------------------------------------------------------------------------

/** Small helper: wait up to `timeout` ms for fn() to return true. */
async function pollUntil(
  fn: () => Promise<boolean>,
  { interval = 50, timeout = 2000 }: { interval?: number; timeout?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

describe("errorRateTracker middleware", () => {
  it("increments the count row for a 4xx response", async () => {
    // POST /api/telemetry/launch with missing required fields → 400
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({ clerkStatus: "loaded" }); // missing sessionId

    expect(res.status).toBe(400);

    // The upsert is fire-and-forget; poll until the row appears.
    const found = await pollUntil(async () => {
      const rows = await db
        .select()
        .from(apiErrorCountsTable)
        .where(eq(apiErrorCountsTable.endpoint, "/api/telemetry/launch"));
      return rows.some((r) => r.statusCode === 400 && r.count >= 1);
    });

    expect(found).toBe(true);
  });

  it("increments count again on repeated 4xx requests (upsert logic)", async () => {
    const badPayload = { clerkStatus: "loaded" }; // missing sessionId → 400

    await request(app).post("/api/telemetry/launch").send(badPayload);
    await request(app).post("/api/telemetry/launch").send(badPayload);

    const found = await pollUntil(async () => {
      const rows = await db
        .select()
        .from(apiErrorCountsTable)
        .where(eq(apiErrorCountsTable.endpoint, "/api/telemetry/launch"));
      return rows.some((r) => r.statusCode === 400 && r.count >= 2);
    });

    expect(found).toBe(true);
  });

  it("does NOT insert a row for a 2xx response", async () => {
    const res = await request(app).get("/api/ping");
    expect(res.status).toBe(200);

    // Give the event loop a moment — if a (wrong) write were queued it would run now.
    await new Promise((r) => setTimeout(r, 200));

    const rows = await db
      .select()
      .from(apiErrorCountsTable)
      .where(
        and(
          eq(apiErrorCountsTable.endpoint, "/api/ping"),
          eq(apiErrorCountsTable.statusCode, 200),
        ),
      );

    expect(rows).toHaveLength(0);
  });

  it("places the row in the current hour bucket", async () => {
    await request(app)
      .post("/api/telemetry/launch")
      .send({ clerkStatus: "loaded" }); // → 400

    const expectedBucket = toHourBucket(new Date());

    const found = await pollUntil(async () => {
      const rows = await db
        .select()
        .from(apiErrorCountsTable)
        .where(eq(apiErrorCountsTable.endpoint, "/api/telemetry/launch"));
      return rows.some(
        (r) =>
          r.statusCode === 400 &&
          new Date(r.windowStart).getTime() === expectedBucket.getTime(),
      );
    });

    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — GET /api/admin/error-rates
// ---------------------------------------------------------------------------

describe("GET /api/admin/error-rates", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/admin/error-rates");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token is wrong", async () => {
    const res = await request(app)
      .get("/api/admin/error-rates")
      .set("X-Admin-Token", "totally-wrong-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 with errorRates array and count when token is correct", async () => {
    if (!ADMIN_TOKEN) return;

    const res = await request(app)
      .get("/api/admin/error-rates")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("errorRates");
    expect(res.body).toHaveProperty("count");
    expect(Array.isArray(res.body.errorRates)).toBe(true);
    expect(typeof res.body.count).toBe("number");
  });

  it("includes rows inserted in the last 24 hours", async () => {
    if (!ADMIN_TOKEN) return;

    // Seed a row with windowStart = now (within the 24h window).
    const recentBucket = toHourBucket(new Date());
    await db
      .insert(apiErrorCountsTable)
      .values({
        endpoint: "/api/telemetry/launch",
        statusCode: 500,
        windowStart: recentBucket,
        count: 7,
      })
      .onConflictDoNothing();

    const res = await request(app)
      .get("/api/admin/error-rates")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const rows: Array<{ endpoint: string; statusCode: number; count: number }> =
      res.body.errorRates;
    const found = rows.some(
      (r) =>
        r.endpoint === "/api/telemetry/launch" &&
        r.statusCode === 500 &&
        r.count === 7,
    );
    expect(found).toBe(true);
  });

  it("excludes rows older than 24 hours", async () => {
    if (!ADMIN_TOKEN) return;

    // Seed a row with windowStart > 24h ago.
    const oldBucket = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db
      .insert(apiErrorCountsTable)
      .values({
        endpoint: "/api/telemetry/launch",
        statusCode: 503,
        windowStart: oldBucket,
        count: 99,
      })
      .onConflictDoNothing();

    const res = await request(app)
      .get("/api/admin/error-rates")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const rows: Array<{ endpoint: string; statusCode: number; count: number }> =
      res.body.errorRates;

    // The old row must not appear.
    const found = rows.some(
      (r) =>
        r.endpoint === "/api/telemetry/launch" &&
        r.statusCode === 503 &&
        r.count === 99,
    );
    expect(found).toBe(false);
  });
});
