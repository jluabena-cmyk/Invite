#!/usr/bin/env python3
"""Patch owmo-build 2 files to Build 5 (Sentry + Clerk crash fixes)."""
import sys, os

BASE = "/Users/jeremyluabena/Downloads/owmo-build 2/artifacts/bill-splitter"

# ── 1. app.config.js: bump buildNumber ──────────────────────────────────────
p = f"{BASE}/app.config.js"
t = open(p).read()
if 'buildNumber: "4"' in t:
    open(p, "w").write(t.replace('buildNumber: "4"', 'buildNumber: "5"'))
    print("✓ app.config.js: buildNumber 4 → 5")
elif 'buildNumber: "5"' in t:
    print("✓ app.config.js: already at 5")
else:
    print("⚠ app.config.js: buildNumber not found — check manually"); sys.exit(1)

# ── 2. app.json: bump buildNumber ───────────────────────────────────────────
p2 = f"{BASE}/app.json"
t2 = open(p2).read()
if '"buildNumber": "4"' in t2:
    open(p2, "w").write(t2.replace('"buildNumber": "4"', '"buildNumber": "5"'))
    print("✓ app.json: buildNumber 4 → 5")
elif '"buildNumber": "5"' in t2:
    print("✓ app.json: already at 5")

# ── 3. _layout.tsx: guard Sentry init ───────────────────────────────────────
lp = f"{BASE}/app/_layout.tsx"
layout = open(lp).read()

OLD_SENTRY = '''if (!__DEV__) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: "production",
  });
}'''

NEW_SENTRY = '''if (!__DEV__) {
  // Guard: Sentry 8.x throws synchronously on an invalid/missing DSN before
  // React mounts, crashing the app. Only init if we have a real https:// URL.
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const isSentryDsnValid =
    typeof sentryDsn === "string" &&
    sentryDsn.startsWith("https://") &&
    !sentryDsn.startsWith("$");
  if (isSentryDsnValid) {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: "production",
      });
    } catch (e) {
      console.warn("[Sentry] Init failed:", e);
    }
  } else {
    console.warn(
      "[Sentry] DSN not configured or invalid — error reporting disabled.",
      sentryDsn ? `(got: ${sentryDsn.slice(0, 20)}...)` : "(got: undefined)"
    );
  }
}'''

if OLD_SENTRY in layout:
    layout = layout.replace(OLD_SENTRY, NEW_SENTRY)
    print("✓ _layout.tsx: Sentry guard applied")
elif "isSentryDsnValid" in layout:
    print("✓ _layout.tsx: Sentry guard already present")
else:
    print("⚠ _layout.tsx: Sentry block not matched — check manually")

# ── 4. _layout.tsx: guard Clerk publishableKey ──────────────────────────────
OLD_CLERK_KEY = 'const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";'

NEW_CLERK_KEY = '''const rawPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
// Guard: Clerk throws synchronously if given an empty or un-expanded key.
const isClerkKeyValid =
  typeof rawPublishableKey === "string" &&
  rawPublishableKey.length > 0 &&
  !rawPublishableKey.startsWith("$") &&
  (rawPublishableKey.startsWith("pk_live_") ||
    rawPublishableKey.startsWith("pk_test_"));
if (!isClerkKeyValid) {
  console.warn(
    "[Clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing or not expanded at build time."
  );
}
const publishableKey = rawPublishableKey;'''

if OLD_CLERK_KEY in layout:
    layout = layout.replace(OLD_CLERK_KEY, NEW_CLERK_KEY)
    print("✓ _layout.tsx: Clerk key guard applied")
elif "isClerkKeyValid" in layout:
    print("✓ _layout.tsx: Clerk key guard already present")
else:
    print("⚠ _layout.tsx: Clerk key line not matched — check manually")

# ── 5. _layout.tsx: add Clerk fallback render ────────────────────────────────
OLD_RETURN = '''  return (
    <ClerkProvider
      publishableKey={publishableKey}'''

NEW_RETURN = '''  // Render a safe fallback if Clerk key is missing (prevents native crash).
  if (!isClerkKeyValid) {
    void SplashScreen.hideAsync();
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#1C1917", marginBottom: 12, textAlign: "center" }}>
              Configuration Error
            </Text>
            <Text style={{ fontSize: 14, color: "#78716C", textAlign: "center", lineHeight: 22 }}>
              This build is missing required configuration. Please reinstall or contact support.
            </Text>
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}'''

if OLD_RETURN in layout and "Configuration Error" not in layout:
    # Only patch the LAST occurrence (the actual return in RootLayout)
    idx = layout.rfind(OLD_RETURN)
    layout = layout[:idx] + NEW_RETURN + layout[idx + len(OLD_RETURN):]
    print("✓ _layout.tsx: Clerk fallback render applied")
elif "Configuration Error" in layout:
    print("✓ _layout.tsx: Clerk fallback already present")
else:
    print("⚠ _layout.tsx: ClerkProvider return not matched — check manually")

open(lp, "w").write(layout)
print("\n✅ All patches applied. Run stage-eas-build.sh next.")
