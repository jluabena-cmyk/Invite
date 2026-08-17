---
name: Build 24 pending
description: Changes coded in Replit but not yet shipped in a TestFlight build; what to do next session.
---

## What's coded but not yet built

### index.tsx + event/[id].tsx — chat unread badges and push notifications
- `GET /api/events` now returns `unreadChatCount` per event (messages since `chatLastReadAt`)
- New `POST /api/events/:id/chat/read` endpoint marks the user's last read timestamp
- `POST /api/events/:id/chat` now pushes "[Sender]: [preview]" to all other participants
- `lib/db/src/schema/eventParticipants.ts`: added `chatLastReadAt` column; handled via startup migration in `src/lib/dbMigrations.ts` (runs `ADD COLUMN IF NOT EXISTS` before server accepts traffic — no manual step needed)
- Home screen event card shows `💬 N` red badge when `unreadChatCount > 0`
- Switching to Chat tab in event detail calls `useMarkChatRead` to clear the badge

### event/[id].tsx — venue suggestion search
- Replaced the "Add venue manually" form with a Google Places typeahead input (same search API as event creation)
- Debounced 300ms, shows name + address results, clears on selection, calls existing `handleAddSuggestion`
- "Can't find it? Add manually" still available as a fallback link

### profile.tsx — phone number UX redesign
- When a number is saved: shows "✓ Number saved" row with Change / Remove buttons (no empty input box)
- Tapping Change: reveals input with Cancel option; clears and returns to saved state on cancel
- On save success: calls `queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })` so the home screen "Add your phone number" banner auto-dismisses immediately
- New imports added: `useQueryClient` from `@tanstack/react-query`, `getGetCurrentUserQueryKey` from `@workspace/api-client-react`
- New state: `editingPhone: boolean`

### _layout.tsx — ClerkLoading wrapper fix
- `timedOut` error view now wrapped in `<ClerkLoading>` so it disappears once Clerk finishes loading
- Without this, the "Connection issue" banner pinned to top of every screen even after sign-in

### app.config.js
- `buildNumber` is at "25" — next build must use this

## GitHub sync — current flow (Task 470)

Before building on Mac, ensure build8-sync is current by running on Replit:

```
bash artifacts/bill-splitter/scripts/push-to-github.sh
```

- Uses the **Replit GitHub integration** (no token needed — already connected with repo write access)
- Delegates to `artifacts/bill-splitter/scripts/push-to-github.js` (Node.js, requires `@replit/connectors-sdk` — installed in monorepo root)
- Accepts `--dry-run` to preview without pushing; `--force` to skip divergence guard
- Exits 0 immediately if already in sync

**On Mac** (from `~/Downloads/owmo-build 2/artifacts/bill-splitter`):
1. `bash scripts/sync-from-replit.sh`       # pulls build8-sync; prints "Already up to date" if nothing changed
2. `SKIP_SENTRY_CHECK=1 bash scripts/stage-eas-build.sh`
3. `ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh`

## Other known issues (not blocking)

- `PRODUCTION_DOMAIN` secret in Replit still = `owmo-9bwgw.replit.app` (old domain). Not an EXPO_PUBLIC_ var so not in JS bundle, but should be updated to `invite-9bwgw.replit.app`.

**Why:** The stage dir is a point-in-time snapshot; stage-eas-build.sh only re-copies withPodfileSpmFix.js and itself, not app source files.
