import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Idempotent column-level migrations that run before the server accepts traffic.
 * Each statement uses IF NOT EXISTS / IF EXISTS guards so they are safe to replay
 * on every startup (no migration version table required).
 */
const MIGRATIONS = [
  {
    name: "add_event_participants.chat_last_read_at",
    sql: sql`ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS chat_last_read_at TIMESTAMP`,
  },
  {
    name: "create_upload_events",
    sql: sql`
      CREATE TABLE IF NOT EXISTS upload_events (
        id         SERIAL PRIMARY KEY,
        type       TEXT        NOT NULL,
        outcome    TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
  {
    name: "create_upload_events.idx_created_at",
    sql: sql`
      CREATE INDEX IF NOT EXISTS upload_events_created_at_idx
      ON upload_events (created_at DESC)
    `,
  },
  {
    name: "add_upload_events.build_number",
    sql: sql`ALTER TABLE upload_events ADD COLUMN IF NOT EXISTS build_number TEXT`,
  },
  {
    name: "add_event_participants.reminder_sent_at",
    sql: sql`ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP`,
  },
  {
    name: "add_user_profiles.phone_number",
    sql: sql`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone_number TEXT`,
  },
];

export async function runPendingMigrations(): Promise<void> {
  for (const migration of MIGRATIONS) {
    try {
      await db.execute(migration.sql);
      logger.info({ migration: migration.name }, "[db-migrations] applied");
    } catch (err) {
      logger.error({ err, migration: migration.name }, "[db-migrations] FAILED");
      throw err; // propagate so startup aborts rather than running on a broken schema
    }
  }
}
