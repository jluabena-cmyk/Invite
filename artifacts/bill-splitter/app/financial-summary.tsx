import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetFinancialSummary } from "@workspace/api-client-react";
import type { FinancialSummaryBreakdownItem } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function fmt(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const config: Record<string, { label: string; color: string; bg: string }> = {
    requested: { label: "Pending", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
    paid:      { label: "Paid",    color: "#16A34A", bg: "rgba(22,163,74,0.12)" },
    received:  { label: "Confirmed", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  };
  const c = config[status] ?? { label: status, color: colors.mutedForeground, bg: colors.card };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

function BreakdownRow({ item, onPress }: { item: FinancialSummaryBreakdownItem; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {item.personName}
        </Text>
        <Text style={[styles.rowEvent, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.eventTitle}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: colors.foreground }]}>{fmt(item.amountCents)}</Text>
        <StatusBadge status={item.status} />
      </View>
    </Pressable>
  );
}

function Section({
  title,
  items,
  emptyMessage,
  onRowPress,
}: {
  title: string;
  items: FinancialSummaryBreakdownItem[];
  emptyMessage: string;
  onRowPress: (eventId: number) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {items.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{emptyMessage}</Text>
        ) : (
          items.map((item) => (
            <BreakdownRow
              key={item.requestId}
              item={item}
              onPress={() => onRowPress(item.eventId)}
            />
          ))
        )}
      </View>
    </View>
  );
}

export default function FinancialSummaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useGetFinancialSummary();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Balances</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No financial data yet.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryRow}>
            <View style={[styles.summaryTile, { backgroundColor: "rgba(22,163,74,0.08)", borderColor: "rgba(22,163,74,0.25)" }]}>
              <Text style={[styles.summaryValue, { color: "#16A34A" }]}>
                {data.owedToMe === 0 ? "$0" : `$${(data.owedToMe / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
              <Text style={[styles.summaryLabel, { color: "#16A34A" }]}>You're owed</Text>
            </View>
            <View style={[styles.summaryTile, { backgroundColor: data.iOwe > 0 ? "rgba(220,38,38,0.08)" : colors.card, borderColor: data.iOwe > 0 ? "rgba(220,38,38,0.25)" : colors.border }]}>
              <Text style={[styles.summaryValue, { color: data.iOwe > 0 ? "#DC2626" : colors.foreground }]}>
                {data.iOwe === 0 ? "$0" : `$${(data.iOwe / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
              <Text style={[styles.summaryLabel, { color: data.iOwe > 0 ? "#DC2626" : colors.mutedForeground }]}>You owe</Text>
            </View>
          </View>

          <View style={styles.lifetimeRow}>
            <View style={[styles.lifetimeTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.lifetimeValue, { color: colors.foreground }]}>
                {`$${(data.totalHosted / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
              <Text style={[styles.lifetimeLabel, { color: colors.mutedForeground }]}>Total hosted</Text>
            </View>
            <View style={[styles.lifetimeTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.lifetimeValue, { color: colors.foreground }]}>
                {`$${(data.totalSpent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
              <Text style={[styles.lifetimeLabel, { color: colors.mutedForeground }]}>Total spent</Text>
            </View>
          </View>

          <Section
            title="People who owe you"
            items={data.owedToMeBreakdown}
            emptyMessage="Nobody owes you anything right now."
            onRowPress={(eventId) => router.push(`/event/${eventId}` as any)}
          />
          <Section
            title="People you owe"
            items={data.iOweBreakdown}
            emptyMessage="You don't owe anyone right now."
            onRowPress={(eventId) => router.push(`/event/${eventId}` as any)}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 16, fontWeight: "600" },
  backBtn: { width: 60 },
  backText: { fontSize: 17, fontWeight: "500" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    alignItems: "center",
  },
  summaryValue: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  summaryLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  lifetimeRow: { flexDirection: "row", gap: 10 },
  lifetimeTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    alignItems: "center",
  },
  lifetimeValue: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3 },
  lifetimeLabel: { fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.4 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600", paddingHorizontal: 2 },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontWeight: "600" },
  rowEvent: { fontSize: 12 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontSize: 15, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  emptyText: { padding: 16, fontSize: 14, textAlign: "center" },
});
