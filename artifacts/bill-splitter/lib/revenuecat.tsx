import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { STOREKIT_VERSION } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { customFetch } from "@workspace/api-client-react";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? "";
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

function getRevenueCatApiKey() {
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "ios") {
    return REVENUECAT_IOS_API_KEY || REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "android") {
    return REVENUECAT_ANDROID_API_KEY || REVENUECAT_TEST_API_KEY;
  }
  return REVENUECAT_TEST_API_KEY;
}

// Tracks whether Purchases.configure() succeeded. Used to guard logIn/logOut
// calls in RevenueCatSetup — avoids calling the SDK when it was never configured
// (e.g. missing API key or a synchronous error during configure).
let _rcConfigured = false;
export function isRevenueCatConfigured() {
  return _rcConfigured;
}

export function initializeRevenueCat() {
  try {
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      console.warn("[RevenueCat] No API key configured — skipping initialization");
      return;
    }
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    // storeKitVersion is iOS-only — omit it on Android to avoid unexpected behaviour.
    if (Platform.OS === "android") {
      Purchases.configure({ apiKey });
    } else {
      Purchases.configure({ apiKey, storeKitVersion: STOREKIT_VERSION.STOREKIT_2 });
    }
    _rcConfigured = true;
    console.log("[RevenueCat] Configured for", Platform.OS);
  } catch (err: any) {
    console.warn("[RevenueCat] Init failed:", err?.message ?? "Unknown error");
  }
}

type ServerSubscription = {
  subscriptionStatus: "free" | "premium";
  hostedEventsSent: number;
  eventsRemaining: number;
  freeEventLimit: number;
  premiumExpiresAt: string | null;
};

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      try {
        return await Purchases.getCustomerInfo();
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      try {
        return await Purchases.getOfferings();
      } catch {
        return null;
      }
    },
    staleTime: 300 * 1000,
    retry: false,
  });

  const serverSubQuery = useQuery<ServerSubscription>({
    queryKey: ["server-subscription"],
    queryFn: () => customFetch<ServerSubscription>("/users/me/subscription"),
    staleTime: 60 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: async () => {
      void customerInfoQuery.refetch();
      // Eagerly sync server-side entitlement so the 402 gate unblocks immediately
      // without waiting for the RevenueCat webhook to arrive.
      try {
        await customFetch("/users/me/subscription/sync", { method: "POST" });
      } catch {
        // Sync is best-effort; the webhook will eventually reconcile.
      }
      void serverSubQuery.refetch();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => Purchases.restorePurchases(),
    onSuccess: () => {
      void customerInfoQuery.refetch();
      void serverSubQuery.refetch();
    },
  });

  const activeEntitlement =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const isSubscribed = activeEntitlement !== undefined;

  const activePlanType: "monthly" | "annual" | null = (() => {
    if (!activeEntitlement) return null;
    const id = activeEntitlement.productIdentifier?.toLowerCase() ?? "";
    if (id.includes("annual") || id.includes("yearly") || id.includes("year")) return "annual";
    if (id.includes("monthly") || id.includes("month")) return "monthly";
    return "monthly";
  })();

  const currentOffering = offeringsQuery.data?.current ?? null;

  const monthlyPackage =
    currentOffering?.availablePackages.find((p) => p.packageType === "MONTHLY") ??
    currentOffering?.availablePackages[0] ??
    null;

  const annualPackage =
    currentOffering?.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;

  const hostedEventsSent = serverSubQuery.data?.hostedEventsSent ?? 0;
  const freeEventLimit = serverSubQuery.data?.freeEventLimit ?? null;
  const eventsRemaining = serverSubQuery.data?.eventsRemaining ?? 0;
  const serverSubscriptionStatus = serverSubQuery.data?.subscriptionStatus ?? "free";
  const premiumExpiresAt = serverSubQuery.data?.premiumExpiresAt ?? null;

  return {
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
    currentOffering,
    monthlyPackage,
    annualPackage,
    isSubscribed,
    activePlanType,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchCustomerInfo: customerInfoQuery.refetch,
    refetchServerSub: serverSubQuery.refetch,
    hostedEventsSent,
    freeEventLimit,
    eventsRemaining,
    serverSubscriptionStatus,
    premiumExpiresAt,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
