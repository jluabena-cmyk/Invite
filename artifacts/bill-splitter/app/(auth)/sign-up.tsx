import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { APP_SCHEME } from "@/constants/appScheme";

const TERMS_URL: string = Constants.expoConfig?.extra?.termsUrl ?? "https://invite-9bwgw.replit.app/api/terms";
const PRIVACY_URL: string = Constants.expoConfig?.extra?.privacyPolicyUrl ?? "https://invite-9bwgw.replit.app/api/privacy";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignUpScreen() {
  useWarmUpBrowser();

  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const redirectPath = params.redirect && params.redirect.length > 0 ? params.redirect : "/(tabs)";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleEmailSignUp = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            // no-op for native
          } else {
            router.push(redirectPath as Href);
          }
        },
      });
    }
  };

  const handleGoogleSignUp = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: APP_SCHEME }),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            router.push(redirectPath as Href);
          },
        });
      }
    } catch (err: unknown) {
      const firstErr = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
      const msg = firstErr?.longMessage ?? firstErr?.message ?? "Sign up with Google failed. Please try again.";
      Alert.alert("Sign-up failed", msg);
      console.warn("Google OAuth error", err);
    }
  }, [startSSOFlow, router, redirectPath]);

  const handleAppleSignUp = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_apple",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: APP_SCHEME }),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) return;
            router.push(redirectPath as Href);
          },
        });
      }
    } catch (err: unknown) {
      const firstErr = (err as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
      const msg = firstErr?.longMessage ?? firstErr?.message ?? "Sign up with Apple failed. Please try again.";
      Alert.alert("Sign-up failed", msg);
      console.warn("Apple OAuth error", err);
    }
  }, [startSSOFlow, router, redirectPath]);

  const isBusy = fetchStatus === "fetching";

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Verify your email
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter the code we sent to {email}
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          value={code}
          placeholder="Verification code"
          placeholderTextColor={colors.mutedForeground}
          onChangeText={setCode}
          keyboardType="numeric"
          autoFocus
        />
        {errors.fields.code && (
          <Text style={[styles.error, { color: colors.destructive }]}>
            {errors.fields.code.message}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            isBusy && styles.disabled,
          ]}
          onPress={handleVerify}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Verify
            </Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.textBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => signUp.verifications.sendEmailCode()}
        >
          <Text style={[styles.textBtnText, { color: colors.primary }]}>
            Resend code
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Create account
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Join Owmo
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.googleBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={handleGoogleSignUp}
      >
        <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
          Continue with Google
        </Text>
      </Pressable>

      {Platform.OS === "ios" && (
        <Pressable
          style={({ pressed }) => [
            styles.appleBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleAppleSignUp}
        >
          <Text style={styles.appleBtnText}>
            Continue with Apple
          </Text>
        </Pressable>
      )}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        value={email}
        placeholder="Email address"
        placeholderTextColor={colors.mutedForeground}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {errors.fields.emailAddress && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {errors.fields.emailAddress.message}
        </Text>
      )}

      <View style={[styles.passwordField, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.passwordInput, { color: colors.foreground }]}
          value={password}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          style={styles.eyeBtn}
          hitSlop={8}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
      {errors.fields.password && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {errors.fields.password.message}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          (!email || !password || isBusy) && styles.disabled,
        ]}
        onPress={handleEmailSignUp}
        disabled={!email || !password || isBusy}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Create account
          </Text>
        )}
      </Pressable>

      <Text style={[styles.tosText, { color: colors.mutedForeground }]}>
        By continuing, you agree to our{" "}
        <Text
          style={[styles.tosLink, { color: colors.primary }]}
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
        >
          Terms of Service
        </Text>
        {" "}and{" "}
        <Text
          style={[styles.tosLink, { color: colors.primary }]}
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
      </Text>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          Already have an account?{" "}
        </Text>
        <Link href={{ pathname: "/(auth)/sign-in", params: { redirect: redirectPath } } as Href}>
          <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
        </Link>
      </View>

      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 32,
  },
  googleBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  appleBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: "#000000",
  },
  appleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFFFFF",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 12,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    marginBottom: 8,
    marginTop: -4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  textBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  textBtnText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  tosText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  tosLink: {
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
