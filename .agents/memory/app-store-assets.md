---
name: App Store assets for Owmo
description: Where to find App Store screenshots, metadata, and submission checklist for Owmo
---

## Screenshots
5 mockup components in `artifacts/mockup-sandbox/src/components/mockups/`:
- `Screenshot1.tsx` — Hero "Split bills, not friendships" (dark navy, onboarding-style)
- `Screenshot2.tsx` — Events list / home screen
- `Screenshot3.tsx` — Restaurant picker with ratings
- `Screenshot4.tsx` — Bill splitting / receipt line items
- `Screenshot5.tsx` — Balances dashboard (owed/owing)

Preview URLs (via Component Preview Server workflow):
`/__mockup/preview/Screenshot1` through `Screenshot5`

JPEG saves at `screenshots/owmo-sc1-hero.jpg` … `owmo-sc5-balances.jpg` (390×844 preview quality).

**For App Store submission:** screenshots need 1290×2796 px (6.7" iPhone). Render each component at that exact viewport size, or take from a real iPhone 16 Pro Max / simulator.

## App Store Metadata
Full copy (name, subtitle, description, keywords, what's new, age rating, checklist) at `.local/app-store-metadata.md`.

## Still Needed from User
- `ASC_APP_ID` — numeric Apple ID from App Store Connect → App Information
- RevenueCat: attach products to `premium` entitlement; set webhook URL to `https://invite-9bwgw.replit.app/api/webhooks/revenuecat`
- API server redeploy (click Publish button — env vars changed)
- EAS build quota resets Aug 1 2026; run `bash artifacts/bill-splitter/scripts/stage-eas-build.sh` then
