import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { receiptsTable } from "./receipts";

export const receiptItemsTable = pgTable(
  "receipt_items",
  {
    id: serial("id").primaryKey(),
    receiptId: integer("receipt_id")
      .notNull()
      .references(() => receiptsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("receipt_items_receipt_id_idx").on(table.receiptId)],
);

export type ReceiptItem = typeof receiptItemsTable.$inferSelect;
export type InsertReceiptItem = typeof receiptItemsTable.$inferInsert;
