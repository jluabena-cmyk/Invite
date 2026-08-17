import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs, useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useGetCurrentUser, useGetEvents } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="friends">
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { data: events } = useGetEvents();
  const pendingInviteCount = events?.filter((e) => e.role === "invited").length ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          elevation: 0,
          ...(isWeb
            ? { height: 84, borderTopWidth: 1, borderTopColor: colors.border }
            : { borderTopWidth: 0, borderTopColor: "transparent", marginHorizontal: 20, borderRadius: 28, marginBottom: 16, overflow: "hidden" }),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarBadge: pendingInviteCount > 0 ? pendingInviteCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useGetCurrentUser();
  // If the profile fetch hasn't resolved after 8 s (e.g. API unreachable on first
  // launch) we stop gating on it so the user isn't stuck on a black screen.
  // The useEffect below will redirect to /profile-setup once loading does finish.
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  useEffect(() => {
    if (!profileLoading) return;
    const t = setTimeout(() => setProfileTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [profileLoading]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || profileLoading) return;
    if (!profile?.handle?.trim()) {
      router.replace("/profile-setup");
    }
  }, [isLoaded, isSignedIn, profileLoading, profile, router]);

  // Use a matching dark background rather than null so the native view never
  // bleeds through as a black screen while auth / profile state resolves.
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if ((profileLoading && !profileTimedOut) || (!profileLoading && !profile?.handle?.trim())) {
    return <View style={{ flex: 1, backgroundColor: "#1a1f3c" }} />;
  }

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
