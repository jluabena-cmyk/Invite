import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { userProfilesTable } from "./userProfiles";

export const eventVenueSuggestionsTable = pgTable(
  "event_venue_suggestions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    proposerUserId: integer("proposer_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    placeId: text("place_id").notNull(),
    placeName: text("place_name").notNull(),
    placeAddress: text("place_address"),
    placeLat: real("place_lat"),
    placeLng: real("place_lng"),
    rating: real("rating"),
    photoUrl: text("photo_url"),
    rescinded: boolean("rescinded").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_venue_suggestions_event_id_idx").on(table.eventId),
    index("event_venue_suggestions_proposer_idx").on(table.proposerUserId),
  ],
);

export type EventVenueSuggestion = typeof eventVenueSuggestionsTable.$inferSelect;
export type InsertEventVenueSuggestion = typeof eventVenueSuggestionsTable.$inferInsert;
