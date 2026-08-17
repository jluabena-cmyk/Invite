import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGetFinancialSummary } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function fmt(cents: number): string {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return `$${dollars.toLocaleString()}`;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SkeletonLine({ width, height = 12, color }: { width: string | number; height?: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ width, height, borderRadius: 6, backgroundColor: color, opacity, marginVertical: 3 } as any}
    />
  );
}

export function FinancialSummaryCard() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading } = useGetFinancialSummary();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonLine width="50%" height={13} color={colors.border} />
        <View style={styles.metricsRow}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.metric}>
              <SkeletonLine width={60} height={22} color={colors.border} />
              <SkeletonLine width={80} height={10} color={colors.border} />
            </View>
          ))}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.metricsRow}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.metric}>
              <SkeletonLine width={60} height={16} color={colors.border} />
              <SkeletonLine width={80} height={10} color={colors.border} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!data) return null;

  const { owedToMe, iOwe, totalHosted, totalSpent } = data;
  if (owedToMe === 0 && iOwe === 0 && totalHosted === 0 && totalSpent === 0) return null;

  const hasActive = owedToMe > 0 || iOwe > 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
      onPress={() => router.push("/financial-summary" as any)}
      testID="financial-summary-card"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>💰 Balances</Text>
        <Text style={[styles.seeDetails, { color: colors.primary }]}>See details ›</Text>
      </View>

      {hasActive && (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: "#16A34A" }]}>{fmt(owedToMe)}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>You're owed</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: iOwe > 0 ? "#DC2626" : colors.foreground }]}>{fmt(iOwe)}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>You owe</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </>
      )}

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.lifetimeValue, { color: colors.foreground }]}>{fmt(totalHosted)}</Text>
          <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Total hosted</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.lifetimeValue, { color: colors.foreground }]}>{fmt(totalSpent)}</Text>
          <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Total spent</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  seeDetails: {
    fontSize: 13,
    fontWeight: "500",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    gap: 3,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  lifetimeValue: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    marginVertical: -4,
  },
});
