---
name: EAS iOS build
description: How to correctly stage and submit an EAS production build from the Mac, including all known pitfalls.
---

# EAS iOS Build — Mac Workflow

## One-time Mac setup (required once per machine)
The Mac build folder must be a proper git clone so sync-from-replit.sh works:
```bash
cd ~/Downloads/owmo-build\ 2
git init
git remote add origin https://github.com/jluabena-cmyk/Invite
git fetch origin
git reset --hard origin/build8-sync   # or main once GitHub is up to date
```
`git reset --hard` only touches tracked source files — node_modules, env vars untouched.

After any git clone or reset, **always run npm install before building**:
```bash
cd ~/Downloads/owmo-build\ 2/artifacts/bill-splitter
npm install --legacy-peer-deps
```
Without this, node_modules stay at whatever old version was there (e.g. expo@54 when
the code needs expo@57), the build script pins those old versions, and EAS fails.

## Before every build
```bash
cd ~/Downloads/owmo-build\ 2
bash artifacts/bill-splitter/scripts/sync-from-replit.sh   # pull latest from GitHub
bash artifacts/bill-splitter/scripts/stage-eas-build.sh
```

## Pre-flight checks to verify before submitting
- expo, react-native, @clerk/expo, expo-notifications all show "OK" (not DRIFT)
- All 4 source files show "OK" (fresh within 24h)
- EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and EXPO_PUBLIC_CLERK_PROXY_URL both expanded
- Build commit SHA stamped

## Known pitfalls
1. **node_modules version drift**: After git clone/reset, node_modules are stale.
   Always run `npm install --legacy-peer-deps` in artifacts/bill-splitter before building.
   Fix: cd artifacts/bill-splitter && npm install --legacy-peer-deps

2. **sync-from-replit.sh divergent history**: GitHub main branch may have different
   history than the Mac's local branch. Answer N to the pull prompt if the script
   shows "Ahead: N commit(s)" — the Mac already has the right code from the reset.

3. **EAS CLI git warning**: "Failed to get Git root path" is expected — EAS_NO_VCS=1
   handles this. Safe to ignore.

4. **Sentry DSN missing**: App won't crash (guarded in _layout.tsx) but crash reports
   won't arrive. Add EXPO_PUBLIC_SENTRY_DSN to Mac shell env for production builds.

5. **Build script validates CLERK vars**: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and
   EXPO_PUBLIC_CLERK_PROXY_URL are now required (hard error). Must be set in Mac shell.

## Submitting to TestFlight
After EAS shows "Finished" (~15-20 min):
```bash
ASC_APP_ID=6790176677 bash artifacts/bill-splitter/scripts/stage-eas-submit.sh
```
Uses EAS-stored remote API key (GX279W7R8D) — no local ASC credentials needed.

## GitHub branch strategy for jluabena-cmyk/Invite
- `build8-sync` = real code; `main` = orphan "init" commit with no shared history — never pull from main
- `gitPush({})` in CodeExecution pushes to Replit's internal GitHub integration, NOT to jluabena-cmyk/Invite
- To update jluabena-cmyk/Invite use `gitPush({ branch: "build8-sync" })` — fast-forwards the build branch
- Shell `git push origin ...` fails (no credentials stored for that remote)
- `sync-from-replit.sh` defaults to `build8-sync`, fast-forwards only, and STOPS on divergence (never auto hard-resets). It also refuses to pull/reset to any ref missing the app source (orphan-branch guard).
- `build8-sync` carries full monorepo CONTENT via snapshot commits (not Replit's commit history; attached_assets excluded); full recovery procedure: docs/github-build-sync.md
- When gitPush is unavailable, sync build8-sync via GitHub Git Data API snapshot commits (blobs→tree→commit→ref) through the GitHub connection; throttle under 10 RPS. The stage script's push guard accepts content-identical snapshots.
- `artifacts/bill-splitter/package-lock.json` is now COMMITTED (registry-resolved, pinned to native-deps baseline). After clone/reset use `npm ci` — NOT `npm install --legacy-peer-deps`, which resolves newer packages that break native compilation. Regenerate + commit the lockfile whenever package.json deps change.

## Native patch history (withPodfileSpmFix.js)
All 6 patches required for SDK 57 + RN 0.86 + Xcode 26:
1. SPM nil-target crash (ClerkGoogleSignIn target missing at post_install time)
2. fmt consteval→constexpr (Clang 19 / Xcode 26 stricter C++20)
3. `legacyResolver` removed in expo-modules-core 3.x — affects expo-camera, expo-contacts,
   expo-location, expo-image-picker, expo-notifications. Fix: generic scan of all Swift
   files under node_modules/**/ios/**; replace `resolve: promise.legacyResolver,` with
   `resolve: { result in promise.resolve(result) },` (wrapper closure matching
   EXPromiseResolveBlock type). DO NOT use `promise.resolver` — it's Promise.ResolveClosure
   = `(JavaScriptValue)->Void`, incompatible with EXPromiseResolveBlock = `(Optional<Any>)->Void`.
4. Modular headers for GoogleUtilities/RecaptchaInterop (AppCheckCore static deps)
5. RCTScrollView→UIScrollView in RNViewShot.mm (removed in RN 0.76)
6. clerk-ios 1.3.2→1.3.6 in ClerkExpo.podspec — 1.3.2 doesn't compile under Xcode 26.
   Patch runs in JS (pre-pod-install), not in the Ruby post_install block.
   @clerk/expo 4.2.0 uses 1.3.6; we stay on 3.7.8 JS but bump the native dep only.

## CRITICAL: Production domain
The correct production domain is `invite-9bwgw.replit.app` (repl slug = "invite").
`owmo-9bwgw.replit.app` is dead — was set in EXPO_PUBLIC_DOMAIN/EXPO_PUBLIC_CLERK_PROXY_URL for all builds up to and including Build 19, causing 100% Clerk timeout on TestFlight.
Both env vars corrected to `invite-9bwgw.replit.app` on 2026-08-03.
All builds from Build 20 onward use the correct domain.

## Build number history
- Build 5: TestFlight, black screen (null returns, stale Mac code)
- Build 7: splash fix present but fontsTimedOut bug blocked ClerkProvider mounting
- Builds ea70e792, c1fee22f: wasted — expo@54 pinned (node_modules not updated after git reset)
- Builds 8-11: series of Xcode 26 native compile errors fixed one by one (see patch history above)
- Build 12 (e5f7a3da): Full Xcode log verified — only ONE remaining error: ClerkExpo module
  dependency (clerk-ios 1.3.2 incompatible with Xcode 26). All other errors already gone.
  Patch 6 fixes this. Build 12 (Mac quota-exhausted attempt) never ran.
- Build 13 (1b83671b): Same ClerkExpo error as build 12. TRUE root cause: deploymentTarget was
  "16.4" but ClerkExpo.podspec says `s.platforms = { :ios => '17.0' }`. CocoaPods silently drops
  pods whose min iOS > project target — ClerkExpo never compiled, no .swiftmodule produced.
  Confirmed: ClerkExpo absent from Xcode's 185-target dep graph entirely. Patch 6 (clerk-ios
  1.3.2→1.3.6) was already present but couldn't help if ClerkExpo wasn't in the project at all.
- Build 14 (c0e8552b): failed — deploymentTarget change in expo-build-properties didn't take
  effect (likely EAS fingerprint cache hit; pods reused from previous build).
- Build 15 (fb29d13d): ARCHIVE SUCCEEDED. 198 targets, ClerkKit/ClerkKitUI/ClerkExpo all
  compiled. Zero Swift errors, zero linker errors. IPA produced. deploymentTarget "17.0" in
  expo-build-properties.ios took effect on the fresh EAS worker (cache miss due to buildNumber
  bump). Patch 7 (platform :ios fix) was staged but NOT in this build — the deploymentTarget
  setting alone was sufficient once EAS ran a clean pod install.
- Patch 7 is still present in the plugin as belt-and-suspenders for future builds where the
  Podfile might use min_ios_version_supported instead of podfile_properties.
- Build 19 (f6de8f76): ARCHIVE SUCCEEDED. Zero compile errors. First build with Sentry wired to ErrorBoundary, build context tags (buildNumber/appVersion/buildCommit) on every Sentry event, and Sentry DSN pre-flight check in stage script.
- Must bump buildNumber in app.config.js AND app.json each build to break EAS fingerprint cache

## CRITICAL: ClerkExpo platform fix
ClerkExpo.podspec: `s.platforms = { :ios => '17.0' }`. CocoaPods silently drops pods whose
minimum > Podfile `platform :ios`. The Expo/RN generated Podfile uses `min_ios_version_supported`
(RN's hardcoded 15.1 from react_native_pods.rb). expo-build-properties.ios.deploymentTarget
DOES NOT affect this line. Fix via Patch 7: replace the line with `platform :ios, '17.0'`.
Symptom when missing: ClerkExpo absent from 185-target Xcode dep graph; "Unable to resolve
module dependency: 'ClerkExpo'" as only error in the build log.

## Native patch summary (withPodfileSpmFix.js) — all 7 patches required
1. SPM nil-target guard (Ruby post_install) — ClerkGoogleSignIn has no pod target at post_install
2. fmt consteval→constexpr (Ruby post_install) — Clang 19 / Xcode 26 C++20 strict mode
3. legacyResolver→resolve wrapper (JS, pre-pod) — expo-modules-core 3.x removed legacyResolver
4. GoogleUtilities/RecaptchaInterop :modular_headers (JS, Podfile) — AppCheckCore static deps
5. RCTScrollView→UIScrollView in RNViewShot.mm (Ruby post_install) — removed in RN 0.76
6. clerk-ios 1.3.2→1.3.6 in ClerkExpo.podspec (JS, pre-pod) — Swift 6 compat under Xcode 26
7. platform :ios, min_ios_version_supported → '17.0' (JS, Podfile) — ClerkExpo requires iOS 17

## Build 30 — Xcode 26 native patches added (Patches 8 & 9)

### Patch 8: expo-store-review SceneGeometry
- File: `node_modules/expo-store-review/ios/StoreReviewModule.swift`
- Broken: `return SceneGeometry.foregroundScene()` — type doesn't exist in Xcode 26 SDK
- Fix: replace function body with `UIApplication.shared.connectedScenes` iteration
- Triggered by: newer expo-store-review npm version installed after `npm install --legacy-peer-deps`

### Patch 9: expo-image getModule internal
- Files: `node_modules/expo-image/ios/ImageModule.swift` and `ImageView.swift`
- Broken: `appContext?.moduleRegistry.getModule(implementing: ImageModule.self)?` — `getModule` is `internal` in ExpoModulesCore 3.x
- Fix: `(appContext?.moduleRegistry.get(moduleWithName: "ExpoImage") as? ImageModule)?`
  - `get(moduleWithName:)` is `public` (line 95 of ModuleRegistry.swift); returns `AnyModule?`; cast to `ImageModule?` is safe
- Triggered by: newer expo-image that calls the internal API

### CRITICAL: pod repo update required between builds
- `pod repo update` must be run on the Mac if CocoaPods source repos are stale
- Symptom: `pod install exited with non-zero code: 31` + "out-of-date source repos" message
- Fix: `pod repo update` (~2-5 min), then re-run stage script

### Build recovery after git hard-reset wipe
- If Mac code is wiped by `--hard` sync, recover with `git reflog` → `git reset --hard <sha>`
- Then `npm ci` (NOT `npm install --legacy-peer-deps`) to restore exact package versions
- `npm install --legacy-peer-deps` resolves NEWER packages that break native compilation
- package-lock.json IS now git-tracked (committed Aug 2026), so `git checkout -- package-lock.json` works and fresh clones can `npm ci` directly

- Build 30: ARCHIVE SUCCEEDED + submitted to TestFlight. Patches 8 (expo-store-review SceneGeometry) and 9 (expo-image getModule internal) added. Submission used --path (local IPA) not --latest (cloud build).
- Build number history: Build 28 submitted then rejected for resubmit → Build 29 abandoned → Build 30 submitted successfully via --path flag.
