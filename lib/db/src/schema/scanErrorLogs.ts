import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const scanErrorLogsTable = pgTable("scan_error_logs", {
  id: serial("id").primaryKey(),
  errorType: text("error_type").notNull(),
  eventId: integer("event_id").notNull(),
  photoId: integer("photo_id").notNull(),
  userId: integer("user_id").notNull(),
  detail: text("detail"),
  enhancementVariant: text("enhancement_variant"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  /**
   * Lifecycle status of this log row.
   *   "final"     — the error is conclusive and should be counted in summaries.
   *   "transient" — the row was written speculatively (e.g. during a retry or an
   *                 interrupted job) and must NOT be counted until it is promoted.
   *
   * All existing rows and all new insertions default to "final" so that the
   * change is backwards-compatible and no callers need updating unless they
   * explicitly want to create a transient row.
   */
  status: text("status").notNull().default("final"),
});

export type ScanErrorLog = typeof scanErrorLogsTable.$inferSelect;
export type NewScanErrorLog = typeof scanErrorLogsTable.$inferInsert;
