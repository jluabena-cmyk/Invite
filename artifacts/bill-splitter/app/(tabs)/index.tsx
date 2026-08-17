import { useAuth, useUser } from "@clerk/expo";
import {
  searchPlaces,
  discoverPlaces,
  matchPhones,
  useAcknowledgeCancelledEvent,
  useCreateEvent,
  useGenerateJoinCode,
  useGetEventInvitations,
  useGetEvents,
  useGetFriends,
  useJoinEvent,
  useRespondToEventInvitation,
  useUpsertCurrentUser,
  useGetCurrentUser,
  getGetCancelledEventsQueryKey,
  getGetEventInvitationsQueryKey,
  getGetEventsQueryKey,
} from "@workspace/api-client-react";
import type { Event, EventInvitation, FriendListItem, MatchedUser, PlaceResult, DiscoverPlaceResult } from "@workspace/api-client-react";
import * as Contacts from "expo-contacts";
import * as Haptics from "expo-haptics";
import { hashPhone } from "@/utils/hashPhone";
import { useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Animated,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { formatVotingCountdown } from "@/utils/voting";
import { FinancialSummaryCard } from "@/components/FinancialSummaryCard";

function SkeletonCard({ borderColor, bgColor }: { borderColor: string; bgColor: string }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.eventCard, { borderColor, backgroundColor: bgColor, gap: 10, opacity }]}>
      <View style={[styles.skeletonLine, { width: "68%", height: 14, backgroundColor: borderColor }]} />
      <View style={[styles.skeletonLine, { width: "44%", height: 10, backgroundColor: borderColor }]} />
      <View style={[styles.skeletonLine, { width: "56%", height: 10, backgroundColor: borderColor }]} />
    </Animated.View>
  );
}

type ActiveForm = "create" | "create-path" | "join" | null;

function categoryIcon(restaurantName: string | undefined): keyof typeof Ionicons.glyphMap {
  if (!restaurantName) return "restaurant-outline";
  const n = restaurantName.toLowerCase();
  if (n.includes("coffee") || n.includes("cafe") || n.includes("café") || n.includes("tea")) return "cafe-outline";
  if (n.includes("bar") || n.includes("wine") || n.includes("pub") || n.includes("brewery") || n.includes("beer") || n.includes("cocktail")) return "wine-outline";
  if (n.includes("sushi") || n.includes("fish") || n.includes("seafood") || n.includes("salmon")) return "fish-outline";
  if (n.includes("pizza") || n.includes("italian") || n.includes("pasta")) return "pizza-outline";
  if (n.includes("burger") || n.includes("fast") || n.includes("mcd") || n.includes("kfc")) return "fast-food-outline";
  return "restaurant-outline";
}

function roleLabel(role: string): string {
  if (role === "host") return "Host";
  if (role === "accepted") return "Member";
  if (role === "participant") return "Member";
  return role;
}

function getEventStatus(
  startsAt: string | null | undefined,
  cancelledAt: string | null | undefined,
): { label: string; color: string; bg: string } {
  if (cancelledAt) return { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.10)" };
  if (!startsAt) return { label: "No Date", color: "#F59E0B", bg: "rgba(245,158,11,0.13)" };
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return { label: "No Date", color: "#F59E0B", bg: "rgba(245,158,11,0.13)" };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86_400_000);
  if (d < todayStart)    return { label: "Completed", color: "#64748B", bg: "rgba(100,116,139,0.10)" };
  if (d < tomorrowStart) return { label: "Today",     color: "#16A34A", bg: "rgba(22,163,74,0.10)" };
  if (d < tomorrowEnd)   return { label: "Tomorrow",  color: "#D97706", bg: "rgba(217,119,6,0.10)" };
  return                        { label: "Upcoming",  color: "#C2410C", bg: "rgba(194,65,12,0.13)" };
}

function formatEventDate(startsAt: string | null | undefined): string | null {
  if (!startsAt) return null;
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86_400_000);
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d >= todayStart && d < tomorrowStart) return `Today · ${timeStr}`;
  if (d >= tomorrowStart && d < tomorrowEnd) return `Tomorrow · ${timeStr}`;
  const dateStr = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${dateStr} · ${timeStr}`;
}

function eventEmoji(restaurantName?: string | null): string {
  if (!restaurantName) return "🍽️";
  const n = restaurantName.toLowerCase();
  if (n.includes("sushi") || n.includes("japanese") || n.includes("ramen")) return "🍣";
  if (n.includes("burger") || n.includes("bbq") || n.includes("grill")) return "🍔";
  if (n.includes("pizza") || n.includes("italian") || n.includes("pasta")) return "🍕";
  if (n.includes("coffee") || n.includes("cafe") || n.includes("café") || n.includes("brew")) return "☕";
  if (n.includes("taco") || n.includes("mexican") || n.includes("burrito")) return "🌮";
  if (n.includes("thai") || n.includes("noodle") || n.includes("pho")) return "🍜";
  if (n.includes("indian") || n.includes("curry")) return "🍛";
  if (n.includes("chinese") || n.includes("dim sum") || n.includes("dumpling")) return "🥟";
  if (n.includes("salad") || n.includes("vegan") || n.includes("health")) return "🥗";
  if (n.includes("steak") || n.includes("steakhouse")) return "🥩";
  if (n.includes("bar") || n.includes("pub") || n.includes("tap")) return "🍺";
  if (n.includes("brunch") || n.includes("breakfast") || n.includes("diner")) return "🥞";
  if (n.includes("seafood") || n.includes("fish") || n.includes("lobster")) return "🦞";
  if (n.includes("lunch")) return "🥗";
  return "🍽️";
}

function groupByMonth<T extends { startsAt?: string | null }>(
  items: T[],
): Array<{ month: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const d = item.startsAt ? new Date(item.startsAt) : new Date(0);
    const key = isNaN(d.getTime())
      ? "Unknown"
      : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([month, items]) => ({ month, items }));
}

function getCardTint(statusLabel: string, isCancelled: boolean): string {
  if (isCancelled) return "rgba(239,68,68,0.07)";
  switch (statusLabel) {
    case "Upcoming":
    case "Today":
    case "Tomorrow":
      return "rgba(194,65,12,0.08)";
    case "No Date":
      return "rgba(245,158,11,0.05)";
    case "Completed":
      return "#FFFFFF";
    default:
      return "#FFFFFF";
  }
}

export default function HomeScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { mutate: upsertUser } = useUpsertCurrentUser();
  const { data: events, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useGetEvents();
  const { data: invitations, isLoading: invitesLoading, refetch: refetchInvitations } = useGetEventInvitations();
  const { mutate: createEvent, isPending: isCreating } = useCreateEvent();
  const { mutate: joinEvent, isPending: isJoining } = useJoinEvent();
  const { mutate: generateJoinCode } = useGenerateJoinCode();
  const { mutate: respondToInvitation, isPending: isResponding } = useRespondToEventInvitation<
    unknown,
    { previousInvitations?: EventInvitation[] }
  >({
    mutation: {
      onMutate: async ({ eventId }) => {
        await queryClient.cancelQueries({ queryKey: getGetEventInvitationsQueryKey() });
        const previousInvitations = queryClient.getQueryData<EventInvitation[]>(
          getGetEventInvitationsQueryKey(),
        );
        queryClient.setQueryData<EventInvitation[]>(
          getGetEventInvitationsQueryKey(),
          (old) => (old ? old.filter((inv) => inv.eventId !== eventId) : old),
        );
        return { previousInvitations };
      },
      onError: (_err, _vars, context) => {
        if (context?.previousInvitations !== undefined) {
          queryClient.setQueryData(getGetEventInvitationsQueryKey(), context.previousInvitations);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: getGetEventInvitationsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      },
    },
  });
  const { mutate: acknowledgeCancellation } = useAcknowledgeCancelledEvent<
    unknown,
    { previousEvents?: Event[] }
  >({
    mutation: {
      onMutate: async ({ eventId }) => {
        await queryClient.cancelQueries({ queryKey: getGetEventsQueryKey() });
        const previousEvents = queryClient.getQueryData<Event[]>(getGetEventsQueryKey());
        queryClient.setQueryData<Event[]>(
          getGetEventsQueryKey(),
          (old) => (old ? old.filter((ev) => ev.id !== eventId) : old),
        );
        return { previousEvents };
      },
      onError: (_err, _vars, context) => {
        if (context?.previousEvents !== undefined) {
          queryClient.setQueryData(getGetEventsQueryKey(), context.previousEvents);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetCancelledEventsQueryKey() });
      },
    },
  });
  const { data: friendsData } = useGetFriends();
  const { data: myProfile, refetch: refetchMyProfile } = useGetCurrentUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  useEffect(() => {
    if (email) {
      const displayName =
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user?.firstName?.trim() || email.split("@")[0];
      upsertUser({ data: { email, displayName } });
    }
  }, [email]);

  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [destinationOptional, setDestinationOptional] = useState(false);

  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [hasPickedTime, setHasPickedTime] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<number>>(new Set());

  const [createError, setCreateError] = useState<string | null>(null);

  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationSelected, setDestinationSelected] = useState<PlaceResult | null>(null);
  const [destinationResults, setDestinationResults] = useState<PlaceResult[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationSearchError, setDestinationSearchError] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [cityOrZip, setCityOrZip] = useState("");
  const locationRequestedRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  const [showCreateDiscovery, setShowCreateDiscovery] = useState(false);
  const [createDiscoveryZip, setCreateDiscoveryZip] = useState("");
  const [createDiscoveryCuisines, setCreateDiscoveryCuisines] = useState<string[]>([]);
  const [createDiscoveryRadius, setCreateDiscoveryRadius] = useState<number>(1609);
  const [createDiscoveryResults, setCreateDiscoveryResults] = useState<DiscoverPlaceResult[]>([]);
  const [createDiscoveryLoading, setCreateDiscoveryLoading] = useState(false);
  const [createDiscoveryError, setCreateDiscoveryError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const [contactsPermission, setContactsPermission] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactAppUsers, setContactAppUsers] = useState<MatchedUser[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());

  const [shownCodes, setShownCodes] = useState<Record<number, string>>({});

  const [respondingEventId, setRespondingEventId] = useState<number | null>(null);
  const [acknowledgingEventId, setAcknowledgingEventId] = useState<number | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  const toggleFriend = (friendId: number) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const toggleContactUser = (userId: number) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const loadContactsForCreate = async () => {
    setContactsLoading(true);
    setContactAppUsers([]);
    try {
      const { data: contactData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const withPhone = contactData.filter(
        (c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0,
      );
      const hashToContact = new Map<string, string>();
      await Promise.all(
        withPhone.map(async (c) => {
          const raw = c.phoneNumbers?.[0]?.number ?? "";
          if (!raw) return;
          const h = await hashPhone(raw);
          if (!hashToContact.has(h)) hashToContact.set(h, c.id ?? c.name ?? raw);
        }),
      );
      const allHashes = [...hashToContact.keys()];
      if (allHashes.length > 0) {
        try {
          const res = await matchPhones({ hashes: allHashes });
          setContactAppUsers(res.matches);
        } catch {
          setContactAppUsers([]);
        }
      }
    } catch {
      /* contacts unavailable */
    } finally {
      setContactsLoading(false);
    }
  };

  const handleContactsBtn = async () => {
    if (contactsPermission === "denied") return;
    if (contactsPermission === "undetermined") {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted") {
        setContactsPermission("granted");
        setShowContactPicker(true);
        void loadContactsForCreate();
      } else {
        setContactsPermission("denied");
      }
      return;
    }
    setShowContactPicker((v) => !v);
    if (!showContactPicker && contactAppUsers.length === 0 && !contactsLoading) {
      void loadContactsForCreate();
    }
  };

  const resetDestinationState = useCallback(() => {
    setDestinationQuery("");
    setDestinationSelected(null);
    setDestinationResults([]);
    setDestinationLoading(false);
    setLocationDenied(false);
    setUserLatLng(null);
    setCityOrZip("");
    locationRequestedRef.current = false;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setShowCreateDiscovery(false);
    setCreateDiscoveryZip("");
    setCreateDiscoveryCuisines([]);
    setCreateDiscoveryResults([]);
    setCreateDiscoveryLoading(false);
    setCreateDiscoveryError(null);
  }, []);

  const CREATE_CUISINE_OPTIONS = [
    { label: "American", emoji: "🍔", value: "american" },
    { label: "Barbecue", emoji: "🔥", value: "barbecue" },
    { label: "Chinese", emoji: "🥡", value: "chinese" },
    { label: "French", emoji: "🥐", value: "french" },
    { label: "Indian", emoji: "🍛", value: "indian" },
    { label: "Italian", emoji: "🍝", value: "italian" },
    { label: "Japanese", emoji: "🍱", value: "japanese" },
    { label: "Mexican", emoji: "🌮", value: "mexican" },
    { label: "Pizza", emoji: "🍕", value: "pizza" },
    { label: "Seafood", emoji: "🦞", value: "seafood" },
    { label: "Steak", emoji: "🥩", value: "steak" },
    { label: "Sushi", emoji: "🍣", value: "sushi" },
    { label: "Thai", emoji: "🌿", value: "thai" },
  ];

  const handleRunCreateDiscovery = useCallback(async () => {
    setCreateDiscoveryLoading(true);
    setCreateDiscoveryError(null);
    try {
      let lat = userLatLng?.lat;
      let lng = userLatLng?.lng;
      if (!createDiscoveryZip && !lat) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            setUserLatLng({ lat, lng });
          }
        } catch { /* ignore */ }
      }
      if (!createDiscoveryZip && !lat) {
        setCreateDiscoveryError("Enter a ZIP code or allow location access");
        setCreateDiscoveryLoading(false);
        return;
      }
      const res = await discoverPlaces({
        zip: createDiscoveryZip || undefined,
        lat,
        lng,
        cuisines: createDiscoveryCuisines.length > 0 ? createDiscoveryCuisines : undefined,
        radius: createDiscoveryRadius,
      });
      if (Array.isArray(res)) setCreateDiscoveryResults(res as DiscoverPlaceResult[]);
      else setCreateDiscoveryError("No results found");
    } catch {
      setCreateDiscoveryError("Discovery unavailable. Try a ZIP code.");
    } finally {
      setCreateDiscoveryLoading(false);
    }
  }, [userLatLng, createDiscoveryZip, createDiscoveryCuisines, createDiscoveryRadius]);

  const requestLocationOnce = useCallback(async () => {
    if (locationRequestedRef.current) return;
    locationRequestedRef.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else {
        setLocationDenied(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDestinationChange = useCallback((text: string) => {
    setDestinationQuery(text);
    setDestinationSelected(null);
    setDestinationResults([]);
    setDestinationSearchError(false);
    setCreateError(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length < 2) return;
    // Increment sequence number so stale responses from earlier keystrokes are discarded.
    const seq = ++searchSeqRef.current;
    searchTimeoutRef.current = setTimeout(async () => {
      setDestinationLoading(true);
      try {
        const results = await searchPlaces(
          text.trim(),
          userLatLng?.lat,
          userLatLng?.lng,
          !userLatLng && cityOrZip.trim() ? cityOrZip.trim() : undefined,
        );
        if (seq === searchSeqRef.current) setDestinationResults(results);
      } catch (err) {
        if (seq === searchSeqRef.current) {
          console.error("[searchPlaces] error:", err);
          setDestinationSearchError(true);
        }
      } finally {
        if (seq === searchSeqRef.current) setDestinationLoading(false);
      }
    }, 300);
  }, [userLatLng, cityOrZip]);

  const selectDestination = useCallback((result: PlaceResult) => {
    setDestinationSelected(result);
    setDestinationQuery(result.name);
    setDestinationResults([]);
    Keyboard.dismiss();
  }, []);

  const clearDestination = useCallback(() => {
    setDestinationSelected(null);
    setDestinationQuery("");
    setDestinationResults([]);
  }, []);

  const handleCreate = () => {
    if (!title.trim() || (!destinationOptional && !destinationQuery.trim()) || !pickedDate || !hasPickedTime) return;

    const startsAt = pickedDate ? pickedDate.toISOString() : undefined;
    const mergedInvites = new Set([...selectedFriendIds, ...selectedContactIds]);
    const initialInvites = mergedInvites.size > 0 ? [...mergedInvites] : undefined;

    setCreateError(null);
    createEvent(
      {
        data: {
          title: title.trim(),
          restaurantName: destinationSelected?.name ?? (destinationQuery.trim() || undefined),
          destinationAddress: destinationSelected?.address || undefined,
          destinationLat: destinationSelected?.lat,
          destinationLng: destinationSelected?.lng,
          destinationPlaceId: destinationSelected?.placeId || undefined,
          isPrivate,
          startsAt,
          initialInvites,
          destinationRequired: !destinationOptional,
        },
      },
      {
        onSuccess: (createdEvent) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTitle("");
          setIsPrivate(false);
          setPickedDate(null);
          setShowDatePicker(false);
          setShowTimePicker(false);
          setHasPickedTime(false);
          setSelectedFriendIds(new Set());
          setSelectedContactIds(new Set());
          setShowContactPicker(false);
          setContactAppUsers([]);
          resetDestinationState();
          setCreateError(null);
          setActiveForm(null);
          refetchEvents();
          refetchInvitations();
          router.push(`/event/${createdEvent.id}` as any);
        },
        onError: () => {
          setCreateError("Couldn't create the event. Please try again.");
        },
      },
    );
  };

  const handleCancelCreate = () => {
    setActiveForm(null);
    setDestinationOptional(false);
    setTitle("");
    setIsPrivate(false);
    setPickedDate(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setHasPickedTime(false);
    setSelectedFriendIds(new Set());
    setSelectedContactIds(new Set());
    setShowContactPicker(false);
    setContactAppUsers([]);
    resetDestinationState();
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    joinEvent(
      { data: { joinCode: code } },
      {
        onSuccess: (joinedEvent) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.removeQueries({ queryKey: [`/api/events/${joinedEvent.id}`] });
          setJoinCode("");
          setJoinError(null);
          setActiveForm(null);
          void refetchEvents();
          router.push(`/event/${joinedEvent.id}`);
        },
        onError: (err) => {
          const status = (err as { status?: number })?.status;
          if (status === 403) setJoinError("This event is invite-only.");
          else if (status === 404) setJoinError("Invalid join code. Check and try again.");
          else if (status === 409) setJoinError("You've already joined this event.");
          else setJoinError("Something went wrong. Please try again.");
        },
      },
    );
  };

  const handleCancelJoin = () => {
    setActiveForm(null);
    setJoinCode("");
    setJoinError(null);
  };

  const handleGetCode = (eventId: number) => {
    if (shownCodes[eventId]) {
      setShownCodes((prev) => { const next = { ...prev }; delete next[eventId]; return next; });
      return;
    }
    generateJoinCode(
      { eventId },
      {
        onSuccess: (share) => {
          setShownCodes((prev) => ({ ...prev, [eventId]: share.joinCode }));
        },
      },
    );
  };

  const handleRespondToInvitation = (eventId: number, action: "accept" | "decline") => {
    setRespondingEventId(eventId);
    respondToInvitation(
      { eventId, data: { action } },
      {
        onSuccess: () => setRespondingEventId(null),
        onError: () => setRespondingEventId(null),
      },
    );
  };

  const handleAcknowledgeCancellation = (eventId: number) => {
    setAcknowledgingEventId(eventId);
    acknowledgeCancellation(
      { eventId },
      {
        onSuccess: () => setAcknowledgingEventId(null),
        onError: () => setAcknowledgingEventId(null),
      },
    );
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  useFocusEffect(
    useCallback(() => {
      void refetchEvents();
      void refetchInvitations();
      void refetchMyProfile();
      setFocusTick((t) => t + 1);

      let timeoutId: ReturnType<typeof setTimeout>;

      const scheduleNext = () => {
        const evts = eventsRef.current ?? [];
        const hasNearDeadline = evts.some((e) => {
          if (!e.votingOpenedAt || !e.votingDeadline) return false;
          const msLeft = new Date(e.votingDeadline).getTime() - Date.now();
          return msLeft > 0 && msLeft <= 5 * 60_000;
        });
        const delay = hasNearDeadline ? 1_000 : 60_000;
        timeoutId = setTimeout(() => {
          setFocusTick((t) => t + 1);
          scheduleNext();
        }, delay);
      };

      scheduleNext();

      return () => {
        clearTimeout(timeoutId);
      };
    }, [refetchEvents, refetchInvitations, refetchMyProfile]),
  );

  const isLoading = eventsLoading;
  const pendingInvites = invitations ?? [];
  const friends = friendsData?.friends ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
  const userFirstName = user?.firstName || email.split("@")[0] || "there";

  const [phoneNudgeDismissed, setPhoneNudgeDismissed] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem("phoneNudgeDismissed").then((val) => {
      if (val === "1") setPhoneNudgeDismissed(true);
    });
  }, []);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

  const profileLoaded = myProfile !== undefined;
  const missingPayment = profileLoaded && !(myProfile?.cashAppHandle || myProfile?.venmoHandle || myProfile?.zelleInfo);
  const missingHandle = profileLoaded && !myProfile?.handle;
  const showProfileNudge = missingPayment || missingHandle;
  const showPhoneNudge =
    profileLoaded &&
    !showProfileNudge &&
    !myProfile?.phoneNumberHash &&
    !phoneNudgeDismissed;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const allEvents = events ?? [];
  const upcomingEvents = allEvents.filter(
    (e) => !e.cancelledAt && new Date(e.startsAt ?? 0) >= todayStart,
  );
  const completedEvents = allEvents
    .filter((e) => !e.cancelledAt && new Date(e.startsAt ?? 0) < todayStart)
    .sort((a, b) => new Date(b.startsAt ?? 0).getTime() - new Date(a.startsAt ?? 0).getTime());
  const cancelledEvents = allEvents
    .filter((e) => !!e.cancelledAt)
    .sort(
      (a, b) =>
        new Date(b.startsAt ?? b.cancelledAt ?? 0).getTime() -
        new Date(a.startsAt ?? a.cancelledAt ?? 0).getTime(),
    );
  const upcomingCount = upcomingEvents.length;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.containerContent,
          { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 120 },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={eventsLoading || invitesLoading}
            onRefresh={() => { void refetchEvents(); void refetchInvitations(); }}
          />
        }
      >
        {/* ── TOP HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>{userFirstName}</Text>
            {upcomingCount > 0 && (
              <View style={[styles.plansPill, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
                <Text style={[styles.plansPillText, { color: colors.primary }]}>
                  📅  {upcomingCount} upcoming {upcomingCount === 1 ? "plan" : "plans"}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => router.push("/(tabs)/profile")}
            testID="home-avatar-btn"
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>{(userFirstName?.[0] ?? "?").toUpperCase()}</Text>
            </View>
          </Pressable>
        </View>

        {/* ── ACTION BUTTONS ── */}
        {activeForm === null && (
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => { setActiveForm("create-path"); requestLocationOnce(); }}
              testID="new-event-button"
            >
              <Text style={styles.actionBtnIcon}>＋</Text>
              <Text style={[styles.actionBtnLabel, { color: "#fff" }]}>New Plan</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => setActiveForm("join")}
              testID="join-event-button"
            >
              <Text style={styles.actionBtnIcon}>👤</Text>
              <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Join Event</Text>
            </Pressable>
          </View>
        )}

        {/* ── PROFILE NUDGE ── */}
        {showProfileNudge && (
          <Pressable
            style={({ pressed }) => [
              styles.profileNudge,
              {
                backgroundColor: missingPayment ? "rgba(245,158,11,0.08)" : "rgba(194,65,12,0.07)",
                borderColor: missingPayment ? "#f59e0b" : colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
            testID="profile-nudge-banner"
          >
            <Text style={styles.profileNudgeIcon}>
              {missingPayment ? "💳" : "👤"}
            </Text>
            <Text style={[styles.profileNudgeText, { color: missingPayment ? "#92400e" : colors.primary }]}>
              {missingPayment
                ? "Add a payment method so you can collect money from guests"
                : "Set your @handle so friends can find you"}
            </Text>
            <Text style={[styles.profileNudgeArrow, { color: missingPayment ? "#92400e" : colors.primary }]}>
              →
            </Text>
          </Pressable>
        )}

        {/* ── PHONE NUDGE ── */}
        {showPhoneNudge && (
          <View
            style={[
              styles.profileNudge,
              { backgroundColor: "rgba(99,102,241,0.07)", borderColor: "#6366f1" },
            ]}
            testID="phone-nudge-banner"
          >
            <Text style={styles.profileNudgeIcon}>📱</Text>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => router.push("/(tabs)/profile")}
              testID="phone-nudge-tap"
            >
              <Text style={[styles.profileNudgeText, { color: "#4338ca" }]}>
                Add your phone number to automatically find friends who are already on Owmo
              </Text>
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => {
                void AsyncStorage.setItem("phoneNudgeDismissed", "1");
                setPhoneNudgeDismissed(true);
              }}
              testID="phone-nudge-dismiss"
            >
              <Ionicons name="close" size={18} color="#6366f1" />
            </Pressable>
          </View>
        )}

        {/* ── FINANCIAL SUMMARY ── */}
        <FinancialSummaryCard />

        {/* ── PENDING INVITATIONS ── */}
        {invitations !== undefined && !invitesLoading && pendingInvites.length === 0 && (
          <Text style={[styles.noInvitationsHint, { color: colors.mutedForeground }]} testID="no-invitations-hint">
            No pending invitations.
          </Text>
        )}
        {!invitesLoading && pendingInvites.length > 0 && (
          <View style={styles.invitationsSection}>
            <Text style={[styles.invitationsSectionTitle, { color: colors.foreground }]}>
              Invitations
            </Text>
            {pendingInvites.map((invite) => {
              const isThisResponding = respondingEventId === invite.eventId;
              return (
                <View
                  key={invite.eventId}
                  style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  testID={`invite-card-${invite.eventId}`}
                >
                  <View style={styles.inviteCardHeader}>
                    <View style={styles.inviteCardTitleRow}>
                      <Text style={[styles.inviteEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {invite.eventTitle}
                      </Text>
                      {invite.isPrivate && (
                        <View style={[styles.privateBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Text style={[styles.privateBadgeText, { color: colors.mutedForeground }]}>Private</Text>
                        </View>
                      )}
                    </View>
                    {invite.restaurantName ? (
                      <Text style={[styles.inviteRestaurant, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {invite.restaurantName}
                      </Text>
                    ) : null}
                    <Text style={[styles.inviteHost, { color: colors.mutedForeground }]}>
                      from {invite.hostDisplayName} (@{invite.hostHandle})
                    </Text>
                  </View>
                  <View style={styles.inviteActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.declineBtn,
                        { borderColor: colors.border, opacity: pressed || isThisResponding ? 0.65 : 1 },
                      ]}
                      onPress={() => handleRespondToInvitation(invite.eventId, "decline")}
                      disabled={isThisResponding || isResponding}
                      testID={`decline-invite-${invite.eventId}`}
                    >
                      <Text style={[styles.declineBtnText, { color: colors.mutedForeground }]}>Decline</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.acceptBtn,
                        { backgroundColor: colors.primary, opacity: pressed || isThisResponding ? 0.65 : 1 },
                      ]}
                      onPress={() => handleRespondToInvitation(invite.eventId, "accept")}
                      disabled={isThisResponding || isResponding}
                      testID={`accept-invite-${invite.eventId}`}
                    >
                      {isThisResponding ? (
                        <ActivityIndicator color={colors.primaryForeground} size="small" />
                      ) : (
                        <Text style={[styles.acceptBtnText, { color: colors.primaryForeground }]}>Accept</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── SECTION HEADER ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Plans</Text>
        </View>

        {/* ── PATH SELECTION ── */}
        {activeForm === "create-path" && (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pathSelectTitle, { color: colors.foreground }]}>
              Do you have a destination in mind?
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.pathOptionBtn,
                { borderColor: colors.primary, backgroundColor: pressed ? colors.primary + "11" : colors.background },
              ]}
              onPress={() => {
                setDestinationOptional(false);
                setActiveForm("create");
              }}
              testID="path-known-destination"
            >
              <Text style={[styles.pathOptionIcon]}>📍</Text>
              <View style={styles.pathOptionText}>
                <Text style={[styles.pathOptionTitle, { color: colors.foreground }]}>I know where we're going</Text>
                <Text style={[styles.pathOptionDesc, { color: colors.mutedForeground }]}>Set a restaurant or venue now</Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.pathOptionBtn,
                { borderColor: colors.border, backgroundColor: pressed ? colors.card : colors.background },
              ]}
              onPress={() => {
                setDestinationOptional(true);
                setActiveForm("create");
              }}
              testID="path-decide-later"
            >
              <Text style={[styles.pathOptionIcon]}>🗳️</Text>
              <View style={styles.pathOptionText}>
                <Text style={[styles.pathOptionTitle, { color: colors.foreground }]}>We'll decide as a group</Text>
                <Text style={[styles.pathOptionDesc, { color: colors.mutedForeground }]}>Participants suggest venues and vote</Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1, marginTop: 8 }]}
              onPress={handleCancelCreate}
              testID="cancel-path-select"
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ── CREATE EVENT FORM ── */}
        {activeForm === "create" && (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={title}
              onChangeText={(v) => { setTitle(v); setCreateError(null); }}
              placeholder="Event title *"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              returnKeyType="next"
              maxLength={100}
              testID="event-title-input"
            />
            {title.length > 75 && (
              <Text style={[styles.charCounter, { color: title.length >= 100 ? (colors.destructive ?? "#ef4444") : colors.mutedForeground }]}>
                {100 - title.length} chars left
              </Text>
            )}
            {locationDenied ? (
              <TextInput
                style={[styles.formInput, styles.cityOrZipInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={cityOrZip}
                onChangeText={setCityOrZip}
                placeholder="City or ZIP (for nearby results)"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
                autoCapitalize="words"
                autoCorrect={false}
                testID="event-city-zip-input"
              />
            ) : userLatLng ? (
              <View style={styles.locationStatusRow}>
                <Text style={[styles.locationStatusText, { color: colors.mutedForeground }]}>📍 Using your location</Text>
              </View>
            ) : (
              <View style={styles.locationStatusRow}>
                <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.locationStatusText, { color: colors.mutedForeground }]}>Getting your location…</Text>
              </View>
            )}
            {destinationOptional ? (
              <View style={[styles.decideLaterBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.decideLaterBannerText, { color: colors.mutedForeground }]}>
                  🗳️ Destination TBD — participants will suggest venues and vote
                </Text>
              </View>
            ) : (
              <View>
                {/* Search mode toggle */}
                <View style={[styles.destModeRow, { borderColor: colors.border }]}>
                  <Pressable
                    style={[styles.destModeBtn, !showCreateDiscovery && { backgroundColor: colors.primary }]}
                    onPress={() => { setShowCreateDiscovery(false); setCreateDiscoveryResults([]); }}
                  >
                    <Text style={[styles.destModeBtnText, { color: !showCreateDiscovery ? colors.primaryForeground : colors.mutedForeground }]}>Search</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.destModeBtn, showCreateDiscovery && { backgroundColor: colors.primary }]}
                    onPress={() => { setShowCreateDiscovery(true); clearDestination(); }}
                  >
                    <Text style={[styles.destModeBtnText, { color: showCreateDiscovery ? colors.primaryForeground : colors.mutedForeground }]}>Browse</Text>
                  </Pressable>
                </View>

                {!showCreateDiscovery ? (
                  <View>
                    <View style={[styles.destinationRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <TextInput
                        style={[styles.destinationInput, { color: colors.foreground }]}
                        value={destinationSelected ? destinationSelected.name : destinationQuery}
                        onChangeText={handleDestinationChange}
                        onFocus={requestLocationOnce}
                        placeholder="Destination *"
                        placeholderTextColor={colors.mutedForeground}
                        editable={!destinationSelected}
                        returnKeyType="search"
                        testID="event-destination-input"
                      />
                      {(destinationSelected !== null || destinationQuery.length > 0) && (
                        <Pressable onPress={clearDestination} style={styles.destinationClearBtn} testID="destination-clear">
                          <Text style={[styles.destinationClearText, { color: colors.mutedForeground }]}>×</Text>
                        </Pressable>
                      )}
                    </View>
                    {locationDenied && (
                      <Text style={[styles.locationHint, { color: colors.mutedForeground }]}>
                        ⓘ Allow location access for nearby results
                      </Text>
                    )}
                    {destinationLoading && (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4, alignSelf: "center" }} />
                    )}
                    {destinationSearchError && !destinationLoading && (
                      <Text style={[styles.locationHint, { color: colors.mutedForeground }]} testID="destination-search-error">
                        Search unavailable — type the name anyway.
                      </Text>
                    )}
                    {destinationResults.length > 0 && !destinationSelected && (
                      <View style={[styles.destinationResultsList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        {destinationResults.map((result) => (
                          <Pressable
                            key={result.placeId}
                            style={({ pressed }) => [
                              styles.destinationResultItem,
                              { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" },
                            ]}
                            onPress={() => selectDestination(result)}
                            testID={`destination-result-${result.placeId}`}
                          >
                            <Text style={[styles.destinationResultName, { color: colors.foreground }]} numberOfLines={1}>
                              {result.name}
                            </Text>
                            <Text style={[styles.destinationResultAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {result.address}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Browse / Discovery panel */
                  <View style={[styles.createDiscoveryPanel, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <TextInput
                      style={[styles.destinationInput, { color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, marginBottom: 8 }]}
                      value={createDiscoveryZip}
                      onChangeText={setCreateDiscoveryZip}
                      placeholder="ZIP code (or use device location)"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                    <Text style={[styles.locationHint, { color: colors.mutedForeground, marginBottom: 4 }]}>Cuisine (optional)</Text>
                    <View style={[styles.cuisineGrid, { marginBottom: 8 }]}>
                      {CREATE_CUISINE_OPTIONS.map(({ label, emoji, value }) => {
                        const selected = createDiscoveryCuisines.includes(value);
                        return (
                          <Pressable
                            key={value}
                            style={[
                              styles.cuisineGridCell,
                              { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
                            ]}
                            onPress={() => setCreateDiscoveryCuisines((prev) => selected ? prev.filter((x) => x !== value) : [...prev, value])}
                          >
                            <Text style={styles.cuisineGridEmoji}>{emoji}</Text>
                            <Text style={[styles.cuisineGridLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={[styles.locationHint, { color: colors.mutedForeground, marginBottom: 4 }]}>Search radius</Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {([805, 1609, 4828, 8047] as const).map((r) => {
                        const mi = Math.round(r / 1609.34 * 10) / 10;
                        const label = `${mi === Math.floor(mi) ? mi.toFixed(0) : mi.toFixed(1)}mi`;
                        const sel = createDiscoveryRadius === r;
                        return (
                          <Pressable
                            key={r}
                            style={[styles.cuisineChip, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.primary : colors.secondary }]}
                            onPress={() => setCreateDiscoveryRadius(r)}
                          >
                            <Text style={[styles.cuisineChipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.discoverBtn, { backgroundColor: colors.primary, opacity: pressed || createDiscoveryLoading ? 0.7 : 1 }]}
                      onPress={handleRunCreateDiscovery}
                      disabled={createDiscoveryLoading}
                    >
                      {createDiscoveryLoading
                        ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                        : <Text style={[styles.discoverBtnText, { color: colors.primaryForeground }]}>Find venues</Text>
                      }
                    </Pressable>
                    {createDiscoveryError && (
                      <Text style={[styles.locationHint, { color: colors.destructive ?? "#ef4444", marginTop: 4 }]}>{createDiscoveryError}</Text>
                    )}
                    {createDiscoveryResults.length > 0 && (
                      <View style={[styles.destinationResultsList, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 8 }]}>
                        {createDiscoveryResults.map((place) => (
                          <Pressable
                            key={place.placeId}
                            style={({ pressed }) => [
                              styles.destinationResultItem,
                              { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" },
                            ]}
                            onPress={() => {
                              selectDestination({ placeId: place.placeId, name: place.name, address: place.address, lat: place.lat, lng: place.lng });
                              setShowCreateDiscovery(false);
                              setCreateDiscoveryResults([]);
                            }}
                          >
                            <Text style={[styles.destinationResultName, { color: colors.foreground }]} numberOfLines={1}>
                              {place.name}{place.rating ? `  ⭐ ${place.rating}` : ""}
                            </Text>
                            <Text style={[styles.destinationResultAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {place.address}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.dateTimeRow}>
              <Pressable
                style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.background, flex: 2 }]}
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker((v) => !v);
                  if (!pickedDate) {
                    const today = new Date();
                    today.setHours(12, 0, 0, 0);
                    setPickedDate(today);
                  }
                }}
                testID="event-date-input"
              >
                <Text style={[styles.pickerBtnText, { color: pickedDate ? colors.foreground : colors.mutedForeground }]}>
                  {pickedDate
                    ? pickedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                    : "Date *"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pickerBtn,
                  { borderColor: colors.border, backgroundColor: colors.background, flex: 1 },
                  !pickedDate && styles.pickerBtnDisabled,
                ]}
                onPress={() => { setShowDatePicker(false); setShowTimePicker((v) => !v); }}
                disabled={!pickedDate}
                testID="event-time-input"
              >
                <Text style={[styles.pickerBtnText, { color: pickedDate ? colors.foreground : colors.mutedForeground }]}>
                  {pickedDate
                    ? pickedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                    : "Time *"}
                </Text>
              </Pressable>
            </View>
            {showDatePicker && (
              <View style={[styles.datePickerWrapper, { backgroundColor: colors.background }]}>
                <DateTimePicker
                  value={pickedDate ?? new Date()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  onChange={(_e, selected) => {
                    if (Platform.OS === "android") setShowDatePicker(false);
                    if (selected) {
                      setCreateError(null);
                      setPickedDate((prev) => {
                        const d = new Date(selected);
                        if (prev) {
                          d.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                        } else {
                          d.setHours(12, 0, 0, 0);
                        }
                        return d;
                      });
                    }
                  }}
                />
              </View>
            )}
            {showTimePicker && pickedDate && (
              <View style={[styles.timePickerWrapper, { backgroundColor: colors.background }]}>
                <DateTimePicker
                  value={pickedDate}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  themeVariant="light"
                  onChange={(_e, selected) => {
                    if (Platform.OS === "android") setShowTimePicker(false);
                    if (selected) {
                      setCreateError(null);
                      setHasPickedTime(true);
                      setPickedDate((prev) => {
                        const d = new Date(prev ?? selected);
                        d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                        return d;
                      });
                    }
                  }}
                />
              </View>
            )}

            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Private event</Text>
                <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>Invite-only, join code blocked</Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                testID="private-event-toggle"
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {friends.length > 0 && (
              <View style={styles.friendSelectSection}>
                <Text style={[styles.friendSelectLabel, { color: colors.mutedForeground }]}>
                  Invite friends{selectedFriendIds.size > 0 ? ` (${selectedFriendIds.size} selected)` : ""}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.friendChipsRow}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                >
                  {friends.map((f: FriendListItem) => {
                    const selected = selectedFriendIds.has(f.user.id);
                    return (
                      <Pressable
                        key={f.user.id}
                        style={[
                          styles.friendChip,
                          selected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                        onPress={() => toggleFriend(f.user.id)}
                        testID={`friend-chip-${f.user.id}`}
                      >
                        <Text
                          style={[
                            styles.friendChipText,
                            { color: selected ? colors.primaryForeground : colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {f.user.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── CONTACTS PICKER ── */}
            <View style={styles.contactsPickerSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.contactsPickerBtn,
                  {
                    borderColor: showContactPicker ? colors.primary : colors.border,
                    backgroundColor: showContactPicker ? colors.primary + "12" : colors.background,
                    opacity: contactsPermission === "denied" ? 0.5 : pressed ? 0.75 : 1,
                  },
                ]}
                onPress={() => { void handleContactsBtn(); }}
                disabled={contactsPermission === "denied"}
                testID="contacts-picker-btn"
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={showContactPicker ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.contactsPickerBtnText, { color: showContactPicker ? colors.primary : colors.mutedForeground }]}>
                  {contactsPermission === "denied"
                    ? "Contacts access denied"
                    : selectedContactIds.size > 0
                    ? `${selectedContactIds.size} from contacts`
                    : "From Contacts"}
                </Text>
                {contactsPermission !== "denied" && (
                  <Ionicons
                    name={showContactPicker ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={colors.mutedForeground}
                  />
                )}
              </Pressable>

              {showContactPicker && (
                <View style={[styles.contactPickerList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  {contactsLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ padding: 14 }} />
                  ) : contactAppUsers.length === 0 ? (
                    <Text style={[styles.contactPickerEmpty, { color: colors.mutedForeground }]}>
                      No contacts found on the app yet
                    </Text>
                  ) : (
                    contactAppUsers.map((cu) => {
                      const sel = selectedContactIds.has(cu.id);
                      return (
                        <Pressable
                          key={cu.id}
                          style={({ pressed }) => [
                            styles.contactPickerRow,
                            { borderColor: colors.border, backgroundColor: pressed ? colors.secondary : "transparent" },
                          ]}
                          onPress={() => toggleContactUser(cu.id)}
                          testID={`contact-user-${cu.id}`}
                        >
                          <View style={[styles.contactPickerAvatar, { backgroundColor: sel ? colors.primary : colors.secondary }]}>
                            <Text style={[styles.contactPickerAvatarText, { color: sel ? "#fff" : colors.mutedForeground }]}>
                              {(cu.displayName[0] ?? "?").toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.contactPickerInfo}>
                            <Text style={[styles.contactPickerName, { color: colors.foreground }]} numberOfLines={1}>
                              {cu.displayName}
                            </Text>
                            <Text style={[styles.contactPickerHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
                              @{cu.handle}
                            </Text>
                          </View>
                          {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            <View style={styles.formActions}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={handleCancelCreate}
                testID="cancel-create-event"
              >
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.primary, opacity: pressed || !title.trim() || (!destinationOptional && !destinationQuery.trim()) || !pickedDate || !hasPickedTime || isCreating ? 0.6 : 1 },
                ]}
                onPress={handleCreate}
                disabled={!title.trim() || (!destinationOptional && !destinationQuery.trim()) || !pickedDate || !hasPickedTime || isCreating}
                testID="create-event-submit"
              >
                {isCreating
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Create</Text>}
              </Pressable>
            </View>
            {createError && (
              <Text style={[styles.joinErrorText, { color: colors.destructive ?? "#ef4444", marginTop: 8 }]} testID="create-event-error">
                {createError}
              </Text>
            )}
          </View>
        )}

        {/* ── JOIN EVENT FORM ── */}
        {activeForm === "join" && (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: joinError ? colors.destructive ?? "#ef4444" : colors.border, backgroundColor: colors.background }]}
              value={joinCode}
              onChangeText={(v) => { setJoinCode(v.toUpperCase()); setJoinError(null); }}
              placeholder="Enter join code"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              testID="join-code-input"
            />
            {joinError && (
              <Text style={[styles.errorText, { color: colors.destructive ?? "#ef4444" }]} testID="join-error-text">
                {joinError}
              </Text>
            )}
            <View style={styles.formActions}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                onPress={handleCancelJoin}
                testID="cancel-join-event"
              >
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.primary, opacity: pressed || !joinCode.trim() || isJoining ? 0.6 : 1 },
                ]}
                onPress={handleJoin}
                disabled={!joinCode.trim() || isJoining}
                testID="join-event-submit"
              >
                {isJoining
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Join</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── EVENTS LIST ── */}
        {isLoading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} borderColor={colors.border} bgColor={colors.card} />
            ))}
          </View>
        ) : eventsError ? (
          <View style={styles.errorState}>
            <Text style={[styles.errorStateText, { color: colors.mutedForeground }]}>
              Couldn't load your events.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.errorRetryBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => void refetchEvents()}
              testID="events-retry-btn"
            >
              <Text style={[styles.errorRetryText, { color: colors.foreground }]}>Retry</Text>
            </Pressable>
          </View>
        ) : !allEvents.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIllustration}>🍽️</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your first plan awaits</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Create an event and split the bill with friends — or jump into one with an invite code.
            </Text>
            {activeForm === null && (
              <View style={styles.emptyActions}>
                <Pressable
                  style={({ pressed }) => [styles.emptyPrimaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => { setActiveForm("create-path"); void requestLocationOnce(); }}
                >
                  <Text style={styles.emptyPrimaryBtnText}>＋ New Plan</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.emptySecondaryBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => setActiveForm("join")}
                >
                  <Text style={[styles.emptySecondaryBtnText, { color: colors.foreground }]}>Join with code</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {upcomingEvents.map((item) => {
              const isCancelled = !!item.cancelledAt;
              const status = getEventStatus(item.startsAt, item.cancelledAt);
              const dateLabel = formatEventDate(item.startsAt);
              const cardBg = getCardTint(status.label, isCancelled);
              const isHost = item.role === "host";

              return (
                <Pressable
                  key={String(item.id)}
                  style={({ pressed }) => [
                    styles.eventCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: isCancelled ? "rgba(239,68,68,0.30)" : colors.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                  onPress={() => router.push(`/event/${item.id}`)}
                  testID={`event-card-${item.id}`}
                >
                  {/* TOP ROW: category icon + title + status badge */}
                  <View style={styles.eventTitleRow}>
                    <Ionicons
                      name={categoryIcon(item.restaurantName ?? undefined)}
                      size={15}
                      color={isCancelled ? "#94A3B8" : "#6B7280"}
                    />
                    <Text
                      style={[styles.eventTitle, { color: colors.foreground, opacity: isCancelled ? 0.5 : 1 }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <View style={[styles.eventStatusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.eventStatusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  {/* LOCATION ROW — lighter, tertiary */}
                  {item.restaurantName ? (
                    <Text
                      style={[styles.eventMeta, styles.eventMetaLocation, { opacity: isCancelled ? 0.5 : 1 }]}
                      numberOfLines={1}
                    >
                      {item.restaurantName}
                    </Text>
                  ) : item.destinationRequired === false ? (
                    <View style={[styles.destinationBadgeRow, { opacity: isCancelled ? 0.5 : 1 }]}>
                      {item.votingOpenedAt && item.votingDeadline && new Date(item.votingDeadline) <= new Date() ? (
                        <View style={styles.votingClosedBadge}>
                          <Text style={styles.votingClosedBadgeText}>🔒 Voting closed</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.destinationBadge}>
                            <Text style={styles.destinationBadgeText}>
                              {item.votingOpenedAt ? "🗳️ Vote open" : "📍 TBD"}
                            </Text>
                          </View>
                          {item.votingOpenedAt && item.votingDeadline ? (
                            <Text style={[styles.votingCountdownText, { color: colors.mutedForeground }]}>
                              {formatVotingCountdown(new Date(item.votingDeadline))}
                            </Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  ) : null}

                  {/* DATE ROW — slightly darker, secondary */}
                  {dateLabel ? (
                    <Text
                      style={[styles.eventMeta, styles.eventMetaDate, { opacity: isCancelled ? 0.5 : 1 }]}
                      numberOfLines={1}
                    >
                      {dateLabel}
                    </Text>
                  ) : null}

                  {/* PARTICIPANT STATS ROW */}
                  {((item.goingCount ?? 0) + (item.notGoingCount ?? 0) + (item.notRespondedCount ?? 0)) > 0 && (
                    <View style={styles.participantStatsRow}>
                      {(item.goingCount ?? 0) > 0 && (
                        <View style={styles.participantStat}>
                          <Text style={[styles.participantStatDot, { color: "#16A34A" }]}>●</Text>
                          <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.goingCount} going</Text>
                        </View>
                      )}
                      {(item.notGoingCount ?? 0) > 0 && (
                        <View style={styles.participantStat}>
                          <Text style={[styles.participantStatDot, { color: "#EF4444" }]}>●</Text>
                          <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.notGoingCount} not going</Text>
                        </View>
                      )}
                      {(item.notRespondedCount ?? 0) > 0 && (
                        <View style={styles.participantStat}>
                          <Text style={[styles.participantStatDot, { color: "#94A3B8" }]}>●</Text>
                          <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.notRespondedCount} no response</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* FOOTER ROW: role pill + chevron */}
                  <View style={[styles.cardFooter, { opacity: isCancelled ? 0.5 : 1 }]}>
                    <View style={styles.cardFooterLeft}>
                      <View style={[
                        styles.roleChip,
                        isHost
                          ? { backgroundColor: colors.primary + "18", borderColor: colors.primary + "45" }
                          : { backgroundColor: colors.secondary, borderColor: colors.border },
                      ]}>
                        <Text style={[
                          styles.roleChipText,
                          { color: isHost ? colors.primary : colors.mutedForeground },
                        ]}>
                          {roleLabel(item.role)}
                        </Text>
                      </View>
                      {item.isPrivate && (
                        <View style={[styles.privateChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Text style={[styles.privateChipText, { color: colors.mutedForeground }]}>Private</Text>
                        </View>
                      )}
                    </View>
                    {(item.unreadChatCount ?? 0) > 0 && !isCancelled && (
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>💬 {item.unreadChatCount}</Text>
                      </View>
                    )}
                    <Text style={[styles.cardChevron, { color: colors.mutedForeground, opacity: 0.4 }]}>›</Text>
                  </View>

                  {/* SHARE CODE ROW (host only) */}
                  {!isCancelled && item.role === "host" && (
                    <View style={styles.codeRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.codeBtn,
                          { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                        onPress={(e) => { e.stopPropagation?.(); handleGetCode(item.id); }}
                        testID={`share-code-btn-${item.id}`}
                      >
                        <Text style={[styles.codeBtnText, { color: colors.foreground }]}>
                          {shownCodes[item.id] ? "Hide code" : "Share code"}
                        </Text>
                      </Pressable>
                      {shownCodes[item.id] && (
                        <Text
                          style={[styles.codeDisplay, { color: colors.primary }]}
                          testID={`join-code-display-${item.id}`}
                        >
                          {shownCodes[item.id]}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* ACKNOWLEDGE CANCELLED */}
                  {isCancelled && (
                    <View style={styles.acknowledgeRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.acknowledgeBtn,
                          {
                            borderColor: colors.border,
                            opacity: (pressed || acknowledgingEventId === item.id) ? 0.65 : 1,
                          },
                        ]}
                        onPress={(e) => { e.stopPropagation?.(); handleAcknowledgeCancellation(item.id); }}
                        disabled={acknowledgingEventId === item.id}
                        testID={`acknowledge-cancelled-${item.id}`}
                      >
                        <Text style={[styles.acknowledgeBtnText, { color: colors.mutedForeground }]}>
                          Dismiss
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── COMPLETED EVENTS ACCORDION ── */}
        {completedEvents.length > 0 && (
          <View style={styles.accordionWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.accordionHeader,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => setCompletedOpen((o) => !o)}
              testID="completed-events-accordion"
            >
              <Text style={styles.accordionIcon}>✅</Text>
              <Text style={[styles.accordionTitle, { color: colors.foreground }]}>Completed</Text>
              <View style={[styles.accordionBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.accordionBadgeText, { color: colors.mutedForeground }]}>{completedEvents.length}</Text>
              </View>
              <Ionicons name={completedOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={styles.accordionChevron} />
            </Pressable>
            {completedOpen && (
              <View style={styles.accordionContent}>
                {groupByMonth(completedEvents).map(({ month, items: monthItems }) => (
                  <View key={month}>
                    <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{month}</Text>
                    {monthItems.map((item) => {
                      const status = getEventStatus(item.startsAt, item.cancelledAt);
                      const dateLabel = formatEventDate(item.startsAt);
                      const cardBg = getCardTint(status.label, false);
                      const isHost = item.role === "host";
                      return (
                        <Pressable
                          key={String(item.id)}
                          style={({ pressed }) => [styles.eventCard, { backgroundColor: cardBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
                          onPress={() => router.push(`/event/${item.id}`)}
                          testID={`event-card-${item.id}`}
                        >
                          <View style={styles.eventTitleRow}>
                            <Ionicons name={categoryIcon(item.restaurantName ?? undefined)} size={15} color="#6B7280" />
                            <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
                            <View style={[styles.eventStatusBadge, { backgroundColor: status.bg }]}>
                              <Text style={[styles.eventStatusText, { color: status.color }]}>{status.label}</Text>
                            </View>
                          </View>
                          {item.restaurantName ? (
                            <Text style={[styles.eventMeta, styles.eventMetaLocation]} numberOfLines={1}>{item.restaurantName}</Text>
                          ) : null}
                          {dateLabel ? (
                            <Text style={[styles.eventMeta, styles.eventMetaDate]} numberOfLines={1}>{dateLabel}</Text>
                          ) : null}
                          {((item.goingCount ?? 0) + (item.notGoingCount ?? 0) + (item.notRespondedCount ?? 0)) > 0 && (
                            <View style={styles.participantStatsRow}>
                              {(item.goingCount ?? 0) > 0 && (
                                <View style={styles.participantStat}>
                                  <Text style={[styles.participantStatDot, { color: "#16A34A" }]}>●</Text>
                                  <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.goingCount} going</Text>
                                </View>
                              )}
                              {(item.notGoingCount ?? 0) > 0 && (
                                <View style={styles.participantStat}>
                                  <Text style={[styles.participantStatDot, { color: "#EF4444" }]}>●</Text>
                                  <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.notGoingCount} not going</Text>
                                </View>
                              )}
                              {(item.notRespondedCount ?? 0) > 0 && (
                                <View style={styles.participantStat}>
                                  <Text style={[styles.participantStatDot, { color: "#94A3B8" }]}>●</Text>
                                  <Text style={[styles.participantStatText, { color: colors.mutedForeground }]}>{item.notRespondedCount} no response</Text>
                                </View>
                              )}
                            </View>
                          )}
                          <View style={styles.cardFooter}>
                            <View style={[styles.roleChip, isHost
                              ? { backgroundColor: colors.primary + "18", borderColor: colors.primary + "45" }
                              : { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                              <Text style={[styles.roleChipText, { color: isHost ? colors.primary : colors.mutedForeground }]}>{roleLabel(item.role)}</Text>
                            </View>
                            <Text style={[styles.cardChevron, { color: colors.mutedForeground, opacity: 0.4 }]}>›</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── CANCELLED EVENTS ACCORDION ── */}
        {cancelledEvents.length > 0 && (
          <View style={styles.accordionWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.accordionHeader,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => setCancelledOpen((o) => !o)}
              testID="cancelled-events-accordion"
            >
              <Text style={styles.accordionIcon}>🚫</Text>
              <Text style={[styles.accordionTitle, { color: colors.foreground }]}>Cancelled</Text>
              <View style={[styles.accordionBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.accordionBadgeText, { color: colors.mutedForeground }]}>{cancelledEvents.length}</Text>
              </View>
              <Ionicons name={cancelledOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={styles.accordionChevron} />
            </Pressable>
            {cancelledOpen && (
              <View style={styles.accordionContent}>
                {groupByMonth(cancelledEvents).map(({ month, items: monthItems }) => (
                  <View key={month}>
                    <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{month}</Text>
                    {monthItems.map((item) => {
                      const status = getEventStatus(item.startsAt, item.cancelledAt);
                      const dateLabel = formatEventDate(item.startsAt);
                      return (
                        <Pressable
                          key={String(item.id)}
                          style={({ pressed }) => [styles.eventCard, { backgroundColor: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.25)", opacity: pressed ? 0.88 : 1 }]}
                          onPress={() => router.push(`/event/${item.id}`)}
                          testID={`event-card-${item.id}`}
                        >
                          <View style={styles.eventTitleRow}>
                            <Ionicons name={categoryIcon(item.restaurantName ?? undefined)} size={15} color="#94A3B8" />
                            <Text style={[styles.eventTitle, { color: colors.foreground, opacity: 0.5 }]} numberOfLines={1}>{item.title}</Text>
                            <View style={[styles.eventStatusBadge, { backgroundColor: status.bg }]}>
                              <Text style={[styles.eventStatusText, { color: status.color }]}>{status.label}</Text>
                            </View>
                          </View>
                          {item.restaurantName ? (
                            <Text style={[styles.eventMeta, styles.eventMetaLocation, { opacity: 0.5 }]} numberOfLines={1}>{item.restaurantName}</Text>
                          ) : null}
                          {dateLabel ? (
                            <Text style={[styles.eventMeta, styles.eventMetaDate, { opacity: 0.5 }]} numberOfLines={1}>{dateLabel}</Text>
                          ) : null}
                          <View style={[styles.cardFooter, { opacity: 0.5 }]}>
                            <View style={[styles.roleChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                              <Text style={[styles.roleChipText, { color: colors.mutedForeground }]}>{roleLabel(item.role)}</Text>
                            </View>
                            <Text style={[styles.cardChevron, { color: colors.mutedForeground, opacity: 0.4 }]}>›</Text>
                          </View>
                          <View style={styles.acknowledgeRow}>
                            <Pressable
                              style={({ pressed }) => [styles.acknowledgeBtn, { borderColor: colors.border, opacity: (pressed || acknowledgingEventId === item.id) ? 0.65 : 1 }]}
                              onPress={(e) => { e.stopPropagation?.(); handleAcknowledgeCancellation(item.id); }}
                              disabled={acknowledgingEventId === item.id}
                              testID={`acknowledge-cancelled-${item.id}`}
                            >
                              <Text style={[styles.acknowledgeBtnText, { color: colors.mutedForeground }]}>Dismiss</Text>
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  containerContent: { flexGrow: 1, paddingHorizontal: 20 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 1,
    paddingRight: 12,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  plansPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  plansPillText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  avatar: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans_700Bold",
  },

  // ── Action buttons ───────────────────────────────────────────────────────
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  primaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionBtnIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  actionBtnLabel: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // ── Pending invitations ──────────────────────────────────────────────────
  noInvitationsHint: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", marginBottom: 0, paddingHorizontal: 4, opacity: 0.4 },
  invitationsSection: { marginBottom: 16, gap: 10 },
  invitationsSectionTitle: { fontSize: 20, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", marginBottom: 4 },
  inviteCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inviteCardHeader: { gap: 3 },
  inviteCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteEventTitle: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", flex: 1 },
  inviteRestaurant: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  inviteHost: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  inviteActions: { flexDirection: "row", gap: 10 },
  declineBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  acceptBtn: {
    flex: 2,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },

  // ── Section header ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 22, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },

  // ── Create / Join forms ──────────────────────────────────────────────────
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  formInput: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cityOrZipInput: {
    fontSize: 13,
    paddingVertical: 8,
    opacity: 0.85,
  },
  locationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  locationStatusText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  destinationInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  destinationClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  destinationClearText: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  locationHint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 3,
    paddingHorizontal: 2,
  },
  joinErrorText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
  },
  destinationResultsList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 2,
    overflow: "hidden",
  },
  destinationResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 2,
  },
  destinationResultName: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  destinationResultAddress: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickerBtn: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  pickerBtnText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  pickerBtnDisabled: {
    opacity: 0.38,
  },
  datePickerWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    marginHorizontal: -16,
  },
  timePickerWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  toggleHint: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", marginTop: 2 },
  friendSelectSection: { gap: 6 },
  friendSelectLabel: { fontSize: 12, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  friendChipsRow: { gap: 8, paddingVertical: 2 },
  friendChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 140,
  },
  friendChipText: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  errorText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  actionBtn: {
    flex: 2,
    height: 42,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },

  // ── Events list ──────────────────────────────────────────────────────────
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 8 },
  emptyIllustration: { fontSize: 52, lineHeight: 64 },
  emptyTitle: { fontSize: 19, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", lineHeight: 21 },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 6, width: "100%" },
  emptyPrimaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: "center" },
  emptyPrimaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  emptySecondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  emptySecondaryBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  skeletonLine: { borderRadius: 5, opacity: 0.5 },
  list: { gap: 10, paddingBottom: 8 },

  eventCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventTitle: { fontSize: 16, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", flex: 1, lineHeight: 21 },
  eventStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  eventStatusText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  destinationBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1, marginLeft: 2 },
  destinationBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(194,65,12,0.10)", borderWidth: 1, borderColor: "rgba(194,65,12,0.20)" },
  destinationBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#C2410C" },
  votingClosedBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(100,116,139,0.10)", borderWidth: 1, borderColor: "rgba(100,116,139,0.20)" },
  votingClosedBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", color: "#64748B" },
  votingCountdownText: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular" },
  eventMeta: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", paddingLeft: 2 },
  eventMetaLocation: { color: "#9CA3AF" },
  eventMetaDate: { color: "#6B7280", fontFamily: "PlusJakartaSans_500Medium", fontWeight: "500" },

  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  cardFooterLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  roleChipText: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  privateChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  privateChipText: { fontSize: 11, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  cardChevron: { fontSize: 18, fontWeight: "300", lineHeight: 20 },

  privateBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  privateBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },

  codeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  codeBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5 },
  codeBtnText: { fontSize: 10, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  codeDisplay: { fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold", letterSpacing: 2 },

  acknowledgeRow: { marginTop: 2 },
  acknowledgeBtn: {
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  acknowledgeBtnText: { fontSize: 12, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },

  // ── Participant stats row ────────────────────────────────────────────────
  participantStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  participantStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantStatDot: { fontSize: 7, lineHeight: 14 },
  participantStatText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },

  // ── Completed / Cancelled accordions ────────────────────────────────────
  accordionWrapper: { marginTop: 10 },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  accordionIcon: { fontSize: 14, lineHeight: 18 },
  accordionTitle: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  accordionBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  accordionBadgeText: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  accordionChevron: { marginLeft: "auto" },
  accordionContent: { paddingTop: 10, gap: 0 },
  monthLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },

  // ── Cancelled events footer row ──────────────────────────────────────────
  cancelledFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cancelledFooterIcon: { fontSize: 14, lineHeight: 18 },
  cancelledFooterText: { flex: 1, fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },
  cancelledChevron: { fontSize: 16, fontWeight: "300", lineHeight: 20 },

  // ── Path selection ──────────────────────────────────────────────────────────
  pathSelectTitle: { fontSize: 16, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold", marginBottom: 4, textAlign: "center" },
  pathOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 10,
  },
  pathOptionIcon: { fontSize: 24, width: 32, textAlign: "center" },
  pathOptionText: { flex: 1 },
  pathOptionTitle: { fontSize: 15, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  pathOptionDesc: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular", marginTop: 2 },

  // ── Profile nudge banner ─────────────────────────────────────────────────────
  profileNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  profileNudgeIcon: { fontSize: 18, flexShrink: 0 },
  profileNudgeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 18,
  },
  profileNudgeArrow: { fontSize: 16, fontWeight: "600", flexShrink: 0 },

  // ── Decide later banner ─────────────────────────────────────────────────────
  decideLaterBanner: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  decideLaterBannerText: { fontSize: 13, fontFamily: "PlusJakartaSans_400Regular" },

  // ── Create-screen destination mode toggle ────────────────────────────────────
  destModeRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  destModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  destModeBtnText: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold" },

  // ── Create-screen discovery panel ────────────────────────────────────────────
  createDiscoveryPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  cuisineChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  cuisineChipText: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },
  cuisineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cuisineGridCell: { width: "31%", paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, alignItems: "center", gap: 4 },
  cuisineGridEmoji: { fontSize: 22 },
  cuisineGridLabel: { fontSize: 11, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium", textAlign: "center" },
  discoverBtn: {
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  discoverBtnText: { fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold" },

  // ── Contacts picker (create form) ────────────────────────────────────────────
  contactsPickerSection: { gap: 6 },
  contactsPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  contactsPickerBtnText: { fontSize: 13, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  contactPickerList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  contactPickerEmpty: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    padding: 14,
    textAlign: "center",
    opacity: 0.6,
  },
  contactPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  contactPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  contactPickerAvatarText: { fontSize: 14, fontWeight: "700", fontFamily: "PlusJakartaSans_700Bold" },
  contactPickerInfo: { flex: 1 },
  contactPickerName: { fontSize: 14, fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
  contactPickerHandle: { fontSize: 12, fontFamily: "PlusJakartaSans_400Regular" },

  // ── Error / char-counter states ───────────────────────────────────────────
  errorState: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32, gap: 14 },
  errorStateText: { fontSize: 15, fontFamily: "PlusJakartaSans_400Regular", textAlign: "center" },
  errorRetryBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 9 },
  errorRetryText: { fontSize: 14, fontWeight: "500", fontFamily: "PlusJakartaSans_500Medium" },
  charCounter: { fontSize: 11, fontFamily: "PlusJakartaSans_400Regular", textAlign: "right", marginTop: 2, paddingHorizontal: 2 },
});
