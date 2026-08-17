import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable(
  "user_profiles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    displayName: text("display_name"),
    email: text("email").notNull(),
    handle: text("handle").notNull().unique(),
    avatarObjectPath: text("avatar_object_path"),
    bio: text("bio"),
    cashAppHandle: text("cash_app_handle"),
    venmoHandle: text("venmo_handle"),
    preferredPaymentMethod: text("preferred_payment_method"),
    zelleInfo: text("zelle_info"),
    cashAppVerified: boolean("cash_app_verified").notNull().default(false),
    venmoVerified: boolean("venmo_verified").notNull().default(false),
    phoneNumber: text("phone_number"),
    phoneNumberHash: text("phone_number_hash").unique(),
    subscriptionStatus: text("subscription_status").notNull().default("free"),
    premiumExpiresAt: timestamp("premium_expires_at"),
    hostedEventsSent: integer("hosted_events_sent").notNull().default(0),
    freeEventWarningNotified: boolean("free_event_warning_notified").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_profiles_clerk_user_id_idx").on(table.clerkUserId),
    index("user_profiles_phone_number_hash_idx").on(table.phoneNumberHash),
  ],
);

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
