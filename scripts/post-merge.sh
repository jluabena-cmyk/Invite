#!/bin/bash
set -e

# Only reinstall if lockfile or any package.json changed in the last merge.
# This keeps post-merge fast (<5 s) for merges that don't touch dependencies,
# and still handles the cases that do (eas-cli, security overrides, etc.).
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -qE '(pnpm-lock\.yaml|package\.json)'; then
  echo "Dependency files changed — running pnpm install"
  pnpm install --no-frozen-lockfile
else
  echo "No dependency changes — skipping pnpm install"
fi

# Apply any schema migrations that can't use drizzle-kit push interactively.
# Each statement uses IF NOT EXISTS / IF EXISTS so it is safe to re-run.
psql "$DATABASE_URL" -c "ALTER TABLE receipt_photos ADD COLUMN IF NOT EXISTS scan_locked_at TIMESTAMP;"
psql "$DATABASE_URL" -c "ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false;"
psql "$DATABASE_URL" -c "ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS guest_name TEXT;"
psql "$DATABASE_URL" -c "ALTER TABLE event_participants ALTER COLUMN user_id DROP NOT NULL;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE item_assignments ADD COLUMN IF NOT EXISTS guest_participant_id INTEGER REFERENCES event_participants(id) ON DELETE SET NULL;"

# Rebuild the DB package type declarations so downstream packages see any new tables.
cd lib/db && npx tsc --build && cd ../..

pnpm --filter @workspace/api-server run build
