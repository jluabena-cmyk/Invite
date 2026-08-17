import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
}

export function PaywallModal({ visible, onClose, onSubscribed }: PaywallModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { monthlyPackage, annualPackage, purchase, restore, isPurchasing, isRestoring, isLoading, refetchCustomerInfo } =
    useSubscription();

  const [purchasingPlan, setPurchasingPlan] = useState<"monthly" | "annual" | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<"monthly" | "annual" | null>(null);

  const monthlyPrice = monthlyPackage?.product?.priceString ?? "$4.99";
  const annualPrice = annualPackage?.product?.priceString ?? "$29.99";

  const handlePlanPress = (plan: "monthly" | "annual") => {
    if (__DEV__) {
      setPendingPlan(plan);
      setConfirmVisible(true);
    } else {
      void executePurchase(plan);
    }
  };

  const executePurchase = async (plan: "monthly" | "annual") => {
    const pkg = plan === "monthly" ? monthlyPackage : annualPackage;
    if (!pkg) {
      Alert.alert("Unavailable", "This plan is not available right now. Please try again.");
      return;
    }

    setPurchasingPlan(plan);
    try {
      await purchase(pkg);
      await refetchCustomerInfo();
      onSubscribed?.();
      onClose();
    } catch (err: any) {
      if (err?.userCancelled) return;
      Alert.alert("Purchase failed", err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setPurchasingPlan(null);
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      await refetchCustomerInfo();
      Alert.alert("Restore complete", "Your subscription has been restored.");
      onClose();
    } catch {
      Alert.alert("Restore failed", "No previous subscription found.");
    }
  };

  const isbusy = isPurchasing || isRestoring;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
            <View style={{ width: 36 }} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Upgrade to Premium</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              testID="paywall-close-btn"
            >
              <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>🚀</Text>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>Host Unlimited Events</Text>
              <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                You've used all 8 free hosted events. Upgrade to keep splitting bills without limits.
              </Text>
            </View>

            {/* Feature list */}
            <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { icon: "✓", label: "Unlimited hosted events" },
                { icon: "✓", label: "Unlimited payment request sending" },
                { icon: "✓", label: "Full bill tracking and payment confirmations" },
                { icon: "✓", label: "Guest features always free for everyone" },
              ].map((feat) => (
                <View key={feat.label} style={styles.featureRow}>
                  <Text style={[styles.featureIcon, { color: "#16A34A" }]}>{feat.icon}</Text>
                  <Text style={[styles.featureLabel, { color: colors.foreground }]}>{feat.label}</Text>
                </View>
              ))}
            </View>

            {/* Plans */}
            <View style={styles.plansSection}>
              {/* Monthly */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || isbusy ? 0.85 : 1 },
                ]}
                onPress={() => handlePlanPress("monthly")}
                disabled={isbusy || isLoading}
                testID="paywall-monthly-btn"
              >
                <View style={styles.planLeft}>
                  <Text style={[styles.planName, { color: colors.foreground }]}>Monthly</Text>
                  <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>Billed monthly, cancel anytime</Text>
                </View>
                <View style={styles.planRight}>
                  {purchasingPlan === "monthly" ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Text style={[styles.planPrice, { color: colors.foreground }]}>{monthlyPrice}</Text>
                      <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>/mo</Text>
                    </>
                  )}
                </View>
              </Pressable>

              {/* Annual */}
              <Pressable
                style={({ pressed }) => [
                  styles.planCard,
                  styles.planCardFeatured,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed || isbusy ? 0.85 : 1,
                  },
                ]}
                onPress={() => handlePlanPress("annual")}
                disabled={isbusy || isLoading}
                testID="paywall-annual-btn"
              >
                <View style={styles.planLeft}>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: colors.primaryForeground }]}>Yearly</Text>
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>Save 50%</Text>
                    </View>
                  </View>
                  <Text style={[styles.planDesc, { color: colors.primaryForeground, opacity: 0.8 }]}>
                    Best value — billed annually
                  </Text>
                </View>
                <View style={styles.planRight}>
                  {purchasingPlan === "annual" ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Text style={[styles.planPrice, { color: colors.primaryForeground }]}>{annualPrice}</Text>
                      <Text style={[styles.planPeriod, { color: colors.primaryForeground, opacity: 0.8 }]}>/yr</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </View>

            {/* Footer links */}
            <Pressable
              onPress={handleRestore}
              disabled={isbusy}
              style={({ pressed }) => [styles.restoreBtn, { opacity: pressed || isbusy ? 0.6 : 1 }]}
              testID="paywall-restore-btn"
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Text style={[styles.restoreBtnText, { color: colors.mutedForeground }]}>Restore Purchases</Text>
              )}
            </Pressable>

            <Text style={[styles.legalNote, { color: colors.mutedForeground }]}>
              {Platform.OS === "android"
                ? "Payment will be charged to your Google Play account. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period."
                : "Payment will be charged to your Apple ID account. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period."}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Dev-mode purchase confirmation */}
      <Modal
        visible={confirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Dev Mode Purchase</Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              This is a test purchase (no real money charged). Simulate the{" "}
              <Text style={{ fontWeight: "600" }}>{pendingPlan}</Text> plan?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={[styles.confirmBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setConfirmVisible(false);
                  if (pendingPlan) void executePurchase(pendingPlan);
                }}
              >
                <Text style={[styles.confirmBtnText, { color: colors.primaryForeground }]}>Purchase</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 16 },
  scrollContent: { padding: 20, gap: 20 },
  hero: { alignItems: "center", gap: 10, paddingVertical: 8 },
  heroEmoji: { fontSize: 48 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureIcon: { fontSize: 16, fontWeight: "700", width: 20, textAlign: "center" },
  featureLabel: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", flex: 1 },
  plansSection: { gap: 10 },
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planCardFeatured: {},
  planLeft: { flex: 1, gap: 3 },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  planDesc: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  planRight: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice: { fontSize: 22, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  planPeriod: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  saveBadge: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  saveBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreBtnText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  legalNote: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  confirmBody: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 20,
  },
  confirmActions: { flexDirection: "row", gap: 10 },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnPrimary: { borderWidth: 0 },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
