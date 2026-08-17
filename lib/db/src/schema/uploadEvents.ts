import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-attempt upload telemetry for the presigned photo upload flow.
 *
 * Logged fire-and-forget by the upload-url and confirm endpoints.
 * type    = "receipt" | "gallery"
 * outcome = "success" | "auth_fail" | "rate_limited" | "mime_rejected"
 *           | "storage_fail" | "signing_fail"
 *
 * Used by GET /api/admin/upload-stats to power the Upload Health dashboard.
 */
export const uploadEventsTable = pgTable("upload_events", {
  id:          serial("id").primaryKey(),
  /** Which upload flow produced this event. */
  type:        text("type").notNull(),
  /** What happened — "success" or the first failure phase that terminated the request. */
  outcome:     text("outcome").notNull(),
  /** App build number from the x-app-build request header. Nullable for events logged before this column was added. */
  buildNumber: text("build_number"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UploadEvent = typeof uploadEventsTable.$inferSelect;
