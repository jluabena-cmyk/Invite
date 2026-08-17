import { useGetCancelledEvents } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CancelledEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const { data: events, isLoading } = useGetCancelledEvents();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.back()}
          testID="back-button"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cancelled Events</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !events?.length ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No cancelled events
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Dismissed cancelled events will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {events.map((item) => {
              const roleLabel =
                item.role === "host" ? "Host" : item.role === "participant" ? "You" : "Accepted";
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.eventCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.6 : 0.72,
                    },
                  ]}
                  onPress={() => router.push(`/event/${item.id}`)}
                  testID={`cancelled-event-card-${item.id}`}
                >
                  <View style={styles.eventTitleRow}>
                    <Text
                      style={[styles.eventTitle, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <View style={[styles.cancelledBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.cancelledBadgeText, { color: colors.destructive }]}>
                        Cancelled
                      </Text>
                    </View>
                  </View>

                  {!!item.restaurantName && (
                    <Text style={[styles.eventRestaurant, { color: colors.mutedForeground }]}>
                      {item.restaurantName}
                    </Text>
                  )}

                  {!!item.cancelledAt && (
                    <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                      Cancelled {formatDate(item.cancelledAt)}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={[styles.roleChip, { borderColor: colors.border }]}>
                      <Text style={[styles.roleChipText, { color: colors.mutedForeground }]}>
                        {roleLabel}
                      </Text>
                    </View>
                    {item.startsAt && (
                      <Text style={[styles.eventDateFormatted, { color: colors.mutedForeground }]}>
                        {formatDate(item.startsAt)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 12, minWidth: 70 },
  backText: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
  },
  headerSpacer: { minWidth: 70 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  list: { gap: 12 },
  eventCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 5 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventTitle: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", flex: 1 },
  cancelledBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  cancelledBadgeText: { fontSize: 10, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  eventRestaurant: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  eventDate: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  eventDateFormatted: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  roleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  roleChipText: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
});
