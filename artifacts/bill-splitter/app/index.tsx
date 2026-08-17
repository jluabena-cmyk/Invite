import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [checked, setChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const { data: profile, isLoading: isProfileLoading } = useGetCurrentUser();

  useEffect(() => {
    AsyncStorage.getItem("onboardingComplete").then((val) => {
      setOnboardingDone(val === "1");
      setChecked(true);
    });
  }, []);

  // Use the app's real background (cream) so this transient loading state is
  // visually distinct from the native black background — diagnostic aid.
  if (!isLoaded || !checked) {
    return <View style={{ flex: 1, backgroundColor: "#FAF5EF" }} />;
  }

  if (!isSignedIn) {
    if (!onboardingDone) return <Redirect href="/onboarding" />;
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Signed in — wait for profile to load, then enforce handle setup
  if (isProfileLoading) {
    return <View style={{ flex: 1, backgroundColor: "#FAF5EF" }} />;
  }
  if (!profile?.handle) return <Redirect href="/profile-setup" />;
  return <Redirect href="/(tabs)" />;
}
