import * as Sentry from "@sentry/react-native";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ClerkProvider, ClerkLoaded, ClerkLoading, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { Alert, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { setBaseUrl, getBaseUrl, setAuthTokenGetter, setBuildNumber, registerPushToken } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Purchases from "react-native-purchases";
import { initializeRevenueCat, isRevenueCatConfigured, SubscriptionProvider } from "@/lib/revenuecat";
import { createApiPingPromise, createProxyPingPromise, raceWithTimeout } from "@/utils/launchPing";

// Tracks whether Sentry was successfully initialized — used later to set
// build-context tags and to gate captureException calls in the ErrorBoundary.
let sentryEnabled = false;
if (!__DEV__) {
  // Guard against an un-expanded shell variable (e.g. the literal string
  // "$EXPO_PUBLIC_SENTRY_DSN") being baked into the bundle when the env var
  // is not set at build time.  Sentry 8.x throws SentryError: Invalid Sentry
  // Dsn synchronously at the module level if the DSN is not a valid https://
  // URL — crashing the JS runtime before React mounts.
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
      sentryEnabled = true;
    } catch (e) {
      console.warn("[Sentry] Init failed:", e);
    }
  } else {
    console.warn(
      "[Sentry] DSN not configured or invalid — error reporting disabled.",
      sentryDsn ? `(got: ${sentryDsn.slice(0, 20)}...)` : "(got: undefined)"
    );
  }
}

try {
  initializeRevenueCat();
} catch (err: any) {
  console.warn("[RevenueCat] Init failed:", err?.message ?? "Unknown error");
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

// Register the build number so every API request carries x-app-build, which
// lets the server attribute upload telemetry to the exact app release.
// Select the platform-appropriate value: iOS uses buildNumber (a string),
// Android uses versionCode (an integer). Using the wrong platform's field
// on a dual-platform Expo config would attribute Android events to iOS builds.
const BUILD_NUMBER_FOR_HEADER: string | null =
  Platform.OS === "ios"
    ? (Constants.expoConfig?.ios?.buildNumber ?? null)
    : (Constants.expoConfig?.android?.versionCode?.toString() ?? null);
setBuildNumber(BUILD_NUMBER_FOR_HEADER);

const rawPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
// Clerk validates the publishable key synchronously and throws before React
// mounts if the key is empty or un-expanded (e.g. the literal string
// "$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" baked in when the env var is absent).
// We detect this here so we can render a safe fallback screen instead of
// crashing the JS runtime.
const isClerkKeyValid =
  typeof rawPublishableKey === "string" &&
  rawPublishableKey.length > 0 &&
  !rawPublishableKey.startsWith("$") &&
  (rawPublishableKey.startsWith("pk_live_") ||
    rawPublishableKey.startsWith("pk_test_"));
if (!isClerkKeyValid) {
  console.warn(
    "[Clerk] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing or was not expanded " +
      "at build time. Authentication will not work. Check that the env var is " +
      "set in the shell before running stage-eas-build.sh."
  );
}
const publishableKey = rawPublishableKey;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// ─── Launch telemetry ─────────────────────────────────────────────────────────

/** Millisecond timestamp of when the JS runtime started this module. */
const LAYOUT_MOUNT_TIME = Date.now();

/**
 * RFC 4122 v4 UUID generator — pure Math.random() fallback so it works even
 * when `crypto.randomUUID()` is unavailable in the React Native runtime.
 * The output always matches the UUID regex used by the API server.
 */
function makeUUID(): string {
  const h = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += h[((Math.random() * 4) | 0) + 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

/** Stable per-session UUID — not linked to user identity. */
const SESSION_ID = (() => {
  try {
    // crypto.randomUUID() is available on Expo SDK 50+ / RN 0.73+; use it when
    // present so the ID has full cryptographic randomness.
    return crypto.randomUUID();
  } catch {
    // Fall back to Math.random()-based v4 UUID — still a valid UUID that
    // passes the server's regex, just with lower entropy.
    return makeUUID();
  }
})();

const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.expoConfig?.android?.versionCode?.toString() ??
  undefined;
const APP_VERSION = Constants.expoConfig?.version ?? undefined;
const BUILD_COMMIT: string | null =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.buildCommit as string ?? null;

// Tag every Sentry event with the build identity so crashes are immediately
// traceable to the right build without opening EAS or Xcode.
if (sentryEnabled) {
  if (BUILD_NUMBER) Sentry.setTag("buildNumber", BUILD_NUMBER);
  if (APP_VERSION)  Sentry.setTag("appVersion",  APP_VERSION);
  if (BUILD_COMMIT) Sentry.setTag("buildCommit", BUILD_COMMIT);
}

/**
 * Fires a GET /api/ping at the moment the JS module loads — before
 * ClerkProvider mounts — so we can record API reachability in the telemetry
 * row. The Promise is awaited inside postLaunchTelemetry, which always fires
 * at least 2 s later (ClerkLoaded path) or 12 s later (timeout path), so
 * the result will almost always be resolved by then.
 *
 * Uses createApiPingPromise from utils/launchPing so the timeout/failure
 * paths are covered by unit tests independently of this module.
 */
const API_PING_RESULT = createApiPingPromise(process.env.EXPO_PUBLIC_DOMAIN);

/**
 * Fires a GET to <EXPO_PUBLIC_CLERK_PROXY_URL>/v1/client at module load —
 * before ClerkProvider mounts — so we can record Clerk proxy reachability
 * in the telemetry row independently of whether Clerk itself loads.
 * A proxy that is unreachable here explains 100% of Clerk timeouts.
 */
const PROXY_PING_RESULT = createProxyPingPromise(process.env.EXPO_PUBLIC_CLERK_PROXY_URL);

interface LaunchTelemetryPayload {
  sessionId: string;
  buildNumber?: string;
  appVersion?: string;
  platform?: string;
  clerkStatus: "loaded" | "timed_out";
  msToClerk?: number;
  firstScreen?: string;
  /** EXPO_PUBLIC_DOMAIN value baked into this binary — lets the server detect wrong-domain builds. */
  bakedDomain?: string;
  /** EXPO_PUBLIC_CLERK_PROXY_URL value baked into this binary. */
  bakedProxyUrl?: string;
  /** Whether the Clerk proxy URL responded to a /v1/client probe within 5 s. */
  proxyReachable?: boolean;
  /** Round-trip time of the proxy probe in milliseconds. */
  proxyPingMs?: number;
}

/**
 * Posts one row to /api/telemetry/launch. Fire-and-forget — any error is
 * silently swallowed so this never interferes with app startup.
 * Automatically appends the API ping result recorded at module load time.
 */
async function postLaunchTelemetry(payload: LaunchTelemetryPayload) {
  const base = getBaseUrl();
  if (!base) return;

  // API_PING_RESULT fires at module load, 2–12 s before this function is
  // ever called. Race with a 500 ms safety net in case something is very slow.
  // raceWithTimeout is unit-tested in utils/__tests__/launchPing.test.ts.
  const [ping, proxyPing] = await Promise.all([
    raceWithTimeout(API_PING_RESULT, 500, { reachable: false, pingMs: 0 }),
    raceWithTimeout(PROXY_PING_RESULT, 500, { reachable: false, pingMs: 0 }),
  ]);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${base}/api/telemetry/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        apiReachable: ping.reachable,
        apiPingMs: ping.pingMs,
        proxyReachable: proxyPing.reachable,
        proxyPingMs: proxyPing.pingMs,
        bakedDomain: process.env.EXPO_PUBLIC_DOMAIN ?? undefined,
        bakedProxyUrl: process.env.EXPO_PUBLIC_CLERK_PROXY_URL ?? undefined,
      }),
      signal: controller.signal,
    });
  } catch {
    // intentionally silent — telemetry must never surface errors to the user
  } finally {
    clearTimeout(tid);
  }
}

/**
 * ClerkLoadingWithTimeout
 *
 * Shows a light-background loading view while Clerk initializes.
 *
 * Two-phase timeout strategy:
 *   Phase 1 — 12 s: check whether the Clerk proxy was reachable (from the
 *     module-level PROXY_PING_RESULT that fires at startup).  If the proxy
 *     is unreachable, this is a real network problem → call `onTimeout` so
 *     the parent renders the "Connection issue" screen.  If the proxy is
 *     reachable, Clerk is just slow on a healthy network → keep showing the
 *     loading indicator.
 *   Phase 2 — 25 s: hard cutoff regardless of proxy state.  Something has
 *     gone seriously wrong; we must never leave the user on a blank screen.
 *
 * Using a cream (#FAF5EF) background instead of dark navy makes it
 * visually distinct from the native black background — essential for
 * distinguishing "Clerk is loading" from "app is zero-height" during
 * TestFlight diagnostics.
 */
function ClerkLoadingWithTimeout({
  onTimeout,
  timedOut,
}: {
  onTimeout: () => void;
  timedOut: boolean;
}) {
  const posted = useRef(false);
  // Store proxy reachability in a ref so the phase-1 timer can read the
  // latest value without a stale-closure.  Populated as soon as
  // PROXY_PING_RESULT resolves (which has its own 5 s internal timeout, so
  // it will be settled well before the 12 s phase-1 fires).
  const proxyReachableRef = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void PROXY_PING_RESULT.then((result) => {
      if (!cancelled) proxyReachableRef.current = result.reachable;
    }).catch(() => {
      if (!cancelled) proxyReachableRef.current = false;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const doTelemetry = () => {
      if (posted.current) return;
      posted.current = true;
      void postLaunchTelemetry({
        sessionId: SESSION_ID,
        buildNumber: BUILD_NUMBER,
        appVersion: APP_VERSION,
        platform: Platform.OS === "ios" || Platform.OS === "android"
          ? Platform.OS : undefined,
        clerkStatus: "timed_out",
        msToClerk: Date.now() - LAYOUT_MOUNT_TIME,
        firstScreen: "clerk_timeout",
      });
    };

    // Phase 1 — 12 s: show "Connection issue" only when the proxy is
    // unreachable (or the ping result is still unknown, which is very unlikely
    // after 12 s given the 5 s probe timeout — treat unknown as unreachable
    // so we never leave the user on a blank screen by mistake).
    const phase1 = setTimeout(() => {
      if (proxyReachableRef.current !== true) {
        doTelemetry();
        onTimeout();
      }
      // Proxy reachable → Clerk is just slow on a good connection.
      // Keep showing the loading indicator; phase2 is the hard cutoff.
    }, 12_000);

    // Phase 2 — 25 s: unconditional hard cutoff.
    const phase2 = setTimeout(() => {
      doTelemetry();
      onTimeout();
    }, 25_000);

    return () => {
      clearTimeout(phase1);
      clearTimeout(phase2);
    };
  }, [onTimeout]);

  if (timedOut) {
    // Clerk hasn't loaded — proxy was unreachable or hit the 25 s hard limit.
    // Wrap in ClerkLoading so this view disappears automatically once Clerk
    // does finish loading (e.g. on a slow connection where the timeout fires
    // before the response arrives).  Without this wrapper the error renders
    // permanently alongside <ClerkLoaded>, pinning a banner to the top of
    // every screen even after the user is signed in.
    return (
      <ClerkLoading>
        <View style={{ flex: 1, backgroundColor: "#FAF5EF", justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1C1917", marginBottom: 12, textAlign: "center" }}>
            Connection issue
          </Text>
          <Text style={{ fontSize: 14, color: "#78716C", textAlign: "center", lineHeight: 22 }}>
            Owmo couldn't connect to the authentication service.{"\n"}
            Please check your internet connection and reopen the app.
          </Text>
        </View>
      </ClerkLoading>
    );
  }

  return (
    <ClerkLoading>
      {/* Cream background — visually distinct from native black so we can
          tell "Clerk loading" apart from "zero-height layout" on device. */}
      <View style={{ flex: 1, backgroundColor: "#FAF5EF", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#78716C", fontSize: 14 }}>
          Loading Owmo…
        </Text>
      </View>
    </ClerkLoading>
  );
}

/**
 * LaunchTelemetry — mounts inside ClerkLoaded and posts one telemetry row
 * 2 seconds after mount so navigation has time to settle and firstScreen is
 * readable from useSegments().
 */
function LaunchTelemetry() {
  const segments = useSegments();
  const posted = useRef(false);

  useEffect(() => {
    if (posted.current) return;
    const timer = setTimeout(() => {
      if (posted.current) return;
      posted.current = true;
      const firstScreen = segments.length > 0 ? segments.join("/") : "root";
      void postLaunchTelemetry({
        sessionId: SESSION_ID,
        buildNumber: BUILD_NUMBER,
        appVersion: APP_VERSION,
        platform: Platform.OS === "ios" || Platform.OS === "android"
          ? Platform.OS : undefined,
        clerkStatus: "loaded",
        msToClerk: Date.now() - LAYOUT_MOUNT_TIME,
        firstScreen,
      });
    }, 2000);
    return () => clearTimeout(timer);
  // Run once on mount only; intentionally ignore segments dependency so we
  // capture the first settled screen rather than re-firing on every navigate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function AuthSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function RevenueCatSetup() {
  const { userId, isSignedIn } = useAuth();
  useEffect(() => {
    // Skip SDK calls entirely if configure() never succeeded (missing API key,
    // network unreachable at init time, etc.) — avoids unhandled rejections
    // from an unconfigured Purchases instance.
    if (!isRevenueCatConfigured()) return;
    if (!isSignedIn || !userId) {
      void Purchases.logOut().catch(() => {});
      return;
    }
    void Purchases.logIn(userId).catch((err: unknown) => {
      console.warn("[RevenueCat] logIn failed:", err);
    });
  }, [isSignedIn, userId]);
  return null;
}

const PUSH_PROMPT_KEY = "pushPromptShown";

async function registerPushTokenIfGranted() {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await registerPushToken({ token: tokenData.data });
  } catch { /* best-effort */ }
}

function PushSoftAskModal({
  visible,
  onAllow,
  onDismiss,
}: {
  visible: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={pushStyles.overlay}>
        <View style={pushStyles.card}>
          <Text style={pushStyles.icon}>🔔</Text>
          <Text style={pushStyles.title}>Stay in the loop</Text>
          <Text style={pushStyles.body}>
            Get notified when friends join your plan, pay their share, or when it's time to settle up.
          </Text>
          <Pressable style={pushStyles.primaryBtn} onPress={onAllow}>
            <Text style={pushStyles.primaryBtnText}>Allow notifications</Text>
          </Pressable>
          <Pressable style={pushStyles.secondaryBtn} onPress={onDismiss}>
            <Text style={pushStyles.secondaryBtnText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const pushStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 10,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  body: {
    fontSize: 15,
    color: "#78716C",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#C2410C",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#78716C",
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});

function PushSetup() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    void (async () => {
      if (Platform.OS === "web") return;
      const current = await Notifications.getPermissionsAsync() as any;
      if (current.granted) {
        await registerPushTokenIfGranted();
        return;
      }
      if (current.canAskAgain) {
        const alreadyShown = await AsyncStorage.getItem(PUSH_PROMPT_KEY);
        if (!alreadyShown) {
          setShowPrompt(true);
          return;
        }
      }
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => { /* handled by OS banner */ });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.screen === "event" && typeof data.eventId === "number") {
        const anchor = data.anchor === "voting" ? "?anchor=voting" : "";
        router.push(`/event/${data.eventId}${anchor}`);
      } else if (data?.screen === "paywall") {
        router.push("/(tabs)/profile?openPaywall=1");
      }
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.screen === "event" && typeof data.eventId === "number") {
        const anchor = data.anchor === "voting" ? "?anchor=voting" : "";
        router.push(`/event/${data.eventId}${anchor}`);
      } else if (data?.screen === "paywall") {
        router.push("/(tabs)/profile?openPaywall=1");
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isSignedIn, router]);

  const handleAllow = async () => {
    setShowPrompt(false);
    await AsyncStorage.setItem(PUSH_PROMPT_KEY, "1");
    const result = await Notifications.requestPermissionsAsync() as any;
    if (result.granted) await registerPushTokenIfGranted();
  };

  const handleDismiss = async () => {
    setShowPrompt(false);
    await AsyncStorage.setItem(PUSH_PROMPT_KEY, "1");
  };

  return (
    <PushSoftAskModal
      visible={showPrompt}
      onAllow={() => void handleAllow()}
      onDismiss={() => void handleDismiss()}
    />
  );
}

function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const { top } = useSafeAreaInsets();

  const check = useCallback(async () => {
    const d = process.env.EXPO_PUBLIC_DOMAIN;
    if (!d) return;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://${d}/api/healthz`, { method: "HEAD", signal: controller.signal });
      clearTimeout(tid);
      setIsOffline(!res.ok);
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    void check();
    const interval = setInterval(() => void check(), 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [check]);

  if (!isOffline) return null;
  return (
    <View style={{
      position: "absolute",
      top: top,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: "#92400e",
      paddingVertical: 7,
      paddingHorizontal: 16,
      alignItems: "center",
    }}>
      <Text style={{ color: "#fef3c7", fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" }}>
        No internet connection
      </Text>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="cancelled-events" />
      <Stack.Screen name="join/[code]" options={{ animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  // Track whether the 5-second font timeout has fired. When it does we stop
  // gating on fonts and let the rest of the tree (ClerkProvider etc.) mount
  // using system fonts as a fallback. Without this flag, useFonts hanging
  // would block ClerkProvider from ever mounting — leaving the user on a dark
  // screen indefinitely even after the splash was forcibly hidden.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  // Clerk loading timeout: if ClerkLoaded never fires after 12s, show a
  // recoverable error instead of hanging on the loading screen forever.
  // Root cause is usually the proxy URL being unreachable on the device.
  const [clerkTimedOut, setClerkTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setFontsTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontsTimedOut) {
    // Use the app's real background (cream) so this state is visually
    // distinguishable from a pure black screen — diagnostic aid.
    return <View style={{ flex: 1, backgroundColor: "#FAF5EF" }} />;
  }

  // If the Clerk publishable key is missing or un-expanded (e.g. the literal
  // string "$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" baked in when the env var is
  // absent at build time), rendering ClerkProvider throws synchronously before
  // React mounts — causing an immediate crash that looks like a native crash.
  // Render a controlled fallback instead so the error is surfaced clearly.
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
              This build is missing required configuration. Please contact support or try reinstalling the app.
            </Text>
          </View>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoadingWithTimeout
        onTimeout={() => setClerkTimedOut(true)}
        timedOut={clerkTimedOut}
      />
      <ClerkLoaded>
        <LaunchTelemetry />
        <AuthSetup />
        <RevenueCatSetup />
        <PushSetup />
        <SafeAreaProvider>
          <NetworkStatus />
          <ErrorBoundary
            onError={(error, stackTrace) => {
              // Route React render errors to Sentry so they're visible in
              // the crash dashboard alongside native crashes. The ErrorBoundary
              // already shows a recovery UI, so this is purely observability.
              if (sentryEnabled) {
                Sentry.captureException(error, {
                  extra: { componentStack: stackTrace },
                });
              }
            }}
          >
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                {/* flex:1 required — without it GestureHandlerRootView collapses to 0 height */}
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider style={{ flex: 1 }}>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SubscriptionProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
