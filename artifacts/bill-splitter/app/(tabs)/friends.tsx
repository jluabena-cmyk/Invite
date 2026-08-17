import {
  matchPhones,
  useGetFriends,
  useGetUserSuggestions,
  useRemoveFriend,
  useRespondToFriendRequest,
  useSearchUsers,
  useSendFriendRequest,
} from "@workspace/api-client-react";
import type { FriendListItem, MatchedUser, PublicUserProfile, SuggestedUser } from "@workspace/api-client-react";
import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { hashPhone } from "@/utils/hashPhone";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 44 }: { user: PublicUserProfile; size?: number }) {
  const colors = useColors();
  const initials = (user.displayName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (user.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.primaryForeground,
          fontSize: size * 0.38,
          fontWeight: "700",
          fontFamily: "PlusJakartaSans_700Bold",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [contactAppUsers, setContactAppUsers] = useState<MatchedUser[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPermStatus, setContactsPermStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data: friendsData, isLoading: friendsLoading, refetch: refetchFriends } = useGetFriends();
  const { data: suggestionsData, refetch: refetchSuggestions } = useGetUserSuggestions();
  const { data: searchResults, isFetching: searchFetching } = useSearchUsers(debouncedQuery);

  const { mutate: sendRequest } = useSendFriendRequest();
  const { mutate: respond, isPending: responding } = useRespondToFriendRequest();
  const { mutate: remove, isPending: removing } = useRemoveFriend();

  const loadContactAppUsers = useCallback(async () => {
    const { status } = await Contacts.getPermissionsAsync();
    if (status === "denied") {
      setContactsPermStatus("denied");
      return;
    }
    if (status !== "granted") return;
    setContactsPermStatus("granted");
    setContactsLoading(true);
    try {
      const { data: contactData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const hashes: string[] = [];
      await Promise.all(
        contactData
          .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
          .map(async (c) => {
            const raw = c.phoneNumbers?.[0]?.number ?? "";
            const h = await hashPhone(raw);
            if (h) hashes.push(h);
          }),
      );
      if (hashes.length === 0) return;
      const result = await matchPhones({ hashes });
      setContactAppUsers(result.matches);
    } catch {
      // silent — contacts are a best-effort enhancement
    } finally {
      setContactsLoading(false);
    }
  }, []);

  // Refetch every time this tab gains focus
  useFocusEffect(
    useCallback(() => {
      refetchFriends();
      refetchSuggestions();
      void loadContactAppUsers();
    }, [refetchFriends, refetchSuggestions, loadContactAppUsers]),
  );

  const isSearching = debouncedQuery.length >= 2;

  function getRelationship(userId: number): "friends" | "incoming" | "outgoing" | "none" {
    if (!friendsData) return "none";
    if (friendsData.friends.some((f) => f.user.id === userId)) return "friends";
    if (friendsData.incoming.some((f) => f.user.id === userId)) return "incoming";
    if (friendsData.outgoing.some((f) => f.user.id === userId)) return "outgoing";
    return "none";
  }

  function getFriendshipId(userId: number): number | undefined {
    if (!friendsData) return undefined;
    return (
      friendsData.friends.find((f) => f.user.id === userId)?.friendshipId ??
      friendsData.incoming.find((f) => f.user.id === userId)?.friendshipId ??
      friendsData.outgoing.find((f) => f.user.id === userId)?.friendshipId
    );
  }

  function handleAdd(user: PublicUserProfile, source?: string) {
    sendRequest(
      { data: { addresseeId: user.id, ...(source ? { source } : {}) } },
      {
        onSuccess: (data) => {
          if (data.wasIncoming) {
            Alert.alert(
              "Now friends!",
              `${user.displayName} had already sent you a request — you're now friends.`,
            );
          }
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetchFriends();
          refetchSuggestions();
        },
        onError: (err: unknown) => {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: string }).message)
              : "Could not send request";
          Alert.alert("Error", msg);
        },
      },
    );
  }

  function handleAccept(friendshipId: number) {
    respond(
      { friendshipId, data: { action: "accept" } },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetchFriends();
        },
      },
    );
  }

  function handleAcceptFromSearch(friendshipId: number, displayName: string) {
    Alert.alert(
      "Accept friend request?",
      `${displayName} sent you a friend request. Accept it?`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Accept",
          onPress: () => handleAccept(friendshipId),
        },
      ],
    );
  }

  function handleDecline(friendshipId: number) {
    respond(
      { friendshipId, data: { action: "decline" } },
      { onSuccess: () => refetchFriends() },
    );
  }

  function handleRemove(friendshipId: number, displayName: string) {
    Alert.alert(
      "Remove friend",
      `Remove ${displayName} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            remove({ friendshipId }, { onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); refetchFriends(); } }),
        },
      ],
    );
  }

  function handleCancel(friendshipId: number) {
    remove({ friendshipId }, { onSuccess: () => refetchFriends() });
  }

  async function handlePullToRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refetchFriends(), refetchSuggestions()]);
    } finally {
      setRefreshing(false);
    }
  }

  // ── Suggested row ──

  function SuggestedRow({ suggestion }: { suggestion: SuggestedUser }) {
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={suggestion} size={44} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground }]}>{suggestion.displayName}</Text>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{suggestion.handle}</Text>
          {suggestion.sharedEventCount > 0 && (
            <Text style={[styles.sharedEvents, { color: colors.mutedForeground }]}>
              {suggestion.sharedEventCount} shared {suggestion.sharedEventCount === 1 ? "event" : "events"}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.pill, { backgroundColor: colors.primary }]}
          onPress={() =>
            handleAdd(suggestion as PublicUserProfile)
          }
          testID={`suggest-add-btn-${suggestion.id}`}
        >
          <Text style={[styles.pillText, { color: colors.primaryForeground }]}>Add</Text>
        </Pressable>
      </View>
    );
  }

  // ── Search result row ──

  function SearchRow({ user }: { user: PublicUserProfile }) {
    const rel = getRelationship(user.id);
    const fid = getFriendshipId(user.id);

    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={user} size={44} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground }]}>{user.displayName}</Text>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{user.handle}</Text>
        </View>
        {rel === "none" && (
          <Pressable
            style={[styles.pill, { backgroundColor: colors.primary }]}
            onPress={() => handleAdd(user)}
            testID={`add-friend-btn-${user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.primaryForeground }]}>Add Friend</Text>
          </Pressable>
        )}
        {rel === "outgoing" && (
          <View
            style={[styles.pill, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            testID={`request-sent-badge-${user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.mutedForeground }]}>Request Sent</Text>
          </View>
        )}
        {rel === "incoming" && fid !== undefined && (
          <Pressable
            style={[styles.pill, { backgroundColor: colors.primary }]}
            onPress={() => handleAcceptFromSearch(fid, user.displayName)}
            disabled={responding}
            testID={`accept-request-btn-${user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.primaryForeground }]}>Accept Request</Text>
          </Pressable>
        )}
        {rel === "friends" && (
          <View
            style={[styles.pill, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            testID={`friends-badge-${user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.mutedForeground }]}>Friends</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Incoming request row ──

  function IncomingRow({ item }: { item: FriendListItem }) {
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={item.user} size={44} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground }]}>{item.user.displayName}</Text>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{item.user.handle}</Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            style={[styles.pill, { backgroundColor: colors.primary }]}
            onPress={() => handleAccept(item.friendshipId)}
            disabled={responding}
            testID={`accept-btn-${item.user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.primaryForeground }]}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.pill, styles.pillOutline, { borderColor: colors.border }]}
            onPress={() => handleDecline(item.friendshipId)}
            disabled={responding}
            testID={`decline-btn-${item.user.id}`}
          >
            <Text style={[styles.pillText, { color: colors.foreground }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Contact app user row ──

  function ContactRow({ match }: { match: MatchedUser }) {
    const rel = getRelationship(match.id);
    const user: PublicUserProfile = {
      id: match.id,
      displayName: match.displayName,
      handle: match.handle,
      avatarUrl: match.avatarUrl,
      bio: match.bio,
    };
    if (rel === "friends" || rel === "incoming" || rel === "outgoing") return null;
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={user} size={44} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground }]}>{match.displayName}</Text>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{match.handle}</Text>
        </View>
        <Pressable
          style={[styles.pill, { backgroundColor: colors.primary }]}
          onPress={() => handleAdd(user, "contact_match")}
          testID={`contact-add-btn-${match.id}`}
        >
          <Text style={[styles.pillText, { color: colors.primaryForeground }]}>Add</Text>
        </Pressable>
      </View>
    );
  }

  // ── Friend row ──

  function FriendRow({ item }: { item: FriendListItem }) {
    const isContactMatch = item.source === "contact_match";
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={item.user} size={44} />
        <View style={styles.rowInfo}>
          <View style={styles.rowNameRow}>
            <Text style={[styles.rowName, { color: colors.foreground }]}>{item.user.displayName}</Text>
            {isContactMatch && (
              <View style={[styles.contactBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={10} color={colors.mutedForeground} />
                <Text style={[styles.contactBadgeText, { color: colors.mutedForeground }]}>From contacts</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{item.user.handle}</Text>
        </View>
        <Pressable
          style={[styles.pill, styles.pillOutline, { borderColor: colors.border }]}
          onPress={() => handleRemove(item.friendshipId, item.user.displayName)}
          disabled={removing}
          testID={`remove-friend-btn-${item.user.id}`}
        >
          <Text style={[styles.pillText, { color: colors.mutedForeground }]}>Remove</Text>
        </Pressable>
      </View>
    );
  }

  // ── Outgoing row ──

  function OutgoingRow({ item }: { item: FriendListItem }) {
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <UserAvatar user={item.user} size={44} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: colors.foreground }]}>{item.user.displayName}</Text>
          <Text style={[styles.rowHandle, { color: colors.mutedForeground }]}>@{item.user.handle}</Text>
        </View>
        <Pressable
          style={[styles.pill, styles.pillOutline, { borderColor: colors.border }]}
          onPress={() => handleCancel(item.friendshipId)}
          disabled={removing}
          testID={`cancel-request-btn-${item.user.id}`}
        >
          <Text style={[styles.pillText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const hasFriends = (friendsData?.friends.length ?? 0) > 0;
  const hasIncoming = (friendsData?.incoming.length ?? 0) > 0;
  const hasOutgoing = (friendsData?.outgoing.length ?? 0) > 0;
  const suggestions = (suggestionsData ?? []).slice(0, 5);
  const hasSuggestions = suggestions.length > 0;
  const allRelatedIds = new Set([
    ...(friendsData?.friends ?? []).map((f) => f.user.id),
    ...(friendsData?.incoming ?? []).map((f) => f.user.id),
    ...(friendsData?.outgoing ?? []).map((f) => f.user.id),
  ]);
  const eligibleContactUsers = contactAppUsers.filter((u) => !allRelatedIds.has(u.id));
  const hasContactUsers = eligibleContactUsers.length > 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Friends</Text>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.searchIcon, { color: colors.mutedForeground }]}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by name or @handle"
            placeholderTextColor={colors.mutedForeground}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            testID="friend-search-input"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText("")} testID="clear-search-btn">
              <Text style={[styles.clearBtn, { color: colors.mutedForeground }]}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      {isSearching ? (
        <FlatList
          data={searchResults ?? []}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => <SearchRow user={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          testID="search-results-list"
          ListHeaderComponent={
            searchFetching ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
            ) : null
          }
          ListEmptyComponent={
            !searchFetching ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No users found
              </Text>
            ) : null
          }
        />
      ) : friendsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ""}
          renderItem={null}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          testID="friends-list"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              {hasContactUsers && (
                <>
                  <SectionHeader label="PEOPLE YOU MAY KNOW" />
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {eligibleContactUsers.map((match) => (
                      <ContactRow key={match.id} match={match} />
                    ))}
                  </View>
                </>
              )}
              {contactsLoading && !hasContactUsers && (
                <ActivityIndicator style={{ marginTop: 8 }} color={colors.primary} />
              )}
              {contactsPermStatus === "denied" && !hasFriends && (
                <Pressable
                  style={[styles.contactsDeniedBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => void Linking.openSettings()}
                  testID="contacts-denied-banner"
                >
                  <Ionicons name="lock-closed-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.contactsDeniedText, { color: colors.mutedForeground }]}>
                    Contacts access is off — enable it in{" "}
                    <Text style={{ color: colors.primary, textDecorationLine: "underline" }}>Settings</Text>{" "}
                    to find friends automatically.
                  </Text>
                </Pressable>
              )}

              {hasSuggestions && (
                <>
                  <SectionHeader label="SUGGESTED" />
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {suggestions.map((suggestion) => (
                      <SuggestedRow key={suggestion.id} suggestion={suggestion} />
                    ))}
                  </View>
                </>
              )}

              {hasIncoming && (
                <>
                  <SectionHeader label="REQUESTS" />
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {friendsData!.incoming.map((item) => (
                      <IncomingRow key={item.friendshipId} item={item} />
                    ))}
                  </View>
                </>
              )}

              {hasFriends && (
                <>
                  <SectionHeader label="FRIENDS" />
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {friendsData!.friends.map((item) => (
                      <FriendRow key={item.friendshipId} item={item} />
                    ))}
                  </View>
                </>
              )}

              {hasOutgoing && (
                <>
                  <SectionHeader label="SENT" />
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {friendsData!.outgoing.map((item) => (
                      <OutgoingRow key={item.friendshipId} item={item} />
                    ))}
                  </View>
                </>
              )}

              {!hasFriends && !hasIncoming && !hasOutgoing && !hasSuggestions && !hasContactUsers && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>👥</Text>
                  <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>
                    No friends yet
                  </Text>
                  <Text style={[styles.emptyStateHint, { color: colors.mutedForeground }]}>
                    Search by name or @handle above, or sync your contacts to find people you know.
                  </Text>
                  {contactsPermStatus !== "denied" && contactsPermStatus !== "granted" && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.emptyStateCta,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                      ]}
                      onPress={async () => {
                        const { status } = await Contacts.requestPermissionsAsync();
                        if (status === "granted") {
                          setContactsPermStatus("granted");
                          void loadContactAppUsers();
                        } else {
                          setContactsPermStatus("denied");
                        }
                      }}
                      testID="sync-contacts-btn"
                    >
                      <Ionicons name="people-outline" size={15} color="#fff" />
                      <Text style={styles.emptyStateCtaText}>Sync Contacts</Text>
                    </Pressable>
                  )}
                  {contactsPermStatus === "denied" && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.emptyStateCta,
                        { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                      ]}
                      onPress={() => void Linking.openSettings()}
                    >
                      <Ionicons name="settings-outline" size={15} color={colors.mutedForeground} />
                      <Text style={[styles.emptyStateCtaText, { color: colors.mutedForeground }]}>Open Settings</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  clearBtn: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  rowHandle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  sharedEvents: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 1,
  },
  rowActions: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillOutline: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyStateHint: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyStateEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyStateCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 6,
  },
  emptyStateCtaText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#fff",
  },
  contactsDeniedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  contactsDeniedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 19,
  },
  rowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  contactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  contactBadgeText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
