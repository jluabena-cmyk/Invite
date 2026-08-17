---
name: Project conventions
description: Critical reminders that are easy to forget — codegen, framework versions, DB patterns, column names.
---

- `lib/api-spec/openapi.yaml` is PARTIAL — NEVER run codegen. Manually edit `lib/api-client-react/src/generated/api.ts` and `api.schemas.ts` directly.
- Framework is **Express 5** (not 4) — handles async natively; `express-async-errors` is incompatible and must not be used.
- DB schema changes: use direct SQL via `executeSql()` in code_execution sandbox — `drizzle-kit push` is interactive and can't be used.
- The `events` table uses `owner_user_id` (not `created_by_user_id`).
- Deep link scheme: `invite://join/${code}`. Join screen at `app/join/[code].tsx`.
- `colors.ts` is light-mode only. Primary color is `#6366f1` (indigo).
- App slug: `invite`, scheme: `invite`.
