import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { userProfilesTable } from "./userProfiles";

export const eventMessagesTable = pgTable(
  "event_messages",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_messages_event_id_idx").on(table.eventId),
    index("event_messages_event_id_created_at_idx").on(
      table.eventId,
      table.createdAt,
    ),
  ],
);

export type EventMessage = typeof eventMessagesTable.$inferSelect;
export type InsertEventMessage = typeof eventMessagesTable.$inferInsert;
