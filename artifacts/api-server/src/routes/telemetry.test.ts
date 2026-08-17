import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { db, appLaunchEventsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// Use a fixed deterministic session ID for test isolation.
const TEST_SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEST_SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// Simulate the Math.random()-based UUID fallback shape (still a valid v4 UUID).
const TEST_SESSION_FALLBACK = "cccccccc-cccc-4ccc-9ccc-cccccccccccc";

// Sessions used by the apiReachable / ping-path tests.
const TEST_SESSION_PING_DOWN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TEST_SESSION_PING_UP   = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TEST_SESSION_PING_NONE = "11111111-1111-4111-8111-111111111111";

// Extra sessions used by the summary tests.
const SUMMARY_SESSIONS = [
  "d0000000-0000-4000-8000-000000000001",
  "d0000000-0000-4000-8000-000000000002",
  "d0000000-0000-4000-8000-000000000003",
  "d0000000-0000-4000-8000-000000000004",
  "d0000000-0000-4000-8000-000000000005",
];

const ALL_TEST_SESSIONS = [
  TEST_SESSION_A,
  TEST_SESSION_B,
  TEST_SESSION_FALLBACK,
  TEST_SESSION_PING_DOWN,
  TEST_SESSION_PING_UP,
  TEST_SESSION_PING_NONE,
  ...SUMMARY_SESSIONS,
];

const ADMIN_TOKEN = process.env.TELEMETRY_ADMIN_TOKEN ?? "";

async function cleanup() {
  await db
    .delete(appLaunchEventsTable)
    .where(inArray(appLaunchEventsTable.sessionId, ALL_TEST_SESSIONS));
}

beforeEach(cleanup);
afterEach(cleanup);

describe("POST /api/telemetry/launch", () => {
  it("accepts a valid payload and returns 204", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({
        sessionId: TEST_SESSION_A,
        clerkStatus: "loaded",
        platform: "ios",
        msToClerk: 3200,
        firstScreen: "(tabs)",
        buildNumber: "18",
        appVersion: "1.0.0",
      });
    expect(res.status).toBe(204);
  });

  it("accepts the Math.random() UUID fallback format and returns 204", async () => {
    // Ensures the client-side makeUUID() output always passes server validation.
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({
        sessionId: TEST_SESSION_FALLBACK,
        clerkStatus: "timed_out",
        platform: "ios",
        msToClerk: 12000,
        firstScreen: "clerk_timeout",
      });
    expect(res.status).toBe(204);
  });

  it("accepts a timed_out payload without optional fields", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({ sessionId: TEST_SESSION_B, clerkStatus: "timed_out" });
    expect(res.status).toBe(204);
  });

  it("is idempotent — duplicate sessionId is silently accepted", async () => {
    const payload = { sessionId: TEST_SESSION_A, clerkStatus: "loaded" as const };
    await request(app).post("/api/telemetry/launch").send(payload);
    const res2 = await request(app).post("/api/telemetry/launch").send(payload);
    expect(res2.status).toBe(204);
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({ clerkStatus: "loaded" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when sessionId is not a UUID", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({ sessionId: "not-a-uuid", clerkStatus: "loaded" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when clerkStatus is invalid", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({ sessionId: TEST_SESSION_A, clerkStatus: "unknown" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/telemetry/launch").send({});
    expect(res.status).toBe(400);
  });

  it("accepts apiReachable: false and returns 204 (network-down path)", async () => {
    // Simulates the client posting telemetry after the ping failed at launch.
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({
        sessionId: TEST_SESSION_PING_DOWN,
        clerkStatus: "loaded",
        platform: "ios",
        msToClerk: 2800,
        firstScreen: "(tabs)",
        apiReachable: false,
        apiPingMs: 5001,
      });
    expect(res.status).toBe(204);
  });

  it("accepts apiReachable: true with a measured ping time and returns 204", async () => {
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({
        sessionId: TEST_SESSION_PING_UP,
        clerkStatus: "loaded",
        platform: "android",
        apiReachable: true,
        apiPingMs: 123,
      });
    expect(res.status).toBe(204);
  });

  it("accepts a payload without apiReachable/apiPingMs and returns 204", async () => {
    // Ensures omitting the ping fields (older clients, no-domain build) is still valid.
    const res = await request(app)
      .post("/api/telemetry/launch")
      .send({
        sessionId: TEST_SESSION_PING_NONE,
        clerkStatus: "loaded",
      });
    expect(res.status).toBe(204);
  });
});

describe("GET /api/admin/telemetry", () => {
  it("returns 401 without an admin token", async () => {
    const res = await request(app).get("/api/admin/telemetry");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong token", async () => {
    const res = await request(app)
      .get("/api/admin/telemetry")
      .set("X-Admin-Token", "wrong-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct token and includes inserted rows", async () => {
    // Skip if the admin token is not configured in this environment.
    if (!ADMIN_TOKEN) return;

    await request(app)
      .post("/api/telemetry/launch")
      .send({ sessionId: TEST_SESSION_A, clerkStatus: "loaded", buildNumber: "test" });

    const res = await request(app)
      .get("/api/admin/telemetry")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(res.body).toHaveProperty("count");
    const found = (res.body.events as Array<{ sessionId: string }>)
      .some((e) => e.sessionId === TEST_SESSION_A);
    expect(found).toBe(true);
  });
});

describe("GET /api/admin/telemetry/summary", () => {
  it("returns 401 without an admin token", async () => {
    const res = await request(app).get("/api/admin/telemetry/summary");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong token", async () => {
    const res = await request(app)
      .get("/api/admin/telemetry/summary")
      .set("X-Admin-Token", "wrong-token");
    expect(res.status).toBe(401);
  });

  it("returns a summary array grouped by build number", async () => {
    if (!ADMIN_TOKEN) return;

    // Insert 3 rows for build "42": 2 loaded, 1 timed_out; varied ms_to_clerk and firstScreen.
    await db.insert(appLaunchEventsTable).values([
      {
        sessionId: SUMMARY_SESSIONS[0],
        buildNumber: "42",
        clerkStatus: "loaded",
        msToClerk: 2000,
        firstScreen: "(tabs)",
        platform: "ios",
      },
      {
        sessionId: SUMMARY_SESSIONS[1],
        buildNumber: "42",
        clerkStatus: "loaded",
        msToClerk: 4000,
        firstScreen: "(tabs)",
        platform: "ios",
      },
      {
        sessionId: SUMMARY_SESSIONS[2],
        buildNumber: "42",
        clerkStatus: "timed_out",
        msToClerk: 12000,
        firstScreen: "clerk_timeout",
        platform: "ios",
      },
      // Insert 2 rows for an older build "41".
      {
        sessionId: SUMMARY_SESSIONS[3],
        buildNumber: "41",
        clerkStatus: "loaded",
        msToClerk: 1500,
        firstScreen: "(tabs)",
        platform: "ios",
      },
      {
        sessionId: SUMMARY_SESSIONS[4],
        buildNumber: "41",
        clerkStatus: "timed_out",
        msToClerk: null,
        firstScreen: null,
        platform: "ios",
      },
    ]);

    const res = await request(app)
      .get("/api/admin/telemetry/summary")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");

    const summary: Array<{
      buildNumber: string;
      total: number;
      timedOut: number;
      medianMsToClerk: number | null;
      topScreens: Array<{ screen: string; count: number }>;
    }> = res.body.summary;

    // Build "42" should appear before "41" (descending numeric order).
    const build42 = summary.find((s) => s.buildNumber === "42");
    const build41 = summary.find((s) => s.buildNumber === "41");

    expect(build42).toBeDefined();
    expect(build42!.total).toBe(3);
    expect(build42!.timedOut).toBe(1);
    // Median of [2000, 4000, 12000] = 4000.
    expect(build42!.medianMsToClerk).toBe(4000);
    expect(build42!.topScreens[0].screen).toBe("(tabs)");
    expect(build42!.topScreens[0].count).toBe(2);

    expect(build41).toBeDefined();
    expect(build41!.total).toBe(2);
    expect(build41!.timedOut).toBe(1);
    // Only one row has ms_to_clerk; median = 1500.
    expect(build41!.medianMsToClerk).toBe(1500);

    // Build 42 should come before build 41 in the sorted output.
    const idx42 = summary.findIndex((s) => s.buildNumber === "42");
    const idx41 = summary.findIndex((s) => s.buildNumber === "41");
    expect(idx42).toBeLessThan(idx41);
  });

  it("returns medianMsToClerk as null when no row has ms_to_clerk", async () => {
    if (!ADMIN_TOKEN) return;

    await db.insert(appLaunchEventsTable).values([
      {
        sessionId: SUMMARY_SESSIONS[0],
        buildNumber: "99",
        clerkStatus: "timed_out",
        msToClerk: null,
        platform: "ios",
      },
    ]);

    const res = await request(app)
      .get("/api/admin/telemetry/summary")
      .set("X-Admin-Token", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    const build99 = (
      res.body.summary as Array<{ buildNumber: string; medianMsToClerk: number | null }>
    ).find((s) => s.buildNumber === "99");
    expect(build99).toBeDefined();
    expect(build99!.medianMsToClerk).toBeNull();
  });
});
