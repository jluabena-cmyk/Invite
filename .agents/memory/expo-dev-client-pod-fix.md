---
name: expo-dev-client pod install fix
description: expo-updates' pod install script unconditionally require()s expo-dev-client/package.json — absence causes MODULE_NOT_FOUND crash before xcodebuild starts.
---

## Rule
`expo-dev-client` must be in `package.json` devDependencies AND in the EAS worker's `npm ci` lockfile for local iOS builds to succeed. 

**Why:** A late-2026 EAS CLI update changed `expo-updates`' pod install script to unconditionally `require.resolve('expo-dev-client/package.json')`. Previously it was wrapped in a try/catch. Without the package, the entire pod install crashes with MODULE_NOT_FOUND before xcodebuild even runs. This broke Build 29 after Build 28 had succeeded without it.

**Compatible version for Expo 57:** `57.0.10` (matches `expo-updates`' optionalDependencies entry).

**How to apply:**
- `expo-dev-client` is now in `artifacts/bill-splitter/package.json` devDependencies (`~57.0.10`).
- `stage-eas-build.sh` also auto-injects it into the staged `package.json` before lockfile generation as a belt-and-suspenders guard (in case it gets removed from package.json again).
- If a future build gets MODULE_NOT_FOUND for expo-dev-client, check both the package.json entry and the stage script injection block.
