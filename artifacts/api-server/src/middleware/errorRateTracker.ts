/**
 * errorRateTracker middleware
 *
 * Fires on every 4xx/5xx response and upserts a count row into
 * api_error_counts for the (endpoint, statusCode, windowStart) tuple.
 *
 * Uses res.on("finish") so it never blocks the response path.
 * Errors in the tracker are logged and swallowed — they must not
 * surface to the client.
 */

import { type RequestHandler } from "express";
import { lt, sql } from "drizzle-orm";
import { db, apiErrorCountsTable } from "@workspace/db";
import { logger } from "../lib/logger";

/** Truncate a Date to the top of its UTC hour. Exported for testing. */
export function toHourBucket(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours())
  );
}

/**
 * Delete api_error_counts rows whose windowStart is older than 30 days.
 * Exported so callers can schedule it independently (e.g. daily setInterval).
 */
export async function pruneOldErrorCounts(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(apiErrorCountsTable)
    .where(lt(apiErrorCountsTable.windowStart, cutoff));
  logger.info({ cutoff }, "[error-rate-tracker] Pruned api_error_counts rows older than 30 days");
}

export const errorRateTracker: RequestHandler = (req, res, next) => {
  res.on("finish", () => {
    const code = res.statusCode;
    if (code < 400) return; // only track error responses

    // Use the matched route pattern if available (e.g. "/api/events/:id"),
    // falling back to the raw URL pathname so we always have something.
    const rawPath = req.route?.path as string | undefined;
    const prefix = (req.baseUrl ?? "") as string;
    const endpoint = rawPath ? `${prefix}${rawPath}` : (req.path ?? req.url ?? "unknown");

    const windowStart = toHourBucket(new Date());

    // Fire-and-forget — deliberately not awaited.
    void db
      .insert(apiErrorCountsTable)
      .values({ endpoint, statusCode: code, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [
          apiErrorCountsTable.endpoint,
          apiErrorCountsTable.statusCode,
          apiErrorCountsTable.windowStart,
        ],
        set: { count: sql`${apiErrorCountsTable.count} + 1` },
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "[error-rate-tracker] Failed to upsert error count");
      });
  });

  next();
};
