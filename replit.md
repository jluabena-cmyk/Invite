# invite

A mobile bill-splitting app for groups. Snap receipts, invite friends, and settle up — all in one place.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/bill-splitter run dev` — run the Expo dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

**WARNING:** `lib/api-spec/openapi.yaml` is intentionally partial. Never run codegen (`pnpm --filter @workspace/api-spec run codegen`). Edit `lib/api-client-react/src/generated/api.ts` and `api.schemas.ts` by hand, then run `cd lib/api-client-react && npx tsc --build`.

## Environment Variables

### API Server (server-side only — never expose to mobile)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Yes | HTTP listen port (throws on startup if missing) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Drizzle ORM) |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk auth middleware |
| `CLERK_SECRET_KEY` | Yes (production) | Clerk FAPI proxy — only used when `NODE_ENV=production` |
| `NODE_ENV` | Yes (production) | Set to `production` to enable Clerk proxy |
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places search + details |
| `PRIVATE_OBJECT_DIR` | Yes | Replit object storage — private upload path |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Yes | Replit object storage — public URL path(s), comma-separated |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Yes | Replit sidecar bucket routing |

### Mobile App (EXPO_PUBLIC_ — baked into bundle, safe to be public)

These must be set as EAS Build env vars in `eas.json` (production profile) before building for TestFlight/App Store. They are **not secrets** — they are visible to end users in the bundle.

| Variable | Dev value (auto-set) | Production value (set after backend deploy) |
|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | `$REPLIT_DEV_DOMAIN` | Deployed backend hostname, e.g. `my-api.replit.app` |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `$CLERK_PUBLISHABLE_KEY` | Production Clerk publishable key |
| `EXPO_PUBLIC_CLERK_PROXY_URL` | _(unset)_ | `https://<backend-domain>/api/__clerk` |

To set for production builds, update the `env` block inside the `production` profile in `artifacts/bill-splitter/eas.json`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, React Native, expo-router
- API: Express 5 (async-native, no express-async-errors)
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (mobile via `@clerk/expo`, server via `@clerk/express`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Object storage: Replit Object Storage (sidecar at `http://127.0.0.1:1106` — intentional)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/bill-splitter/` — Expo mobile app
- `artifacts/api-server/` — Express API server
- `artifacts/bill-splitter/app.json` — Expo config (bundle ID, permissions, plugins)
- `artifacts/bill-splitter/eas.json` — EAS Build profiles (fill in production env vars after backend deploy)
- `lib/db/` — Drizzle schema + migrations
- `lib/api-zod/` — Zod schemas shared between client and server
- `lib/api-client-react/src/generated/` — Hand-maintained API client (do not codegen)

## Architecture decisions

- **CORS `origin: true`** — open CORS is intentional. The mobile app uses Bearer token auth; there is no cookie-based auth and no CSRF risk across origins.
- **Clerk proxy via API server** — `GET|POST /api/__clerk` proxies to `https://frontend-api.clerk.dev` using `http-proxy-middleware`. Only active when `NODE_ENV=production` and `CLERK_SECRET_KEY` is set.
- **Object storage sidecar** — `http://127.0.0.1:1106` is the Replit-managed GCS credential sidecar. Do not change this URL.
- **React Compiler enabled** — state must be declared before usage in dependency arrays (compiler enforces this).
- **Express 5** — handles async route errors natively. Do not add `express-async-errors`.

## Gotchas

- Never run `pnpm --filter @workspace/api-spec run codegen` — the OpenAPI spec is partial. Edit the generated files by hand.
- After any manual edit to `lib/api-client-react/src/generated/`, run `cd lib/api-client-react && npx tsc --build`.
- `join/[code].tsx` constructs its own base URL from `EXPO_PUBLIC_DOMAIN` (does not call `getBaseUrl()`). This is consistent in practice since both read the same env var, but be aware of the duplication.
- `expo-router` origin is set to `"https://replit.com/"` in dev. Update to the deployed backend URL in `app.json` plugins before App Store submission.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
