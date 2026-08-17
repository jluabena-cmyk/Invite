import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const savedGuestsTable = pgTable(
  "saved_guests",
  {
    id: serial("id").primaryKey(),
    hostUserId: integer("host_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    cashAppHandle: text("cash_app_handle"),
    venmoHandle: text("venmo_handle"),
    phoneNumber: text("phone_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("saved_guests_host_user_id_idx").on(table.hostUserId),
  ],
);

export type SavedGuest = typeof savedGuestsTable.$inferSelect;
export type InsertSavedGuest = typeof savedGuestsTable.$inferInsert;
