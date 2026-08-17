import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { db, scanErrorLogsTable } from "@workspace/db";
import { and, gte, lte } from "drizzle-orm";
import { cleanupScanErrorLogs } from "@workspace/test-helpers/cleanupScanTables";

const SECRET = "test-secret-for-scan-summary";

const TEST_WINDOW_START = new Date("2020-01-01T00:00:00.000Z");
const TEST_WINDOW_END = new Date("2020-12-31T23:59:59.999Z");

const SEED_ROWS = [
  { errorType: "timeout",    enhancementVariant: "v1",   count: 3 },
  { errorType: "timeout",    enhancementVariant: "v2",   count: 2 },
  { errorType: "parse_fail", enhancementVariant: "v1",   count: 5 },
  { errorType: "parse_fail", enhancementVariant: null,   count: 1 },
  { errorType: "api_error",  enhancementVariant: "v2",   count: 4 },
];

const TOTAL_ROWS = SEED_ROWS.reduce((s, r) => s + r.count, 0);

let insertedIds: number[] = [];

async function seedRows() {
  // Delete any leftover rows from a previous run that fall inside the test window,
  // so counts never double across consecutive runs.
  await db
    .delete(scanErrorLogsTable)
    .where(
      and(
        gte(scanErrorLogsTable.occurredAt, TEST_WINDOW_START),
        lte(scanErrorLogsTable.occurredAt, TEST_WINDOW_END),
      )
    );

  insertedIds = [];
  for (const spec of SEED_ROWS) {
    for (let i = 0; i < spec.count; i++) {
      const [row] = await db
        .insert(scanErrorLogsTable)
        .values({
          errorType: spec.errorType,
          enhancementVariant: spec.enhancementVariant ?? null,
          eventId: 0,
          photoId: 0,
          userId: 0,
          occurredAt: new Date("2020-06-15T12:00:00.000Z"),
          status: "final",
        })
        .returning({ id: scanErrorLogsTable.id });
      insertedIds.push(row.id);
    }
  }
}

async function cleanupRows() {
  await cleanupScanErrorLogs(insertedIds);
}

function makeRequest() {
  return request(app)
    .get("/api/scan-errors/summary")
    .set("x-internal-secret", SECRET)
    .query({
      since: TEST_WINDOW_START.getTime().toString(),
      until: TEST_WINDOW_END.getTime().toString(),
    });
}

describe("GET /api/scan-errors/summary — byErrorType accuracy", () => {
  const originalSecret = process.env.INTERNAL_API_SECRET;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    await seedRows();
  });

  afterAll(async () => {
    await cleanupRows();
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("returns 403 when the secret header is missing", async () => {
    const res = await request(app)
      .get("/api/scan-errors/summary")
      .query({ since: TEST_WINDOW_START.getTime().toString(), until: TEST_WINDOW_END.getTime().toString() });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the secret header is wrong", async () => {
    const res = await request(app)
      .get("/api/scan-errors/summary")
      .set("x-internal-secret", "wrong-value")
      .query({ since: TEST_WINDOW_START.getTime().toString(), until: TEST_WINDOW_END.getTime().toString() });
    expect(res.status).toBe(403);
  });

  it("returns 200 with the expected top-level shape", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("since");
    expect(res.body).toHaveProperty("until");
    expect(res.body).toHaveProperty("totals");
    expect(res.body).toHaveProperty("byVariant");
    expect(res.body).toHaveProperty("byErrorType");
    expect(res.body).toHaveProperty("byDay");
  });

  it("byErrorType has exactly one entry per unique (errorType, enhancementVariant) pair", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
      res.body.byErrorType;

    const keys = byErrorType.map(
      (r) => `${r.errorType}::${r.enhancementVariant ?? "null"}`
    );
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(keys.length);

    expect(SEED_ROWS.length).toBe(5);
    expect(byErrorType.length).toBeGreaterThanOrEqual(SEED_ROWS.length);
  });

  it("byErrorType counts match seeded data exactly", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
      res.body.byErrorType;

    for (const spec of SEED_ROWS) {
      const match = byErrorType.find(
        (r) =>
          r.errorType === spec.errorType &&
          (r.enhancementVariant ?? null) === (spec.enhancementVariant ?? null)
      );
      expect(
        match,
        `Expected byErrorType entry for errorType="${spec.errorType}" enhancementVariant="${spec.enhancementVariant}"`
      ).toBeDefined();
      expect(Number(match!.count)).toBe(spec.count);
    }
  });

  it("totals counts match the sum of byErrorType counts for each errorType", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const totals: Array<{ errorType: string; count: number }> = res.body.totals;
    const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
      res.body.byErrorType;

    for (const total of totals) {
      const sumFromByErrorType = byErrorType
        .filter((r) => r.errorType === total.errorType)
        .reduce((s, r) => s + Number(r.count), 0);

      expect(
        sumFromByErrorType,
        `totals[errorType="${total.errorType}"].count should equal sum of byErrorType counts`
      ).toBe(Number(total.count));
    }
  });

  it("byVariant counts match the sum of byErrorType counts for each enhancementVariant", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const byVariant: Array<{ enhancementVariant: string | null; count: number }> = res.body.byVariant;
    const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
      res.body.byErrorType;

    for (const variant of byVariant) {
      const sumFromByErrorType = byErrorType
        .filter((r) => (r.enhancementVariant ?? null) === (variant.enhancementVariant ?? null))
        .reduce((s, r) => s + Number(r.count), 0);

      expect(
        sumFromByErrorType,
        `byVariant[enhancementVariant="${variant.enhancementVariant}"].count should equal sum of byErrorType counts`
      ).toBe(Number(variant.count));
    }
  });

  it("grand total of byErrorType equals grand total of totals", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const totals: Array<{ count: number }> = res.body.totals;
    const byErrorType: Array<{ count: number }> = res.body.byErrorType;

    const grandTotalFromTotals = totals.reduce((s, r) => s + Number(r.count), 0);
    const grandTotalFromByErrorType = byErrorType.reduce((s, r) => s + Number(r.count), 0);

    expect(grandTotalFromByErrorType).toBe(grandTotalFromTotals);
  });

  it("grand total of byVariant equals grand total of byErrorType", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const byVariant: Array<{ count: number }> = res.body.byVariant;
    const byErrorType: Array<{ count: number }> = res.body.byErrorType;

    const grandTotalFromByVariant = byVariant.reduce((s, r) => s + Number(r.count), 0);
    const grandTotalFromByErrorType = byErrorType.reduce((s, r) => s + Number(r.count), 0);

    expect(grandTotalFromByVariant).toBe(grandTotalFromByErrorType);
  });

  it("byErrorType counts for seeded rows sum to the expected total", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);

    const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
      res.body.byErrorType;

    const sumOfSeedPairs = SEED_ROWS.reduce((s, spec) => {
      const match = byErrorType.find(
        (r) =>
          r.errorType === spec.errorType &&
          (r.enhancementVariant ?? null) === (spec.enhancementVariant ?? null)
      );
      return s + (match ? Number(match.count) : 0);
    }, 0);

    expect(sumOfSeedPairs).toBe(TOTAL_ROWS);
  });

  it("transient rows are excluded from all summary counts", async () => {
    // Insert a transient row inside the test window and confirm the summary
    // counts do not change — transient rows must be invisible to the endpoint.
    const [transientRow] = await db
      .insert(scanErrorLogsTable)
      .values({
        errorType: "timeout",
        enhancementVariant: "v1",
        eventId: 0,
        photoId: 0,
        userId: 0,
        occurredAt: new Date("2020-06-15T12:00:00.000Z"),
        status: "transient",
      })
      .returning({ id: scanErrorLogsTable.id, status: scanErrorLogsTable.status });
    // Verify the row was actually stored as transient (guards against silent default overrides)
    expect(transientRow.status).toBe("transient");

    try {
      const res = await makeRequest();
      expect(res.status).toBe(200);

      const byErrorType: Array<{ errorType: string; enhancementVariant: string | null; count: number }> =
        res.body.byErrorType;

      // The timeout/v1 count must still equal the originally seeded 3, not 4.
      const timeoutV1 = byErrorType.find(
        (r) => r.errorType === "timeout" && r.enhancementVariant === "v1"
      );
      expect(timeoutV1).toBeDefined();
      expect(Number(timeoutV1!.count)).toBe(3);

      // Grand total must also be unchanged.
      const grandTotal = byErrorType.reduce((s, r) => s + Number(r.count), 0);
      expect(grandTotal).toBe(TOTAL_ROWS);
    } finally {
      // Clean up the transient row regardless of test outcome.
      await cleanupScanErrorLogs([transientRow.id]);
    }
  });
});
