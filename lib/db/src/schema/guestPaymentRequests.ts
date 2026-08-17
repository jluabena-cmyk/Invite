import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { eventParticipantsTable } from "./eventParticipants";

export const guestPaymentRequestsTable = pgTable(
  "guest_payment_requests",
  {
    id: serial("id").primaryKey(),
    eventParticipantId: integer("event_participant_id")
      .notNull()
      .references(() => eventParticipantsTable.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    requestedAt: timestamp("requested_at"),
    paidAt: timestamp("paid_at"),
    notes: text("notes"),
    summaryToken: text("summary_token"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("guest_payment_requests_participant_id_idx").on(table.eventParticipantId),
    uniqueIndex("guest_payment_requests_summary_token_idx").on(table.summaryToken),
  ],
);

export type GuestPaymentRequest = typeof guestPaymentRequestsTable.$inferSelect;
export type InsertGuestPaymentRequest = typeof guestPaymentRequestsTable.$inferInsert;
