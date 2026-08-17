import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { eventVenueSuggestionsTable } from "./eventVenueSuggestions";
import { userProfilesTable } from "./userProfiles";

export const eventVenueVotesTable = pgTable(
  "event_venue_votes",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    suggestionId: integer("suggestion_id")
      .notNull()
      .references(() => eventVenueSuggestionsTable.id, { onDelete: "cascade" }),
    voterUserId: integer("voter_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("event_venue_votes_event_voter_unique").on(
      table.eventId,
      table.voterUserId,
    ),
    unique("event_venue_votes_suggestion_voter_unique").on(
      table.suggestionId,
      table.voterUserId,
    ),
    index("event_venue_votes_event_id_idx").on(table.eventId),
    index("event_venue_votes_suggestion_id_idx").on(table.suggestionId),
    index("event_venue_votes_voter_user_id_idx").on(table.voterUserId),
  ],
);

export type EventVenueVote = typeof eventVenueVotesTable.$inferSelect;
export type InsertEventVenueVote = typeof eventVenueVotesTable.$inferInsert;
