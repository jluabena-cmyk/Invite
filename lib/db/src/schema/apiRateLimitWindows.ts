import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const apiRateLimitWindowsTable = pgTable(
  "api_rate_limit_windows",
  {
    id: serial("id").primaryKey(),
    limitKey: text("limit_key").notNull(),
    windowStart: timestamp("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [
    unique("api_rate_limit_windows_key_window_uniq").on(table.limitKey, table.windowStart),
  ],
);

export type ApiRateLimitWindow = typeof apiRateLimitWindowsTable.$inferSelect;
