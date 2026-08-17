---
name: RevenueCat freemium setup
description: RevenueCat project IDs, architecture decisions, and manual steps needed for the invite app's freemium model.
---

# RevenueCat Freemium Setup

## Project IDs
- Project: `proj7d91309c`
- Test Store App: `app42e7bdacff` — key env var: `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- iOS App Store App: `app3403ca79b5` — key env var: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- Entitlement identifier: `premium`, entitlement RC ID: `entladc5ddfb51`
- Offering identifier: `default`, offering RC ID: `ofrngbc456dcf86`
- Package identifiers: `$rc_monthly` (RC ID: `pkge9b433a7240`), `$rc_annual` (RC ID: `pkged03bdd3be0`)

## Product IDs (ASC store identifiers)
The correct ASC product identifiers are `owmo_premium_monthly` and `owmo_premium_annual`.
Old products `invite_premium_monthly` and `invite_premium_yearly` still exist in RC but are NOT attached and should be ignored.
New correct products created via API:
- `owmo_premium_monthly` → RC product ID `prod545800d56a` (app: `app3403ca79b5`)
- `owmo_premium_annual` → RC product ID `prod2011e2aa52` (app: `app3403ca79b5`)

## Architecture Decisions

**User identity:** `RevenueCatSetup` component in `_layout.tsx` calls `Purchases.logIn(clerkUserId)` when signed in and `Purchases.logOut()` when signed out. This ensures webhook events use the Clerk user ID as `app_user_id`, matching the backend lookup in `userProfilesTable`.

**Free event counting:** `hostedEventsSent` only increments on the FIRST successful send per event — detected by comparing `createdAt === updatedAt` on returned rows. Re-sends via `onConflictDoUpdate` do not cost an extra credit.

**Client-side gate:** At 5/5, the Send button turns grey and shows "Upgrade to Send More →" (opens paywall directly). At 4/5, the counter turns amber with "1 remaining" warning. The 402 from the server also triggers the paywall as a fallback.

**Webhook auth:** Fail-closed — if `REVENUECAT_WEBHOOK_AUTH_HEADER` is not set, all webhook calls are rejected. Do not remove this requirement.

**Plan type detection:** Derived from `activeEntitlement.productIdentifier` string matching (`annual`/`yearly`/`year` → annual, else monthly).

## ✅ RevenueCat Dashboard Steps — COMPLETED (Jul 17 2026)
- Bundle ID: `com.owmo.app` ✅ (was already correct)
- In-App Purchase key: uploaded (old key XKFJ37U826 revoked, new key generated & uploaded)
- App Store Connect API key: skipped (optional, not required for purchases)
- Apple Server Notification URL: configured in ASC ✅
- Entitlements: `owmo_premium_monthly` + `owmo_premium_annual` → `premium` entitlement ✅ (were already attached)
- Packages: `$rc_monthly` → `owmo_premium_monthly`, `$rc_annual` → `owmo_premium_annual` ✅ (were already attached)

**Why `/attach` API fails:** The RC V2 API `/attach` sub-endpoints consistently return 404 even with direct calls (not proxy). This appears to be a RC API limitation — all product attachment must be done via dashboard UI.

## DB columns (applied via SQL ALTER TABLE, also in drizzle schema)
- `subscription_status TEXT NOT NULL DEFAULT 'free'`
- `premium_expires_at TIMESTAMPTZ`
- `hosted_events_sent INTEGER NOT NULL DEFAULT 0`
