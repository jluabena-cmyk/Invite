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

export const eventPhotosTable = pgTable(
  "event_photos",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    objectPath: text("object_path").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("event_photos_event_id_idx").on(table.eventId)],
);

export type EventPhoto = typeof eventPhotosTable.$inferSelect;
export type InsertEventPhoto = typeof eventPhotosTable.$inferInsert;
