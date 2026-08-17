import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const friendshipsTable = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    addresseeUserId: integer("addressee_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("friendships_requester_addressee_unique").on(
      table.requesterUserId,
      table.addresseeUserId,
    ),
    index("friendships_requester_idx").on(table.requesterUserId),
    index("friendships_addressee_idx").on(table.addresseeUserId),
  ],
);

export type Friendship = typeof friendshipsTable.$inferSelect;
export type InsertFriendship = typeof friendshipsTable.$inferInsert;
