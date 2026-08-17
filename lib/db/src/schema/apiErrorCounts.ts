import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Hourly API error counts per endpoint and HTTP status code.
 *
 * Written by server-side middleware on every 4xx/5xx response.
 * One row per (endpoint, statusCode, windowStart) tuple — the count is
 * incremented atomically via ON CONFLICT DO UPDATE.
 *
 * windowStart is always truncated to the top of the hour so a simple
 * GROUP BY gives per-hour bucketing without client-side post-processing.
 */
export const apiErrorCountsTable = pgTable(
  "api_error_counts",
  {
    /** Express route path, e.g. "/api/events" or "/api/users/match-phones". */
    endpoint:    text("endpoint").notNull(),
    /** HTTP status code, e.g. 400, 422, 500, 503. */
    statusCode:  integer("status_code").notNull(),
    /** Top-of-the-hour UTC timestamp for this bucket. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    /** Number of responses with this (endpoint, statusCode) in this window. */
    count:       integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.endpoint, t.statusCode, t.windowStart] }),
  ],
);

export type ApiErrorCount = typeof apiErrorCountsTable.$inferSelect;
