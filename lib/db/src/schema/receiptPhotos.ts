import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { receiptsTable } from "./receipts";
import { userProfilesTable } from "./userProfiles";

export const receiptPhotosTable = pgTable(
  "receipt_photos",
  {
    id: serial("id").primaryKey(),
    receiptId: integer("receipt_id")
      .notNull()
      .references(() => receiptsTable.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "restrict" }),
    objectPath: text("object_path").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    scannedAt: timestamp("scanned_at"),
    scanLockedAt: timestamp("scan_locked_at"),
  },
  (table) => [index("receipt_photos_receipt_id_idx").on(table.receiptId)],
);

export type ReceiptPhoto = typeof receiptPhotosTable.$inferSelect;
export type InsertReceiptPhoto = typeof receiptPhotosTable.$inferInsert;
