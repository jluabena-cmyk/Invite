import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { eventsTable } from "./events";
import { userProfilesTable } from "./userProfiles";
import { savedGuestsTable } from "./savedGuests";

export const eventParticipantsTable = pgTable(
  "event_participants",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    guestName: text("guest_name"),
    role: text("role").notNull().default("participant"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    cancelledAcknowledgedAt: timestamp("cancelled_acknowledged_at"),
    notificationsMuted: boolean("notifications_muted").notNull().default(false),
    savedGuestId: integer("saved_guest_id")
      .references(() => savedGuestsTable.id, { onDelete: "set null" }),
    cashAppHandle: text("cash_app_handle"),
    venmoHandle: text("venmo_handle"),
    chatLastReadAt: timestamp("chat_last_read_at"),
    reminderSentAt: timestamp("reminder_sent_at"),
  },
  (table) => [
    uniqueIndex("event_participants_event_user_unique")
      .on(table.eventId, table.userId)
      .where(isNotNull(table.userId)),
    index("event_participants_event_id_idx").on(table.eventId),
    index("event_participants_user_id_idx").on(table.userId),
  ],
);

export type EventParticipant = typeof eventParticipantsTable.$inferSelect;
export type InsertEventParticipant =
  typeof eventParticipantsTable.$inferInsert;
