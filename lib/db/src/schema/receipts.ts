import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { userProfilesTable } from "./userProfiles";

export const receiptsTable = pgTable(
  "receipts",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
    serviceFee: numeric("service_fee", { precision: 10, scale: 2 }),
    tax: numeric("tax", { precision: 10, scale: 2 }),
    tip: numeric("tip", { precision: 10, scale: 2 }),
    total: numeric("total", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("receipts_event_id_idx").on(table.eventId)],
);

export type Receipt = typeof receiptsTable.$inferSelect;
export type InsertReceipt = typeof receiptsTable.$inferInsert;
