import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { receiptsTable } from "./receipts";
import { userProfilesTable } from "./userProfiles";

export const paymentRequestsTable = pgTable(
  "payment_requests",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    receiptId: integer("receipt_id")
      .notNull()
      .references(() => receiptsTable.id, { onDelete: "cascade" }),
    hostUserId: integer("host_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    guestUserId: integer("guest_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    status: text("status").notNull().default("requested"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("payment_requests_receipt_guest_uniq").on(
      table.receiptId,
      table.guestUserId,
    ),
    index("payment_requests_event_id_idx").on(table.eventId),
  ],
);

export type PaymentRequest = typeof paymentRequestsTable.$inferSelect;
export type InsertPaymentRequest = typeof paymentRequestsTable.$inferInsert;
