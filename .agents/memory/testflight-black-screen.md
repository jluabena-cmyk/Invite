---
name: TestFlight black screen
description: Root causes and fixes for the black screen on launch in TestFlight builds, and the submission workflow that finally worked.
---

# TestFlight Black Screen

## Root causes (in order of discovery)

### 1. useFonts hang blocks ClerkProvider from mounting (Build 7 — the real bug)
`useFonts` from `@expo-google-fonts` can silently hang in production builds.
The original safety net called `SplashScreen.hideAsync()` after 5s but did NOT
update any React state — so the component kept returning the dark `<View>` early,
blocking `ClerkProvider` from ever mounting. Clerk never initialized; the user
saw a permanent dark screen even after the splash was gone.

**Fix (Build 8):** Added `fontsTimedOut` state (`useState(false)`). The `setTimeout`
callback now ALSO calls `setFontsTimedOut(true)`, which triggers a re-render and
lets the component fall through past the early-return guard. `ClerkProvider`
mounts with system fonts as fallback until the custom fonts arrive.

The guard is now:
```tsx
if (!fontsLoaded && !fontError && !fontsTimedOut) {
  return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
}
```

### 2. null renders during Clerk/storage init (Builds 3–5)
`_layout.tsx` returned `null` while fonts loaded; `index.tsx` returned `null`
while Clerk/AsyncStorage resolved — native black background showed through.
Fixed by replacing all `return null` with `<View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />`.

### 3. Mac build folder never synced (Builds 5–6)
Every build used stale code from `owmo-build 2` because files changed in Replit
were never copied over. Multiple wasted builds resulted.

### 4. Sentry DSN not set on Mac shell (Builds 3–4)
`EXPO_PUBLIC_SENTRY_DSN` not set → literal `"$EXPO_PUBLIC_SENTRY_DSN"` baked in
→ Sentry 8.x throws synchronously before React mounts. Fixed by guard in `_layout.tsx`.

## Submission workflow (what works)
1. Copy from Replit to Mac before every build: `app.json`, `app.config.js`, `app/_layout.tsx`, `app/index.tsx`
2. `bash artifacts/bill-splitter/scripts/stage-eas-build.sh` — uploads to EAS (~15–20 min)
3. After EAS shows Finished: `ASC_APP_ID=6790176677 bash artifacts/bill-splitter/scripts/stage-eas-submit.sh`
4. Submit script uses EAS-stored remote API key — no local ASC credentials needed.

### 5. GestureHandlerRootView missing style={{ flex: 1 }} (Build 15 / build number 14)
`GestureHandlerRootView` in `_layout.tsx` was rendered without `style={{ flex: 1 }}`.
Without it the view collapses to 0×0 pixels. Once ClerkLoaded fires (very quickly since the
key is valid), the entire screen content tree renders at zero height and the native black
background shows through. `ClerkLoading`'s dark #1a1f3c fallback masked this during the brief
Clerk init window. `KeyboardProvider` also lacked `style={{ flex: 1 }}`.
**Fix:** Added `style={{ flex: 1 }}` to both `GestureHandlerRootView` and `KeyboardProvider` in
the `ClerkLoaded` render path. Build 17.

## Build number history
- Build 5: TestFlight, black screen (null returns, stale Mac code)
- Build 6: cancelled by user from EAS queue
- Build 5 (duplicate): Mac not synced → Apple rejected as duplicate
- Build 7: splash screen fix + dark view fallbacks — BUT useFonts hang still blocked ClerkProvider → dark screen persists
- Build 8: `fontsTimedOut` state added → ClerkProvider always mounts after ≤5s
- Build 15 (EAS fb29d13d, Apple build number 14): ClerkExpo compiled (198 targets). Black screen persists — GestureHandlerRootView missing flex:1.
- Build 17: flex:1 fix applied to GestureHandlerRootView + KeyboardProvider
