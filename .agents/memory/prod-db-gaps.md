---
name: Production DB schema gaps
description: Schema columns defined in Drizzle but not pushed to dev/prod DB; how they were fixed and how to avoid repeats.
---

# Production DB schema gaps

## The problem
Drizzle schema files define columns that were never applied to the database via `db:push` (TTY issue prevents interactive push). When the schema has columns the DB lacks, every query selecting those columns crashes with `column "X" does not exist`.

## Columns fixed (cumulative)
- `receipt_photos.scanned_at` — missing from both dev and production
- `api_rate_limit_windows` — entire table was missing
- `events.destination_required` — BOOLEAN NOT NULL DEFAULT TRUE
- `events.voting_opened_at` — TIMESTAMP
- `events.voting_deadline` — TIMESTAMP
- `events.destination_decided_at` — TIMESTAMP
- `event_venue_suggestions` — entire table missing from prod; caused GET /events/:id to 500 for all users
- `event_venue_votes` — entire table missing from prod (depends on event_venue_suggestions)

All added to dev via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Production picks them up on the next Publish.

## How the production fix flows
Dev DB is fixed via raw SQL using `executeSql`. Production DB is fixed automatically when the user republishes — Replit's publish flow diffs dev vs prod and applies the missing columns/tables.

**Why:** drizzle-kit push fails interactively (TTY issue); use `executeSql` for all migrations. Production schema is owned by the Replit publish flow — never run DDL directly against production.

**How to apply:** When a production 500 says "column X does not exist", check `lib/db/src/schema/`, add the column to dev via `executeSql`, then tell the user to republish.

## Cascade failure pattern to watch for
A missing column on `events` causes *both* event-detail 500s AND invitation mutations to fail (the server fetches the event record inside the invite-response handler). So "invite won't clear" + "event detail crashes" = same missing-column root cause.
