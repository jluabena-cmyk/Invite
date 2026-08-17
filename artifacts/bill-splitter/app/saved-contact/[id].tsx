import { useGetSavedContactHistory, useDeleteSavedContact, useUpdateSavedContact } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "paid": return "#22C55E";
    case "partial": return "#F59E0B";
    case "unpaid": return "#EF4444";
    default: return "#78716C";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "paid": return "Paid";
    case "partial": return "Partial";
    case "unpaid": return "Unpaid";
    default: return "—";
  }
}

export default function SavedContactScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = parseInt(id ?? "0", 10);

  const { data, isLoading, isError, refetch } = useGetSavedContactHistory(contactId);
  const { mutate: deleteMutate, isPending: isDeleting } = useDeleteSavedContact();
  const { mutate: updateMutate, isPending: isUpdating } = useUpdateSavedContact();

  const [showRename, setShowRename] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const contact = data?.contact;
  const history = data?.history ?? [];

  const handleDelete = () => {
    if (!contact) return;
    Alert.alert(
      "Remove saved contact",
      `Remove "${contact.name}" from your saved contacts? This won't affect past events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            deleteMutate(
              { id: contactId },
              {
                onSuccess: () => router.back(),
              },
            );
          },
        },
      ],
    );
  };

  const handleRename = () => {
    if (!renameInput.trim()) return;
    updateMutate(
      { id: contactId, data: { name: renameInput.trim() } },
      {
        onSuccess: () => {
          setShowRename(false);
          setRenameInput("");
          void refetch();
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !contact) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={[s.errorText, { color: colors.mutedForeground }]}>Contact not found.</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [s.backLink, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[s.backLinkText, { color: colors.primary }]}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={[s.backBtnText, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{contact.name}</Text>
        <Pressable
          onPress={() => { setRenameInput(contact.name); setShowRename(true); }}
          style={({ pressed }) => [s.renameBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          <Text style={[s.renameBtnText, { color: colors.primary }]}>Rename</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={s.avatarSection}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[s.contactName, { color: colors.foreground }]}>{contact.name}</Text>
          <Text style={[s.contactSince, { color: colors.mutedForeground }]}>
            Saved since {formatDate(contact.createdAt)}
          </Text>
        </View>

        {/* Payment summary across events */}
        {history.length > 0 && (() => {
          const totalCents = history.reduce((sum, e) => sum + e.amountCents, 0);
          const paidCents = history.reduce((sum, e) => sum + e.paidCents, 0);
          const outstandingCents = totalCents - paidCents;
          if (totalCents === 0) return null;
          return (
            <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Total owed</Text>
                <Text style={[s.summaryValue, { color: colors.foreground }]}>{formatCents(totalCents)}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Paid</Text>
                <Text style={[s.summaryValue, { color: "#22C55E" }]}>{formatCents(paidCents)}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Outstanding</Text>
                <Text style={[s.summaryValue, { color: outstandingCents > 0 ? "#EF4444" : "#22C55E", fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" }]}>{formatCents(outstandingCents)}</Text>
              </View>
            </View>
          );
        })()}

        {/* Payment history */}
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>Event History</Text>

        {history.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
              {contact.name} hasn't been added to any events yet.
            </Text>
          </View>
        ) : (
          <View style={[s.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {history.map((entry, idx) => (
              <React.Fragment key={entry.participantId}>
                {idx > 0 && <View style={[s.divider, { backgroundColor: colors.border }]} />}
                <View style={s.historyRow}>
                  <View style={s.historyInfo}>
                    <Text style={[s.historyEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {entry.eventTitle}
                    </Text>
                    <Text style={[s.historyEventDate, { color: colors.mutedForeground }]}>
                      {formatDate(entry.eventDate)}
                    </Text>
                  </View>
                  <View style={s.historyRight}>
                    {entry.amountCents > 0 && (
                      <>
                        <Text style={[s.historyAmount, { color: colors.foreground }]}>
                          {formatCents(entry.amountCents)}
                        </Text>
                        <View style={[s.statusBadge, { backgroundColor: statusColor(entry.paymentStatus) + "22" }]}>
                          <Text style={[s.statusText, { color: statusColor(entry.paymentStatus) }]}>
                            {statusLabel(entry.paymentStatus)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Delete button */}
        <Pressable
          style={({ pressed }) => [s.deleteBtn, { opacity: pressed || isDeleting ? 0.6 : 1 }]}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={s.deleteBtnText}>Remove from Saved Contacts</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Rename modal */}
      <Modal
        visible={showRename}
        animationType="fade"
        transparent
        onRequestClose={() => { setShowRename(false); setRenameInput(""); }}
      >
        <View style={s.renameOverlay}>
          <View style={[s.renameModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.renameTitle, { color: colors.foreground }]}>Rename contact</Text>
            <TextInput
              style={[s.renameInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleRename}
              maxLength={80}
            />
            <View style={s.renameActions}>
              <Pressable
                style={({ pressed }) => [s.renameCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setShowRename(false); setRenameInput(""); }}
              >
                <Text style={[s.renameCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.renameSaveBtn, { backgroundColor: colors.primary, opacity: pressed || !renameInput.trim() || isUpdating ? 0.6 : 1 }]}
                onPress={handleRename}
                disabled={!renameInput.trim() || isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.renameSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular" },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, minWidth: 60 },
  backBtnText: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  headerTitle: { fontSize: 16, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600", flex: 1, textAlign: "center" },
  renameBtn: { minWidth: 60, alignItems: "flex-end" },
  renameBtnText: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  content: { padding: 20, gap: 12 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 30, fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  contactName: { fontSize: 22, fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  contactSince: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", lineHeight: 20 },
  historyCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  historyInfo: { flex: 1, gap: 2 },
  historyEventTitle: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  historyEventDate: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  summaryCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  summaryLabel: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" },
  summaryValue: { fontSize: 16, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyAmount: { fontSize: 15, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  divider: { height: 1 },
  deleteBtn: { marginTop: 24, alignItems: "center", paddingVertical: 14 },
  deleteBtnText: { fontSize: 15, color: "#EF4444", fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  renameOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  renameModal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  renameTitle: { fontSize: 17, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  renameInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  renameActions: { flexDirection: "row", gap: 10 },
  renameCancelBtn: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  renameCancelText: { fontSize: 15, fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },
  renameSaveBtn: {
    flex: 1, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  renameSaveText: { fontSize: 15, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600", color: "#fff" },
});
