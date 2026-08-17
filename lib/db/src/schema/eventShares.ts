import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";

export const eventSharesTable = pgTable(
  "event_shares",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    joinCode: text("join_code").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_shares_join_code_idx").on(table.joinCode),
    index("event_shares_event_id_idx").on(table.eventId),
  ],
);

export type EventShare = typeof eventSharesTable.$inferSelect;
export type InsertEventShare = typeof eventSharesTable.$inferInsert;
