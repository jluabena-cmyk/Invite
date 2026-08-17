import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // Return a matching dark background rather than null so the native view
  // never bleeds through as a black screen while Clerk state resolves.
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
