/**
 * uploadEventsTracker helpers
 *
 * Provides a pruning function for the upload_events table so rows don't
 * accumulate forever. Mirrors the pattern used by errorRateTracker.ts.
 */

import { lt } from "drizzle-orm";
import { db, uploadEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Delete upload_events rows whose createdAt is older than 30 days.
 * Exported so callers can schedule it independently (e.g. daily setInterval).
 */
export async function pruneOldUploadEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(uploadEventsTable)
    .where(lt(uploadEventsTable.createdAt, cutoff));
  logger.info(
    { cutoff },
    "[upload-events-tracker] Pruned upload_events rows older than 30 days",
  );
}
