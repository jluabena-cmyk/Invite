import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { receiptItemsTable } from "./receiptItems";
import { userProfilesTable } from "./userProfiles";
import { eventParticipantsTable } from "./eventParticipants";

export const itemAssignmentsTable = pgTable(
  "item_assignments",
  {
    id: serial("id").primaryKey(),
    receiptItemId: integer("receipt_item_id")
      .notNull()
      .references(() => receiptItemsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    guestParticipantId: integer("guest_participant_id")
      .references(() => eventParticipantsTable.id, { onDelete: "cascade" }),
    claimed: boolean("claimed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("item_assignments_item_user_unique")
      .on(table.receiptItemId, table.userId)
      .where(isNotNull(table.userId)),
    uniqueIndex("item_assignments_item_guest_unique")
      .on(table.receiptItemId, table.guestParticipantId)
      .where(isNotNull(table.guestParticipantId)),
    index("item_assignments_receipt_item_id_idx").on(table.receiptItemId),
    index("item_assignments_user_id_idx").on(table.userId),
    index("item_assignments_guest_participant_id_idx").on(table.guestParticipantId),
  ],
);

export type ItemAssignment = typeof itemAssignmentsTable.$inferSelect;
export type InsertItemAssignment = typeof itemAssignmentsTable.$inferInsert;
