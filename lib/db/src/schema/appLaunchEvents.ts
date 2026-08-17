import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * One row per app session. Written by the mobile app immediately after Clerk
 * initialises (or times out) so we can diagnose launch failures without
 * shipping a new build.
 *
 * session_id is a client-generated UUID — it has no relation to user identity
 * and is not linked to clerk_user_id, making this table safe to query without
 * PII concerns.
 */
export const appLaunchEventsTable = pgTable(
  "app_launch_events",
  {
    id: serial("id").primaryKey(),
    /** Client-generated UUID — one per app session. */
    sessionId: text("session_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** EAS build number baked into the binary (e.g. "18"). */
    buildNumber: text("build_number"),
    /** Semantic app version (e.g. "1.0.0"). */
    appVersion: text("app_version"),
    /** "ios" | "android" */
    platform: text("platform"),
    /**
     * "loaded"     — Clerk initialised successfully.
     * "timed_out"  — ClerkLoaded never fired within 12 s; almost always a
     *               proxy/network issue.
     */
    clerkStatus: text("clerk_status").notNull(),
    /** Milliseconds from JS runtime start to Clerk being ready (or timeout). */
    msToClerk: integer("ms_to_clerk"),
    /** First expo-router segment path the user reached, e.g. "(tabs)". */
    firstScreen: text("first_screen"),
    /** Short code for any startup error captured before Clerk loaded. */
    errorCode: text("error_code"),
    /**
     * Whether GET /api/ping returned 200 within 5 s of JS runtime start.
     * null = ping not attempted (older client builds).
     */
    apiReachable: boolean("api_reachable"),
    /** Round-trip time of the ping in milliseconds, or 0 on timeout/error. */
    apiPingMs: integer("api_ping_ms"),
    /**
     * The EXPO_PUBLIC_DOMAIN value baked into this binary at build time.
     * Null on older clients that don't send this field.
     * Lets us immediately catch wrong-domain builds from the server side.
     */
    bakedDomain: text("baked_domain"),
    /**
     * The EXPO_PUBLIC_CLERK_PROXY_URL value baked into this binary at build time.
     */
    bakedProxyUrl: text("baked_proxy_url"),
    /**
     * Whether the Clerk proxy URL responded to a /v1/client probe within 5 s
     * of JS runtime start. null = not probed (older client).
     */
    proxyReachable: boolean("proxy_reachable"),
    /** Round-trip time of the proxy probe in milliseconds. */
    proxyPingMs: integer("proxy_ping_ms"),
  },
  (t) => [
    index("app_launch_events_created_at_idx").on(t.createdAt),
    index("app_launch_events_build_idx").on(t.buildNumber),
  ],
);

export type AppLaunchEvent = typeof appLaunchEventsTable.$inferSelect;
export type InsertAppLaunchEvent = typeof appLaunchEventsTable.$inferInsert;
