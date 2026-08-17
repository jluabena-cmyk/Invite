---
name: TestFlight crash root cause analysis
description: Why Build 3 crashed on iOS 26, the secondary crash vector (Sentry DSN), and fixes applied.
---

# TestFlight Crash — Root Cause & Fixes

## Primary crash (Build 3, SDK 54 on iOS 26)
Expo SDK 54 had native incompatibilities with iOS 26 / Clang 19:
- `fmt` library `consteval` → `constexpr` needed for Clang 19 strictness
- `expo-notifications` vs `expo-modules-core 3.0.x` API gap (`Promise.legacyResolver` removed)
- GoogleUtilities modular headers needed for ClerkGoogleSignIn

**Fix applied:** SDK upgrade to 57 (Build 4). The four native patches in `plugins/withPodfileSpmFix.js` cover all of these.

## Secondary crash vector (present in all builds)
`Sentry.init()` ran at JS module level (before React mounts) with NO try/catch. If `EXPO_PUBLIC_SENTRY_DSN` is not set in the shell when `stage-eas-build.sh` runs, it stays as the literal string `"$EXPO_PUBLIC_SENTRY_DSN"` in the baked bundle. Sentry 8.x throws `SentryError: Invalid Sentry Dsn` synchronously — crashing the JS runtime and looking like a native crash.

**Fix applied (Build 5):**
- Added DSN format validation (must start with `https://`, must not start with `$`)
- Wrapped `Sentry.init()` in try/catch
- Added warning log when DSN is absent/invalid so it's visible in crash logs

## Clerk publishable key guard
Empty/unexpanded `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` causes `ClerkProvider` to throw synchronously. Added a console.warn when the key is missing/unexpanded so the failure is immediately identifiable.

**Why:** Both Sentry and Clerk perform synchronous validation at module/provider init time — any throw before React mounts becomes an invisible crash with no JS stack trace in device logs.

## Build numbers
- Build 3: SDK 54, crashed on iOS 26 (native)
- Build 4: SDK 57 upgrade applied, Sentry/Clerk guards NOT yet in place
- Build 5: Sentry/Clerk guards added (`app.config.js` buildNumber bumped to "5")
