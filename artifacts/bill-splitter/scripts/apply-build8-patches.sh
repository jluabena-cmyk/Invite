#!/usr/bin/env bash
# apply-build8.sh — Applies all Build 8 source changes to owmo-build 2.
# Run from: ~/Downloads/owmo-build 2
#   bash apply-build8.sh
set -euo pipefail
APP="artifacts/bill-splitter"

echo "==> Applying Build 8 patches..."

# 1. Build number: 7 → 8
sed -i '' 's/"buildNumber": "7"/"buildNumber": "8"/' "$APP/app.json"
echo "  ✓ app.json buildNumber → 8"

sed -i '' 's/buildNumber: "7"/buildNumber: "8"/' "$APP/app.config.js"
echo "  ✓ app.config.js buildNumber → 8"

# 2. (auth)/_layout.tsx — add View import, replace return null
cat > "$APP/app/(auth)/_layout.tsx" << 'EOF'
import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Return a matching dark background rather than null so the native view
  // never bleeds through as a black screen while Clerk state resolves.
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
EOF
echo "  ✓ (auth)/_layout.tsx patched"

# 3. _layout.tsx — insert fontsTimedOut state and update the early-return guard.
#    Targets the exact lines we changed.
python3 - "$APP/app/_layout.tsx" << 'PYEOF'
import sys, re

path = sys.argv[1]
src = open(path).read()

# a) Add useState import if not already there (it already is, but be safe)
# b) Insert fontsTimedOut state after useFonts call
# c) Add setFontsTimedOut(true) in the timeout callback
# d) Change the early-return guard

# Replace the useEffect + early-return block
OLD = """  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    // Safety net: if useFonts hangs (a known issue on some builds), force the
    // splash screen to hide after 5 s so the app doesn't stay black forever.
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Don't gate rendering on fonts — show the dark background immediately so
  // the user never sees a black native view while we wait.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  }"""

NEW = """  // Track whether the 5-second font timeout has fired. When it does we stop
  // gating on fonts and let the rest of the tree (ClerkProvider etc.) mount
  // using system fonts as a fallback. Without this flag, useFonts hanging
  // would block ClerkProvider from ever mounting — leaving the user on a dark
  // screen indefinitely even after the splash was forcibly hidden.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    // Safety net: if useFonts hangs (a known issue on some builds), force the
    // splash screen to hide after 5 s and unblock the render tree so Clerk
    // can initialize and the user isn't stuck on a dark screen forever.
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setFontsTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Only hold on the dark background while fonts are still loading AND the
  // 5-second timeout hasn't fired yet. After the timeout, fall through so
  // ClerkProvider can mount (system fonts render until the custom fonts
  // arrive or are confirmed unavailable).
  if (!fontsLoaded && !fontError && !fontsTimedOut) {
    return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  }"""

if OLD not in src:
    print(f"  WARNING: _layout.tsx patch target not found — file may already be patched or differ.")
    print(f"           Check app/_layout.tsx manually.")
    sys.exit(0)

open(path, 'w').write(src.replace(OLD, NEW, 1))
print("  ✓ app/_layout.tsx fontsTimedOut fix applied")
PYEOF

# 4. (tabs)/_layout.tsx — add useState, profileTimedOut, fix null returns
python3 - "$APP/app/(tabs)/_layout.tsx" << 'PYEOF'
import sys

path = sys.argv[1]
src = open(path).read()

# Fix 1: add useState to React import
src = src.replace(
    "import React, { useEffect } from \"react\";",
    "import React, { useEffect, useState } from \"react\";"
)

# Fix 2: replace the TabLayout function body guard section
OLD = """export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useGetCurrentUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || profileLoading) return;
    if (!profile?.handle?.trim()) {
      router.replace("/profile-setup");
    }
  }, [isLoaded, isSignedIn, profileLoading, profile, router]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (profileLoading || !profile?.handle?.trim()) return null;"""

NEW = """export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useGetCurrentUser();
  // If the profile fetch hasn't resolved after 8 s (e.g. API unreachable on first
  // launch) we stop gating on it so the user isn't stuck on a black screen.
  // The useEffect below will redirect to /profile-setup once loading does finish.
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  useEffect(() => {
    if (!profileLoading) return;
    const t = setTimeout(() => setProfileTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [profileLoading]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || profileLoading) return;
    if (!profile?.handle?.trim()) {
      router.replace("/profile-setup");
    }
  }, [isLoaded, isSignedIn, profileLoading, profile, router]);

  // Use a matching dark background rather than null so the native view never
  // bleeds through as a black screen while auth / profile state resolves.
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if ((profileLoading && !profileTimedOut) || (!profileLoading && !profile?.handle?.trim())) {
    return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  }"""

if OLD not in src:
    print(f"  WARNING: (tabs)/_layout.tsx patch target not found — may already be patched.")
    sys.exit(0)

open(path, 'w').write(src.replace(OLD, NEW, 1))
print("  ✓ (tabs)/_layout.tsx profileTimedOut fix applied")
PYEOF

echo ""
echo "==> All Build 8 patches applied."
echo ""
echo "    Verify build numbers:"
grep buildNumber "$APP/app.json" "$APP/app.config.js"
echo ""
echo "    Now run:"
echo "    bash $APP/scripts/stage-eas-build.sh"
