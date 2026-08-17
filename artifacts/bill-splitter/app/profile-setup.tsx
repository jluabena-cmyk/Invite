import { useUpdateCurrentUser, useUpsertCurrentUser } from "@workspace/api-client-react";
import { useUser } from "@clerk/expo";
import { isValidZelleInfo } from "@/utils/maskZelle";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#C2410C";
const BG = "#1a1f3c";
const CARD = "#FFFFFF";
const MUTED = "#94A3B8";
const BORDER = "rgba(255,255,255,0.12)";
const INPUT_BG = "rgba(255,255,255,0.07)";
const INPUT_BORDER = "rgba(255,255,255,0.18)";

const STEPS = ["Name", "Handle", "Payment"];

type PaymentMethod = "venmo" | "cash_app" | "zelle";

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; emoji: string; placeholder: string }[] = [
  { key: "venmo", label: "Venmo", emoji: "💙", placeholder: "Your Venmo username" },
  { key: "cash_app", label: "Cash App", emoji: "💚", placeholder: "Your $Cashtag" },
  { key: "zelle", label: "Zelle", emoji: "🟣", placeholder: "Email or phone number" },
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const { mutate: upsertProfile, isPending: isUpserting } = useUpsertCurrentUser();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateCurrentUser();
  const isPending = isUpserting || isUpdating;

  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [zelleInfo, setZelleInfo] = useState("");
  const [zelleTouched, setZelleTouched] = useState(false);

  const handleInputRef = useRef<TextInput>(null);
  const paymentInputRef = useRef<TextInput>(null);

  const paymentValue =
    paymentMethod === "venmo"
      ? venmoHandle
      : paymentMethod === "cash_app"
      ? cashAppHandle
      : paymentMethod === "zelle"
      ? zelleInfo
      : "";

  const zelleIsInvalid =
    zelleTouched && paymentMethod === "zelle" && zelleInfo.trim().length > 0 && !isValidZelleInfo(zelleInfo.trim());

  const canContinue =
    step === 0
      ? displayName.trim().length > 0
      : step === 1
      ? handle.trim().length > 0
      : paymentMethod !== null && paymentValue.trim().length > 0 && !zelleIsInvalid;

  const handleContinue = () => {
    if (!canContinue) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = () => {
    setSaveError(null);
    if (paymentMethod === "zelle" && zelleInfo.trim() && !isValidZelleInfo(zelleInfo.trim())) {
      setZelleTouched(true);
      return;
    }
    const onSaveError = (err: unknown) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Couldn't save profile — please try again.";
      setSaveError(msg);
    };
    upsertProfile(
      { data: { email: userEmail, displayName: displayName.trim() } },
      {
        onSuccess: () => {
          updateProfile(
            {
              data: {
                displayName: displayName.trim(),
                handle: handle.trim().toLowerCase(),
                preferredPaymentMethod: paymentMethod,
                venmoHandle: paymentMethod === "venmo" ? venmoHandle.trim() : "",
                cashAppHandle: paymentMethod === "cash_app" ? cashAppHandle.trim() : "",
                zelleInfo: paymentMethod === "zelle" ? zelleInfo.trim() : null,
              },
            },
            {
              onSuccess: () => {
                router.replace("/(tabs)");
              },
              onError: onSaveError,
            }
          );
        },
        onError: onSaveError,
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          s.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Wordmark */}
        <Text style={s.wordmark}>Owmo</Text>

        {/* Progress bar */}
        <View style={s.progressRow}>
          {STEPS.map((label, i) => (
            <View key={label} style={s.progressItem}>
              <View
                style={[
                  s.progressBar,
                  { backgroundColor: i <= step ? PRIMARY : BORDER },
                ]}
              />
              <Text
                style={[
                  s.progressLabel,
                  { color: i <= step ? PRIMARY : MUTED, opacity: i <= step ? 1 : 0.5 },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Step content */}
        <View style={s.content}>
          {step === 0 && (
            <NameStep
              value={displayName}
              onChange={setDisplayName}
              onSubmit={handleContinue}
            />
          )}
          {step === 1 && (
            <HandleStep
              value={handle}
              onChange={setHandle}
              onSubmit={handleContinue}
              inputRef={handleInputRef}
            />
          )}
          {step === 2 && (
            <PaymentStep
              selectedMethod={paymentMethod}
              onSelectMethod={(m) => {
                setPaymentMethod(m);
                setZelleTouched(false);
                setTimeout(() => paymentInputRef.current?.focus(), 100);
              }}
              venmoHandle={venmoHandle}
              cashAppHandle={cashAppHandle}
              zelleInfo={zelleInfo}
              onChangeVenmo={setVenmoHandle}
              onChangeCashApp={setCashAppHandle}
              onChangeZelle={setZelleInfo}
              onZelleBlur={() => setZelleTouched(true)}
              zelleError={zelleIsInvalid ? "Enter a valid phone number or email address linked to your Zelle account." : null}
              inputRef={paymentInputRef}
              onSubmit={handleContinue}
            />
          )}
        </View>

        {/* Error */}
        {saveError ? (
          <Text style={s.errorText}>{saveError}</Text>
        ) : null}

        {/* CTA */}
        <View style={s.ctaArea}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || isPending}
            style={({ pressed }) => [
              s.cta,
              !canContinue && s.ctaDisabled,
              pressed && canContinue && { opacity: 0.88 },
            ]}
          >
            {isPending ? (
              <ActivityIndicator color={CARD} />
            ) : (
              <Text style={s.ctaText}>
                {step === STEPS.length - 1 ? "Let's go →" : "Continue →"}
              </Text>
            )}
          </Pressable>
          {step > 0 && (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [s.backLink, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={s.backLinkText}>← Back</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NameStep({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View>
      <Text style={s.stepHeadline}>What's your{"\n"}name?</Text>
      <Text style={s.stepSub}>This is how you'll appear to friends and on events.</Text>
      <View style={s.inputCard}>
        <TextInput
          style={s.input}
          placeholder="Your full name"
          placeholderTextColor={MUTED}
          value={value}
          onChangeText={onChange}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function HandleStep({
  value,
  onChange,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  inputRef: React.RefObject<TextInput | null>;
}) {
  return (
    <View>
      <Text style={s.stepHeadline}>Choose your{"\n"}@handle</Text>
      <Text style={s.stepSub}>Friends will find and tag you with this. Lowercase letters, numbers, and underscores only.</Text>
      <View style={s.inputCard}>
        <Text style={s.inputPrefix}>@</Text>
        <TextInput
          ref={inputRef}
          style={[s.input, { flex: 1 }]}
          placeholder="yourhandle"
          placeholderTextColor={MUTED}
          value={value}
          onChangeText={(t) => onChange(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function PaymentStep({
  selectedMethod,
  onSelectMethod,
  venmoHandle,
  cashAppHandle,
  zelleInfo,
  onChangeVenmo,
  onChangeCashApp,
  onChangeZelle,
  onZelleBlur,
  zelleError,
  inputRef,
  onSubmit,
}: {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (m: PaymentMethod) => void;
  venmoHandle: string;
  cashAppHandle: string;
  zelleInfo: string;
  onChangeVenmo: (v: string) => void;
  onChangeCashApp: (v: string) => void;
  onChangeZelle: (v: string) => void;
  onZelleBlur: () => void;
  zelleError: string | null;
  inputRef: React.RefObject<TextInput | null>;
  onSubmit: () => void;
}) {
  const getCurrentValue = () => {
    if (selectedMethod === "venmo") return venmoHandle;
    if (selectedMethod === "cash_app") return cashAppHandle;
    if (selectedMethod === "zelle") return zelleInfo;
    return "";
  };

  const getCurrentOnChange = () => {
    if (selectedMethod === "venmo") return onChangeVenmo;
    if (selectedMethod === "cash_app") return onChangeCashApp;
    if (selectedMethod === "zelle") return onChangeZelle;
    return () => {};
  };

  const selectedOption = PAYMENT_OPTIONS.find((o) => o.key === selectedMethod);

  return (
    <View>
      <Text style={s.stepHeadline}>How do you{"\n"}collect?</Text>
      <Text style={s.stepSub}>
        When you host a dinner, Owmo generates payment requests so guests can pay you directly.
      </Text>

      <View style={s.paymentOptions}>
        {PAYMENT_OPTIONS.map((opt) => {
          const isSelected = selectedMethod === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelectMethod(opt.key)}
              style={({ pressed }) => [
                s.paymentOption,
                isSelected && s.paymentOptionSelected,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={s.paymentOptionEmoji}>{opt.emoji}</Text>
              <Text
                style={[
                  s.paymentOptionLabel,
                  isSelected && { color: PRIMARY },
                ]}
              >
                {opt.label}
              </Text>
              {isSelected && (
                <View style={s.paymentOptionCheck}>
                  <Text style={{ color: CARD, fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold" }}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {selectedMethod && selectedOption && (
        <View style={{ marginTop: 16 }}>
          <View
            style={[
              s.inputCard,
              selectedMethod === "zelle" && zelleError
                ? { borderColor: "#EF4444" }
                : null,
            ]}
          >
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder={selectedOption.placeholder}
              placeholderTextColor={MUTED}
              value={getCurrentValue()}
              onChangeText={getCurrentOnChange()}
              onBlur={selectedMethod === "zelle" ? onZelleBlur : undefined}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={selectedMethod === "zelle" ? "email-address" : "default"}
            />
          </View>
          {selectedMethod === "zelle" && zelleError ? (
            <Text style={s.zelleErrorText}>{zelleError}</Text>
          ) : null}
        </View>
      )}

      {!selectedMethod && (
        <Text style={s.paymentHint}>Tap one to get started — you can always add more later in your profile.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  wordmark: {
    color: CARD,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    letterSpacing: 4,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 32,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 48,
  },
  progressItem: {
    flex: 1,
    gap: 6,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  content: {
    flex: 1,
    marginBottom: 32,
  },
  stepHeadline: {
    color: CARD,
    fontSize: 40,
    fontFamily: "PlusJakartaSans_700Bold",
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  stepSub: {
    color: MUTED,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 22,
    marginBottom: 28,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
  },
  inputPrefix: {
    color: MUTED,
    fontSize: 17,
    fontFamily: "PlusJakartaSans_500Medium",
    marginRight: 4,
  },
  input: {
    color: CARD,
    fontSize: 17,
    fontFamily: "PlusJakartaSans_400Regular",
    flex: 1,
  },
  paymentOptions: {
    gap: 10,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  paymentOptionSelected: {
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}18`,
  },
  paymentOptionEmoji: {
    fontSize: 22,
  },
  paymentOptionLabel: {
    color: CARD,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
    flex: 1,
  },
  paymentOptionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentHint: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
  zelleErrorText: {
    color: "#F87171",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 8,
    lineHeight: 18,
  },
  errorText: {
    color: "#F87171",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginBottom: 12,
  },
  ctaArea: {
    gap: 12,
  },
  cta: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    color: CARD,
    fontSize: 17,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
