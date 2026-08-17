import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const eventsTable = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    restaurantName: text("restaurant_name"),
    destinationAddress: text("destination_address"),
    destinationLat: real("destination_lat"),
    destinationLng: real("destination_lng"),
    destinationPlaceId: text("destination_place_id"),
    isPrivate: boolean("is_private").notNull().default(false),
    destinationRequired: boolean("destination_required").notNull().default(true),
    startsAt: timestamp("starts_at"),
    cancelledAt: timestamp("cancelled_at"),
    votingOpenedAt: timestamp("voting_opened_at"),
    votingDeadline: timestamp("voting_deadline"),
    destinationDecidedAt: timestamp("destination_decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("events_owner_user_id_idx").on(table.ownerUserId)],
);

export type Event = typeof eventsTable.$inferSelect;
export type InsertEvent = typeof eventsTable.$inferInsert;
