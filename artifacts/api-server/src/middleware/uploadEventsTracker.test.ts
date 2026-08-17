/**
 * Tests for pruneOldUploadEvents()
 *
 * Inserts rows with created_at older than 30 days and rows within the window,
 * calls the prune function, then asserts only the recent rows remain.
 *
 * Mirrors the pattern used by errorRates.test.ts for pruneOldErrorCounts().
 */

import { describe, it, expect, afterEach } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { db, uploadEventsTable } from "@workspace/db";
import { pruneOldUploadEvents } from "./uploadEventsTracker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** IDs inserted by the current test — cleaned up in afterEach even on failure. */
const insertedIds: number[] = [];

afterEach(async () => {
  if (insertedIds.length) {
    await db
      .delete(uploadEventsTable)
      .where(inArray(uploadEventsTable.id, [...insertedIds]));
    insertedIds.length = 0;
  }
});

/**
 * Insert a row with the default created_at (now) and register it for cleanup.
 * Returns the inserted row.
 */
async function insertRow(
  overrides: { type?: string; outcome?: string } = {},
) {
  const [row] = await db
    .insert(uploadEventsTable)
    .values({ type: overrides.type ?? "gallery", outcome: overrides.outcome ?? "success" })
    .returning();
  insertedIds.push(row.id);
  return row;
}

/**
 * Back-date the created_at of a row to `daysAgo` days in the past using
 * raw SQL (Drizzle's typed layer does not expose interval arithmetic).
 */
async function backdateRow(id: number, daysAgo: number): Promise<void> {
  await db.execute(
    sql`UPDATE upload_events SET created_at = NOW() - (${daysAgo} * INTERVAL '1 day') WHERE id = ${id}`,
  );
}

// ---------------------------------------------------------------------------
// Unit tests — pruneOldUploadEvents()
// ---------------------------------------------------------------------------

describe("pruneOldUploadEvents()", () => {
  it("deletes rows whose created_at is older than 30 days", async () => {
    const old = await insertRow({ type: "gallery", outcome: "auth_fail" });
    await backdateRow(old.id, 31); // 31 days ago — must be pruned

    await pruneOldUploadEvents();

    const remaining = await db
      .select()
      .from(uploadEventsTable)
      .where(sql`id = ${old.id}`);

    // Row was pruned — remove from cleanup list so afterEach doesn't error.
    const idx = insertedIds.indexOf(old.id);
    if (idx !== -1) insertedIds.splice(idx, 1);

    expect(remaining).toHaveLength(0);
  });

  it("preserves rows whose created_at is within the last 30 days", async () => {
    const recent = await insertRow({ type: "receipt", outcome: "success" });
    await backdateRow(recent.id, 29); // 29 days ago — must survive

    await pruneOldUploadEvents();

    const remaining = await db
      .select()
      .from(uploadEventsTable)
      .where(sql`id = ${recent.id}`);

    expect(remaining).toHaveLength(1);
  });

  it("deletes only old rows when both old and recent rows exist", async () => {
    const old1 = await insertRow({ type: "gallery", outcome: "signing_fail" });
    const old2 = await insertRow({ type: "receipt", outcome: "storage_fail" });
    const recent1 = await insertRow({ type: "gallery", outcome: "success" });
    const recent2 = await insertRow({ type: "receipt", outcome: "mime_rejected" });

    await backdateRow(old1.id, 31);
    await backdateRow(old2.id, 45);
    await backdateRow(recent1.id, 1);
    await backdateRow(recent2.id, 15);

    await pruneOldUploadEvents();

    // Remove old IDs from cleanup list (already deleted by prune).
    for (const id of [old1.id, old2.id]) {
      const idx = insertedIds.indexOf(id);
      if (idx !== -1) insertedIds.splice(idx, 1);
    }

    // Old rows must be gone.
    const oldRows = await db
      .select()
      .from(uploadEventsTable)
      .where(inArray(uploadEventsTable.id, [old1.id, old2.id]));
    expect(oldRows).toHaveLength(0);

    // Recent rows must still be present.
    const recentRows = await db
      .select()
      .from(uploadEventsTable)
      .where(inArray(uploadEventsTable.id, [recent1.id, recent2.id]));
    expect(recentRows).toHaveLength(2);
  });

  it("is a no-op (does not throw) when there are no rows to prune", async () => {
    // Ensure the table has no rows older than 30 days that belong to this test.
    // Just call prune against the live (test) table — it must not throw.
    await expect(pruneOldUploadEvents()).resolves.toBeUndefined();
  });
});
