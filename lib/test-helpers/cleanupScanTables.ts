/**
 * Shared teardown helpers for test suites that touch scan-related tables.
 *
 * Import these into any test file that seeds scan_error_logs or locks
 * receipt_photos via scanLockedAt, then call them from afterAll so that
 * running all test files in sequence leaves the database in the same state
 * as before they ran.
 */

import { db, scanErrorLogsTable, receiptPhotosTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

/**
 * Deletes scan_error_logs rows inserted during a test by their IDs.
 * Mutates the provided array, clearing it after deletion so the same
 * reference can be safely reused across multiple test runs.
 * Safe to call with an empty array.
 */
export async function cleanupScanErrorLogs(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .delete(scanErrorLogsTable)
    .where(inArray(scanErrorLogsTable.id, ids));
  ids.splice(0, ids.length);
}

/**
 * Clears the scanLockedAt column (sets it to null) on receipt_photos rows
 * that were locked during a test, identified by their IDs.
 * Mutates the provided array, clearing it after the update.
 * Safe to call with an empty array.
 */
export async function cleanupScanLocks(photoIds: number[]): Promise<void> {
  if (photoIds.length === 0) return;
  await db
    .update(receiptPhotosTable)
    .set({ scanLockedAt: null })
    .where(inArray(receiptPhotosTable.id, photoIds));
  photoIds.splice(0, photoIds.length);
}
