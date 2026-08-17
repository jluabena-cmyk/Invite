---
name: Pending before launch
description: Items still needed before the app goes live on the App Store.
---

# Pending Before Launch

## ⚠️ Agreements, Tax, and Banking
Go to App Store Connect → **Agreements, Tax, and Banking** → sign the **Paid Apps Agreement** and fill in bank account + tax info.
**Why:** Without this, in-app purchases (premium subscriptions) won't be available to users even after the app is approved. Apple will not process any payments until this is complete.

## Build 28 — Submitted to TestFlight
EAS Build ID: bfaf8d28-ff17-4037-a83d-6159882572d4
Signed with: "iPhone Distribution: Jeremy luabena (FNBGUZQ4T3)"
Provisioning profile: [expo] com.owmo.app AppStore

What's in build 28:
- Personalized SMS payment reminders (preferred app only + itemized receipt)
- In-app payment reminder card updated to match single-link format
- OCR draft persists across navigation and force-quit/relaunch
- Raw phone number stored on profiles for direct SMS
- Profile phone field pre-populates on Change

Submit command (run from `~/Downloads/owmo-build 2/artifacts/bill-splitter`):
```
ASC_APP_ID=6790176677 bash scripts/stage-eas-submit.sh
```
Or:
```
EXPO_TOKEN=8BTF9VjN297Hgeqz8RBMSGJBZeh5t_CYnSpWmWPv eas submit --platform ios --id bfaf8d28-ff17-4037-a83d-6159882572d4
```

## Mac Build Environment — Correct Export Block
All vars must be set in the same terminal session before running stage scripts:
```bash
export EXPO_TOKEN=8BTF9VjN297Hgeqz8RBMSGJBZeh5t_CYnSpWmWPv
export EXPO_APPLE_ID=Jluabena@gmail.com
export APPLE_TEAM_ID=FNBGUZQ4T3
export EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_YktlcfZdrnyoZodYbaFfrlMDwwt
export EXPO_PUBLIC_SENTRY_DSN=https://b037fb78d738957de01259dbacf9b5dd@o4511674534592513.ingest.us.sentry.io/4511674549796864
export APNS_KEY_ID=BL9ZG84KDA
export EXPO_APPLE_APP_SPECIFIC_PASSWORD=edga-gqfx-mbxu-jzgi
export EXPO_PUBLIC_DOMAIN=invite-9bwgw.replit.app
export PRODUCTION_DOMAIN=invite-9bwgw.replit.app
export EXPO_PUBLIC_CLERK_PROXY_URL=https://invite-9bwgw.replit.app/api/__clerk
export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YXBwXzNFSlVFVUlhb2JSWHFtcU00YVdnUHpGeTJPTS5jbGVyay5kZXYk
```
Note: EXPO_PUBLIC_DOMAIN/PRODUCTION_DOMAIN/CLERK_PROXY_URL use `invite-9bwgw.replit.app` — that is the actual live production URL (repl slug is still "invite"). eas.json production profile has owmo- URLs hardcoded but the shell vars must match the live server.

## RevenueCat — App Store Connect API Key (optional)
Nice-to-have for syncing product metadata in the RC dashboard. Not required for purchases to work. Can be added any time post-launch.
