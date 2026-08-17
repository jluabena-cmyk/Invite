import { useAuth, useUser } from "@clerk/expo";
import { useJoinEvent, useUpdateCurrentUser } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface EventPreview {
  eventId: number;
  eventName: string;
  hostDisplayName: string;
  participantCount: number;
  startsAt?: string | null;
  restaurantName?: string | null;
}

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { mutate: joinEvent, isPending: isJoining } = useJoinEvent();
  const { mutate: updateUser, isPending: isUpdatingName } = useUpdateCurrentUser();

  useEffect(() => {
    if (!code) {
      setPreviewError("Invalid invite link.");
      setPreviewLoading(false);
      return;
    }
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const baseUrl = domain ? `https://${domain}` : "";
    fetch(`${baseUrl}/api/join/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const json = await r.json() as unknown;
        if (!r.ok) throw new Error((json as { error?: string })?.error ?? "Invalid invite link.");
        return json as EventPreview;
      })
      .then(setPreview)
      .catch((e: Error) => setPreviewError(e.message ?? "This invite link is invalid or has expired."))
      .finally(() => setPreviewLoading(false));
  }, [code]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace(`/(auth)/sign-in?redirect=${encodeURIComponent(`/join/${code ?? ""}`)}` as Href);
    }
  }, [isLoaded, isSignedIn, code]);

  useEffect(() => {
    if (user && !nameInitialized) {
      setDisplayName(user.firstName ?? "");
      setNameInitialized(true);
    }
  }, [user, nameInitialized]);

  const handleJoin = () => {
    setJoinError(null);
    const name = displayName.trim();

    const doJoin = () => {
      joinEvent(
        { data: { joinCode: code ?? "" } },
        {
          onSuccess: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (preview) {
              router.replace(`/event/${preview.eventId}` as Href);
            } else {
              router.replace("/(tabs)" as Href);
            }
          },
          onError: (err) => {
            const msg = (err as { message?: string })?.message ?? "";
            if (msg.includes("Already joined") && preview) {
              router.replace(`/event/${preview.eventId}` as Href);
              return;
            }
            setJoinError(msg || "Failed to join. Please try again.");
          },
        },
      );
    };

    if (name) {
      updateUser({ data: { displayName: name } }, { onSettled: () => doJoin() });
    } else {
      doJoin();
    }
  };

  if (!isLoaded || (isLoaded && !isSignedIn)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (previewLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (previewError || !preview) {
    const isCancelledError = previewError?.toLowerCase().includes("cancelled") ?? false;
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingHorizontal: 32 }]}>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          {isCancelledError ? "Event cancelled" : "Invite not found"}
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>
          {isCancelledError
            ? "This event has been cancelled by the host."
            : (previewError ?? "This invite link is invalid or has expired.")}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 24 },
          ]}
          onPress={() => router.replace("/(tabs)" as Href)}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: colors.mutedForeground }]}>
        You&apos;ve been invited
      </Text>

      <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eventName, { color: colors.foreground }]}>{preview.eventName}</Text>
        <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
          Hosted by {preview.hostDisplayName}
        </Text>
        {preview.restaurantName ? (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            📍 {preview.restaurantName}
          </Text>
        ) : null}
        {preview.startsAt ? (
          <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
            📅{" "}
            {new Date(preview.startsAt).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {" · "}
            {new Date(preview.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </Text>
        ) : null}
        <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
          {preview.participantCount}{" "}
          {preview.participantCount === 1 ? "person" : "people"} already in
        </Text>
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Your display name</Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
        ]}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="How should friends call you?"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
      />
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        You can update this any time from your profile.
      </Text>

      {joinError ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{joinError}</Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: colors.primary, opacity: pressed || isJoining || isUpdatingName ? 0.85 : 1 },
          (isJoining || isUpdatingName) && styles.disabled,
        ]}
        onPress={handleJoin}
        disabled={isJoining || isUpdatingName}
        testID="join-event-btn"
      >
        {isJoining || isUpdatingName ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Join {preview.eventName}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 32,
    gap: 6,
  },
  eventName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  metaLine: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 12,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  disabled: {
    opacity: 0.5,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
