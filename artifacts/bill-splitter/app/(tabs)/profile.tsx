import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useUpdateCurrentUser,
  useUploadAvatar,
  useGetSavedContacts,
  useDeleteSavedContact,
  useUpdateSavedContact,
  getGetCurrentUserQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";
import type { SavedContact } from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { maskZelle, isValidZelleInfo, isValidCashAppHandle, isValidVenmoHandle } from "@/utils/maskZelle";
import { useSubscription } from "@/lib/revenuecat";
import { PaywallModal } from "@/components/PaywallModal";

export default function ProfileScreen() {
  const colors = useColors();
  const { isSubscribed, hostedEventsSent, freeEventLimit, premiumExpiresAt, activePlanType, refetchServerSub } = useSubscription();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openPaywall } = useLocalSearchParams<{ openPaywall?: string }>();

  useEffect(() => {
    if (openPaywall === "1") setShowPaywallModal(true);
  }, [openPaywall]);

  const { data: profile, isLoading, refetch } = useGetCurrentUser();
  const { mutate: updateProfile, isPending: isSaving } = useUpdateCurrentUser();
  const { mutate: uploadAvatarMutate, isPending: isUploadingAvatar } = useUploadAvatar();
  const { getToken, signOut } = useAuth();
  const { data: savedContactsData, refetch: refetchSavedContacts } = useGetSavedContacts();
  const { mutate: deleteSavedContactMutate } = useDeleteSavedContact();
  const { mutate: updateSavedContactMutate } = useUpdateSavedContact();
  const [renamingContact, setRenamingContact] = useState<SavedContact | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<string | null>(null);
  const [zelleInfo, setZelleInfo] = useState("");
  const [cashAppVerified, setCashAppVerified] = useState(false);
  const [venmoVerified, setVenmoVerified] = useState(false);
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [zelleTouched, setZelleTouched] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [phoneRemovedFeedback, setPhoneRemovedFeedback] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const cashRef = useRef<TextInput>(null);
  const venmoRef = useRef<TextInput>(null);
  const zelleRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setHandle(profile.handle ?? "");
      setBio(profile.bio ?? "");
      setCashAppHandle(profile.cashAppHandle ?? "");
      setVenmoHandle(profile.venmoHandle ?? "");
      setPreferredPaymentMethod(profile.preferredPaymentMethod ?? null);
      setZelleInfo(profile.zelleInfo ?? "");
      setCashAppVerified(profile.cashAppVerified ?? false);
      setVenmoVerified(profile.venmoVerified ?? false);
    }
  }, [profile]);

  const isDirty =
    displayName.trim() !== (profile?.displayName ?? "").trim() ||
    handle.trim().toLowerCase() !== (profile?.handle ?? "").toLowerCase() ||
    bio.trim() !== (profile?.bio ?? "").trim() ||
    cashAppHandle.trim() !== (profile?.cashAppHandle ?? "").trim() ||
    venmoHandle.trim() !== (profile?.venmoHandle ?? "").trim() ||
    preferredPaymentMethod !== (profile?.preferredPaymentMethod ?? null) ||
    zelleInfo.trim() !== (profile?.zelleInfo ?? "").trim() ||
    (phoneNumber.trim().replace(/\D/g, "") !== "" &&
      phoneNumber.trim().replace(/\D/g, "") !== (profile?.phoneNumber ?? "").replace(/\D/g, ""));

  const zelleIsInvalid =
    zelleTouched && zelleInfo.trim().length > 0 && !isValidZelleInfo(zelleInfo.trim());

  const savedZelleIsInvalid =
    !!profile?.zelleInfo &&
    !isValidZelleInfo(profile.zelleInfo) &&
    zelleInfo.trim() === (profile?.zelleInfo ?? "").trim();

  const savedCashAppIsInvalid =
    !!profile?.cashAppHandle &&
    !isValidCashAppHandle(profile.cashAppHandle) &&
    cashAppHandle.trim() === (profile?.cashAppHandle ?? "").trim();

  const savedVenmoIsInvalid =
    !!profile?.venmoHandle &&
    !isValidVenmoHandle(profile.venmoHandle) &&
    venmoHandle.trim() === (profile?.venmoHandle ?? "").trim();

  const hashPhoneForProfile = async (raw: string): Promise<string | null> => {
    const digits = raw.replace(/\D/g, "");
    const normalized =
      digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (normalized.length < 7) return null;
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;
    if (zelleInfo.trim() && !isValidZelleInfo(zelleInfo.trim())) {
      setZelleTouched(true);
      return;
    }
    const rawPhone = phoneNumber.trim();
    const phoneNumberHash = rawPhone ? await hashPhoneForProfile(rawPhone) : undefined;
    updateProfile(
      {
        data: {
          displayName: displayName.trim(),
          handle: handle.trim().toLowerCase(),
          bio: bio.trim(),
          cashAppHandle: cashAppHandle.trim(),
          venmoHandle: venmoHandle.trim(),
          preferredPaymentMethod: preferredPaymentMethod,
          zelleInfo: zelleInfo.trim() || null,
          cashAppVerified,
          venmoVerified,
          ...(phoneNumberHash !== undefined ? { phoneNumberHash } : {}),
          ...(rawPhone !== "" ? { phoneNumber: rawPhone || null } : {}),
        },
      },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPhoneNumber("");
          setPhoneError(null);
          setEditingPhone(false);
          setSavedFeedback(true);
          void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          setTimeout(() => setSavedFeedback(false), 2000);
        },
        onError: (err: unknown) => {
          const errObj = err as { status?: number; data?: { error?: string }; message?: string };
          if (errObj.status === 409 && errObj.data?.error?.toLowerCase().includes("phone")) {
            setPhoneError("That phone number is already associated with another account.");
            return;
          }
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: string }).message)
              : "Could not save profile";
          Alert.alert("Save failed", msg);
        },
      },
    );
  };

  const handleRemovePhone = () => {
    Alert.alert(
      "Remove phone number",
      "Your phone number will be removed. Hosts won't be able to text you payment reminders directly, and you won't appear in contact-based suggestions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            updateProfile(
              { data: { phoneNumberHash: null, phoneNumber: null } },
              {
                onSuccess: () => {
                  setPhoneNumber("");
                  setPhoneError(null);
                  setPhoneRemovedFeedback(true);
                  setTimeout(() => setPhoneRemovedFeedback(false), 2500);
                  refetch();
                },
                onError: (err: unknown) => {
                  const msg =
                    err && typeof err === "object" && "message" in err
                      ? String((err as { message: string }).message)
                      : "Could not remove phone number";
                  Alert.alert("Error", msg);
                },
              },
            );
          },
        },
      ],
    );
  };

  const handleDeleteSavedContact = (contact: SavedContact) => {
    Alert.alert(
      "Remove saved contact",
      `Remove "${contact.name}" from your saved contacts? This won't affect past events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            deleteSavedContactMutate(
              { id: contact.id },
              { onSuccess: () => void refetchSavedContacts() },
            );
          },
        },
      ],
    );
  };

  const handleRenameSavedContact = () => {
    if (!renamingContact || !renameInput.trim()) return;
    updateSavedContactMutate(
      { id: renamingContact.id, data: { name: renameInput.trim() } },
      {
        onSuccess: () => {
          setRenamingContact(null);
          setRenameInput("");
          void refetchSavedContacts();
        },
      },
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your profile, all events you host, receipts, and payment info. There is no undo.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, delete my account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Your account cannot be recovered after deletion. Type of data removed: events, receipts, friendships, messages, payment info.",
              [
                { text: "Go back", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      const token = await getToken();
                      const base = getBaseUrl();
                      const res = await fetch(`${base}/users/me`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) throw new Error("Server error");
                      await signOut();
                    } catch {
                      setIsDeletingAccount(false);
                      Alert.alert("Error", "Could not delete account. Please try again or contact support@owmo.app.");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photos to set a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // Compress to 512 px square JPEG before upload so the payload clears the proxy limit
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const formData = new FormData();
    formData.append("image", { uri: compressed.uri, type: "image/jpeg", name: "avatar.jpg" } as unknown as Blob);
    uploadAvatarMutate(formData, {
      onSuccess: () => refetch(),
      onError: () =>
        Alert.alert("Upload failed", "Could not upload profile picture. Please try again."),
    });
  };

  const initials = (profile?.displayName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>

        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
            style={({ pressed }) => [
              styles.avatarWrapper,
              { opacity: pressed || isUploadingAvatar ? 0.75 : 1 },
            ]}
          >
            {isUploadingAvatar ? (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={[styles.avatar, { borderColor: colors.border }]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.avatarInitials, { color: colors.primaryForeground }]}>
                  {initials}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.editBadge,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.editBadgeText, { color: colors.foreground }]}>✎</Text>
            </View>
          </Pressable>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
            Tap to change photo
          </Text>
          <Pressable
            onPress={() => setShowPreview(true)}
            style={({ pressed }) => [styles.previewProfileBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
            testID="preview-profile-btn"
          >
            <Text style={[styles.previewProfileBtnText, { color: colors.mutedForeground }]}>👁 Preview as others see you</Text>
          </Pressable>
        </View>

        {/* ── Info card ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.valueText, { color: colors.foreground }]}>
              {profile?.email ?? "—"}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Display name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => handleRef.current?.focus()}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Handle</Text>
            <View style={styles.prefixRow}>
              <Text style={[styles.prefix, { color: colors.mutedForeground }]}>@</Text>
              <TextInput
                ref={handleRef}
                style={[
                  styles.input,
                  styles.prefixInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                value={handle}
                onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="yourhandle"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => bioRef.current?.focus()}
              />
            </View>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
              3–20 chars, letters, numbers, underscores. No leading/trailing _.
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Bio</Text>
            <TextInput
              ref={bioRef}
              style={[
                styles.input,
                styles.inputMultiline,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 200))}
              placeholder="A short bio..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              returnKeyType="next"
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {bio.length}/200
            </Text>
          </View>
        </View>

        {/* ── Payment handles ── */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Payment
        </Text>
        <Text style={[styles.sectionSubLabel, { color: colors.mutedForeground }]} testID="payment-section-sublabel">
          Add all your payment handles so any guest can pay you
        </Text>
        {!(
          (preferredPaymentMethod === "cash_app" && cashAppHandle.trim() && cashAppVerified) ||
          (preferredPaymentMethod === "venmo" && venmoHandle.trim() && venmoVerified) ||
          (preferredPaymentMethod === "zelle" && zelleInfo.trim())
        ) && (
        <View style={[styles.paymentCallout, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" }]} testID="payment-section-hint">
          <Text style={styles.paymentCalloutIcon}>⚡</Text>
          <View style={styles.paymentCalloutBody}>
            <Text style={[styles.paymentCalloutTitle, { color: colors.primary }]}>How collect works</Text>
            <Text style={[styles.paymentCalloutText, { color: colors.mutedForeground }]}>
              When you split a bill, Owmo generates a prefilled payment request to each guest's Venmo or Cash App. They just tap pay — no awkward asking.
            </Text>
            <Text style={[styles.paymentCalloutText, { color: colors.mutedForeground, marginTop: 6 }]}>
              Your handle needs to be correct so requests reach the right account. Use the verify button after saving.
            </Text>
          </View>
        </View>
        )}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Preferred method */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Preferred method</Text>
            <View style={styles.pillRow}>
              {(["none", "cash_app", "venmo", "zelle"] as const).map((method) => {
                const labels: Record<string, string> = {
                  none: "None",
                  cash_app: "Cash App",
                  venmo: "Venmo",
                  zelle: "Zelle",
                };
                const isSelected =
                  method === "none"
                    ? preferredPaymentMethod === null
                    : preferredPaymentMethod === method;
                return (
                  <Pressable
                    key={method}
                    style={({ pressed }) => [
                      styles.pill,
                      isSelected
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                      pressed && !isSelected && { opacity: 0.7 },
                    ]}
                    onPress={() =>
                      setPreferredPaymentMethod(method === "none" ? null : method)
                    }
                    testID={`preferred-method-${method}`}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: isSelected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {labels[method]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Cash App */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Cash App</Text>
              {cashAppVerified && cashAppHandle.trim() ? (
                <Text style={[styles.verifiedBadge, { color: "#10B981" }]}>✓ Verified</Text>
              ) : cashAppHandle.trim() && !savedCashAppIsInvalid ? (
                <Pressable
                  onPress={() => {
                    Linking.openURL(`https://cash.app/$${cashAppHandle.trim().replace(/^\$+/, "")}`);
                    setTimeout(() => {
                      Alert.alert(
                        "Verify Cash App",
                        "Did your Cash App profile open correctly?",
                        [
                          { text: "No", style: "cancel" },
                          {
                            text: "Yes, verified",
                            onPress: () => {
                              setCashAppVerified(true);
                              updateProfile({ data: { cashAppVerified: true } });
                            },
                          },
                        ]
                      );
                    }, 800);
                  }}
                  testID="cash-app-verify-button"
                >
                  <Text style={[styles.verifyLink, { color: colors.primary }]}>Verify →</Text>
                </Pressable>
              ) : null}
            </View>
            {savedCashAppIsInvalid && (
              <Pressable
                style={styles.zelleWarningBanner}
                onPress={() => cashRef.current?.focus()}
                testID="cash-app-invalid-warning"
              >
                <Text style={styles.zelleWarningIcon}>⚠️</Text>
                <View style={styles.zelleWarningBody}>
                  <Text style={styles.zelleWarningTitle}>Guests can't use your Cash App handle</Text>
                  <Text style={styles.zelleWarningSubtitle}>
                    The saved value isn't a valid cashtag. Tap to fix it.
                  </Text>
                </View>
              </Pressable>
            )}
            <View style={styles.prefixRow}>
              <Text style={[styles.prefix, { color: colors.mutedForeground }]}>$</Text>
              <TextInput
                ref={cashRef}
                style={[
                  styles.input,
                  styles.prefixInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                value={cashAppHandle}
                onChangeText={(t) => { setCashAppHandle(t); setCashAppVerified(false); }}
                placeholder="cashtag"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => venmoRef.current?.focus()}
                testID="cash-app-handle-input"
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Venmo */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Venmo</Text>
              {venmoVerified && venmoHandle.trim() ? (
                <Text style={[styles.verifiedBadge, { color: "#10B981" }]}>✓ Verified</Text>
              ) : venmoHandle.trim() && !savedVenmoIsInvalid ? (
                <Pressable
                  onPress={() => {
                    Linking.openURL(`https://venmo.com/u/${venmoHandle.trim().replace(/^@+/, "")}`);
                    setTimeout(() => {
                      Alert.alert(
                        "Verify Venmo",
                        "Did your Venmo profile open correctly?",
                        [
                          { text: "No", style: "cancel" },
                          {
                            text: "Yes, verified",
                            onPress: () => {
                              setVenmoVerified(true);
                              updateProfile({ data: { venmoVerified: true } });
                            },
                          },
                        ]
                      );
                    }, 800);
                  }}
                  testID="venmo-verify-button"
                >
                  <Text style={[styles.verifyLink, { color: colors.primary }]}>Verify →</Text>
                </Pressable>
              ) : null}
            </View>
            {savedVenmoIsInvalid && (
              <Pressable
                style={styles.zelleWarningBanner}
                onPress={() => venmoRef.current?.focus()}
                testID="venmo-invalid-warning"
              >
                <Text style={styles.zelleWarningIcon}>⚠️</Text>
                <View style={styles.zelleWarningBody}>
                  <Text style={styles.zelleWarningTitle}>Guests can't use your Venmo handle</Text>
                  <Text style={styles.zelleWarningSubtitle}>
                    The saved value isn't a valid Venmo username. Tap to fix it.
                  </Text>
                </View>
              </Pressable>
            )}
            <View style={styles.prefixRow}>
              <Text style={[styles.prefix, { color: colors.mutedForeground }]}>@</Text>
              <TextInput
                ref={venmoRef}
                style={[
                  styles.input,
                  styles.prefixInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                value={venmoHandle}
                onChangeText={(t) => { setVenmoHandle(t); setVenmoVerified(false); }}
                placeholder="username"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => zelleRef.current?.focus()}
                testID="venmo-handle-input"
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Zelle */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Zelle</Text>
            {savedZelleIsInvalid && (
              <Pressable
                style={styles.zelleWarningBanner}
                onPress={() => zelleRef.current?.focus()}
                testID="zelle-invalid-warning"
              >
                <Text style={styles.zelleWarningIcon}>⚠️</Text>
                <View style={styles.zelleWarningBody}>
                  <Text style={styles.zelleWarningTitle}>Guests can't read your Zelle info</Text>
                  <Text style={styles.zelleWarningSubtitle}>
                    The saved value isn't a valid phone number or email address. Tap to fix it.
                  </Text>
                </View>
              </Pressable>
            )}
            <TextInput
              ref={zelleRef}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: zelleIsInvalid ? "#EF4444" : colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={zelleInfo}
              onChangeText={setZelleInfo}
              onBlur={() => setZelleTouched(true)}
              placeholder="Phone or email"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              testID="zelle-info-input"
            />
            {zelleIsInvalid ? (
              <Text style={[styles.fieldHint, { color: "#EF4444" }]}>
                Enter a valid phone number or email address linked to your Zelle account.
              </Text>
            ) : (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                Your phone number or email address linked to Zelle (not a username). Guests will see this to send payment.
              </Text>
            )}
          </View>

        </View>

        {/* ── Phone number (for contact recognition) ── */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Contact recognition (optional)
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Phone number</Text>
            </View>

            {/* Saved state — show when a number is stored and not actively editing */}
            {profile?.phoneNumberHash && !editingPhone && !phoneRemovedFeedback ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.background }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 15, color: "#10B981", fontWeight: "600" }}>✓</Text>
                  <Text style={{ fontSize: 15, color: colors.foreground }}>Number saved</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <TouchableOpacity onPress={() => { setPhoneNumber(profile?.phoneNumber ?? ""); setEditingPhone(true); setTimeout(() => phoneRef.current?.focus(), 50); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRemovePhone} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="remove-phone-button">
                    <Text style={{ fontSize: 14, color: "#EF4444", fontWeight: "500" }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Input state — show when no number saved, or user tapped Change */
              <>
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, {
                    color: colors.foreground,
                    borderColor: phoneError ? "#EF4444" : colors.border,
                    backgroundColor: colors.background,
                  }]}
                  value={phoneNumber}
                  onChangeText={(v) => { setPhoneNumber(v); setPhoneError(null); }}
                  placeholder="e.g. (555) 123-4567"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  testID="phone-number-input"
                />
                {editingPhone && (
                  <TouchableOpacity onPress={() => { setEditingPhone(false); setPhoneNumber(""); setPhoneError(null); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {phoneRemovedFeedback && (
              <Text style={[styles.fieldHint, { color: "#10B981" }]}>✓ Phone number removed</Text>
            )}
            {phoneError ? (
              <Text style={[styles.fieldHint, { color: "#EF4444" }]}>{phoneError}</Text>
            ) : !profile?.phoneNumberHash || editingPhone ? (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                Used so hosts can send you a direct payment reminder. Your contacts on the app will also appear as suggestions.
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Save button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            (!isDirty || isSaving || zelleIsInvalid) && styles.saveBtnDisabled,
          ]}
          onPress={handleSave}
          disabled={!isDirty || isSaving || zelleIsInvalid}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
              {savedFeedback ? "Saved" : "Save changes"}
            </Text>
          )}
        </Pressable>

        {/* ── Saved Contacts ── */}
        {(savedContactsData?.contacts ?? []).length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 32 }]}>
              Saved Contacts
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(savedContactsData?.contacts ?? []).map((contact, idx) => (
                <React.Fragment key={contact.id}>
                  {idx > 0 && <View style={[styles.accountRowDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.accountRow}>
                    <View style={[styles.savedContactAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.savedContactAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/saved-contact/${contact.id}` as never)}
                    >
                      <Text style={[styles.accountRowText, { color: colors.foreground }]}>{contact.name}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setRenamingContact(contact); setRenameInput(contact.name); }}
                      style={({ pressed }) => [styles.savedContactAction, { opacity: pressed ? 0.5 : 1 }]}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 13, color: colors.primary, fontFamily: "PlusJakartaSans_500Medium" }}>Rename</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteSavedContact(contact)}
                      style={({ pressed }) => [styles.savedContactAction, { opacity: pressed ? 0.5 : 1 }]}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 13, color: "#EF4444", fontFamily: "PlusJakartaSans_500Medium" }}>Remove</Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ── Subscription ── */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 32 }]}>
          Subscription
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.accountRow}>
            <View style={{ flex: 1 }}>
              {isSubscribed ? (
                <>
                  <Text style={[styles.accountRowText, { color: colors.foreground }]}>
                    {activePlanType === "annual" ? "Premium — Annual ✦" : "Premium — Monthly ✦"}
                  </Text>
                  {premiumExpiresAt && (
                    <Text style={[styles.subscriptionSubtext, { color: colors.mutedForeground }]}>
                      Renews {new Date(premiumExpiresAt).toLocaleDateString()}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={[styles.accountRowText, { color: colors.foreground }]}>Free Plan</Text>
                  <Text style={[styles.subscriptionSubtext, { color: colors.mutedForeground }]}>
                    {hostedEventsSent} of {freeEventLimit ?? "—"} free events used
                  </Text>
                </>
              )}
            </View>
            {isSubscribed ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => void Linking.openURL("itms-apps://apps.apple.com/account/subscriptions")}
              >
                <Text style={[styles.subscriptionActionText, { color: colors.primary }]}>Manage</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowPaywallModal(true)}
                testID="upgrade-button"
              >
                <Text style={[styles.subscriptionActionText, { color: colors.primary }]}>Upgrade →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Account / legal ── */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 32 }]}>
          Account
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => {
              const url = Constants.expoConfig?.extra?.privacyPolicyUrl as string | null | undefined;
              if (url) {
                void WebBrowser.openBrowserAsync(url);
              }
            }}
            testID="privacy-policy-link"
            activeOpacity={0.7}
          >
            <Text style={[styles.accountRowText, { color: colors.foreground }]}>Privacy Policy</Text>
            <Text style={[styles.accountRowChevron, { color: colors.mutedForeground }]}>›</Text>
          </TouchableOpacity>
          <View style={[styles.accountRowDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => {
              const url = Constants.expoConfig?.extra?.termsUrl as string | null | undefined;
              if (url) {
                void WebBrowser.openBrowserAsync(url);
              }
            }}
            testID="terms-of-service-link"
            activeOpacity={0.7}
          >
            <Text style={[styles.accountRowText, { color: colors.foreground }]}>Terms of Service</Text>
            <Text style={[styles.accountRowChevron, { color: colors.mutedForeground }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Danger Zone ── */}
        <Text style={[styles.sectionLabel, { color: "#EF4444", marginTop: 28, opacity: 0.8 }]}>
          Danger Zone
        </Text>
        <View style={[styles.card, { backgroundColor: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.25)" }]}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={0.7}
            testID="delete-account-btn"
          >
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Text style={[styles.accountRowText, { color: "#EF4444" }]}>Delete account</Text>
                <Text style={[styles.accountRowChevron, { color: "#EF4444", opacity: 0.5 }]}>›</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Build info ── */}
        {(() => {
          const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? null;
          const commit = Constants.expoConfig?.extra?.buildCommit as string | null | undefined;
          const shortSha = commit && commit !== "null" ? commit.slice(0, 8) : null;
          if (!buildNumber && !shortSha) return null;
          const parts: string[] = [];
          if (buildNumber) parts.push(`Build ${buildNumber}`);
          if (shortSha) parts.push(shortSha);
          return (
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20, textAlign: "center", fontSize: 11 }]}
              testID="build-info-label"
            >
              {parts.join(" · ")}
            </Text>
          );
        })()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Paywall modal ── */}
      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onSubscribed={() => {
          void refetchServerSub();
          setShowPaywallModal(false);
        }}
      />

      {/* ── Rename saved contact modal ── */}
      <Modal
        visible={renamingContact !== null}
        animationType="fade"
        transparent
        onRequestClose={() => { setRenamingContact(null); setRenameInput(""); }}
      >
        <View style={styles.renameOverlay}>
          <View style={[styles.renameModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>Rename contact</Text>
            <TextInput
              style={[styles.renameInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleRenameSavedContact}
              maxLength={80}
            />
            <View style={styles.renameActions}>
              <Pressable
                style={({ pressed }) => [styles.renameCancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => { setRenamingContact(null); setRenameInput(""); }}
              >
                <Text style={[styles.renameCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.renameSaveBtn, { backgroundColor: colors.primary, opacity: pressed || !renameInput.trim() ? 0.6 : 1 }]}
                onPress={handleRenameSavedContact}
                disabled={!renameInput.trim()}
              >
                <Text style={[styles.renameSaveText, { color: colors.primaryForeground }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Profile preview modal ── */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={[styles.previewModal, { backgroundColor: colors.background }]}>
          <View style={[styles.previewModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.previewModalTitle, { color: colors.foreground }]}>How others see you</Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              style={({ pressed }) => [styles.previewModalClose, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityLabel="Close preview"
              accessibilityRole="button"
            >
              <Text style={[styles.previewModalCloseText, { color: colors.mutedForeground }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.previewModalContent} showsVerticalScrollIndicator={false}>
            {/* Avatar */}
            <View style={styles.previewAvatarWrap}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.previewAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.previewAvatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            {/* Name & handle */}
            <Text style={[styles.previewName, { color: colors.foreground }]}>
              {displayName.trim() || profile?.displayName || "—"}
            </Text>
            {(handle.trim() || profile?.handle) ? (
              <Text style={[styles.previewHandle, { color: colors.mutedForeground }]}>
                @{handle.trim() || profile?.handle}
              </Text>
            ) : null}

            {/* Bio */}
            {(bio.trim() || profile?.bio) ? (
              <View style={[styles.previewBioBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.previewBioText, { color: colors.foreground }]}>
                  {bio.trim() || profile?.bio}
                </Text>
              </View>
            ) : null}

            {/* Payment methods */}
            <Text style={[styles.previewSectionLabel, { color: colors.mutedForeground }]}>Payment methods</Text>
            <View style={[styles.previewPaymentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(cashAppHandle.trim() || profile?.cashAppHandle) ? (
                <View style={styles.previewPaymentRow}>
                  <Text style={styles.previewPaymentIcon}>💚</Text>
                  <Text style={[styles.previewPaymentLabel, { color: colors.foreground }]}>Cash App</Text>
                  <Text style={[styles.previewPaymentValue, { color: colors.mutedForeground }]}>
                    ${cashAppHandle.trim() || profile?.cashAppHandle}
                  </Text>
                </View>
              ) : null}
              {(venmoHandle.trim() || profile?.venmoHandle) ? (
                <View style={styles.previewPaymentRow}>
                  <Text style={styles.previewPaymentIcon}>💙</Text>
                  <Text style={[styles.previewPaymentLabel, { color: colors.foreground }]}>Venmo</Text>
                  <Text style={[styles.previewPaymentValue, { color: colors.mutedForeground }]}>
                    @{venmoHandle.trim() || profile?.venmoHandle}
                  </Text>
                </View>
              ) : null}
              {(() => {
                const zelleVal = zelleInfo.trim() || profile?.zelleInfo || "";
                const masked = maskZelle(zelleVal);
                return masked ? (
                  <View style={styles.previewPaymentRow}>
                    <Text style={styles.previewPaymentIcon}>💜</Text>
                    <Text style={[styles.previewPaymentLabel, { color: colors.foreground }]}>Zelle</Text>
                    <Text style={[styles.previewPaymentValue, { color: colors.mutedForeground }]}>
                      {masked}
                    </Text>
                  </View>
                ) : null;
              })()}
              {!cashAppHandle.trim() && !profile?.cashAppHandle &&
               !venmoHandle.trim() && !profile?.venmoHandle &&
               !zelleInfo.trim() && !profile?.zelleInfo ? (
                <Text style={[styles.previewNoPayment, { color: colors.mutedForeground }]}>
                  No payment methods added yet
                </Text>
              ) : null}
            </View>

            <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
              This is how your profile appears to other members of your events.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: 24,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 28,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  editBadgeText: {
    fontSize: 13,
  },
  avatarHint: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionSubLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verifiedBadge: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  removePhoneLink: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  verifyLink: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  paymentCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  paymentCalloutIcon: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 1,
  },
  paymentCalloutBody: {
    flex: 1,
    gap: 2,
  },
  paymentCalloutTitle: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 3,
  },
  paymentCalloutText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 17,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 2,
  },
  zelleWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  zelleWarningIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  zelleWarningBody: {
    flex: 1,
    gap: 2,
  },
  zelleWarningTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#92400E",
  },
  zelleWarningSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#92400E",
  },
  valueText: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  input: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 10,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "right",
    marginTop: 2,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  prefixRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prefix: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    width: 16,
    textAlign: "center",
  },
  prefixInput: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  saveBtn: {
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountRowText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  accountRowChevron: {
    fontSize: 20,
    lineHeight: 22,
  },
  subscriptionSubtext: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 2,
  },
  subscriptionActionText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  accountRowDivider: {
    height: 1,
    marginHorizontal: 16,
  },

  previewProfileBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewProfileBtnText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },

  previewModal: { flex: 1 },
  previewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  previewModalTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  previewModalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  previewModalCloseText: { fontSize: 16 },
  previewModalContent: {
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  previewAvatarWrap: { marginBottom: 8 },
  previewAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  previewAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  previewAvatarInitials: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#fff",
  },
  previewName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
    marginTop: 4,
  },
  previewHandle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
  },
  previewBioBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  previewBioText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 20,
    textAlign: "center",
  },
  previewSectionLabel: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  previewPaymentCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  previewPaymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewPaymentIcon: { fontSize: 16 },
  previewPaymentLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  previewPaymentValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  previewNoPayment: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
  },
  previewNote: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 20,
    opacity: 0.7,
  },
  savedContactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  savedContactAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  savedContactAction: {
    paddingHorizontal: 8,
  },
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
  renameTitle: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  renameInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  renameActions: {
    flexDirection: "row",
    gap: 10,
  },
  renameCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  renameCancelText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  renameSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  renameSaveText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
});
