import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const dataDeletionRequestsTable = pgTable("data_deletion_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type DataDeletionRequest = typeof dataDeletionRequestsTable.$inferSelect;
export type NewDataDeletionRequest = typeof dataDeletionRequestsTable.$inferInsert;
