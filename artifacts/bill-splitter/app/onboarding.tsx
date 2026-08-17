import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PRIMARY = "#C2410C";
const BG = "#1a1f3c";
const CARD = "#FFFFFF";
const MUTED = "#94A3B8";
const BORDER = "rgba(255,255,255,0.12)";

// ── Slide illustrations ────────────────────────────────────────────────────

function PromiseIllustration() {
  return (
    <View style={ill.wrapper}>
      <View style={ill.glow} />
      <Text style={[ill.floatEmoji, { top: "18%", left: "12%" }]}>🍣</Text>
      <Text style={[ill.floatEmoji, { top: "28%", right: "14%" }]}>🍷</Text>
      <Text style={[ill.floatEmoji, { top: "52%", left: "38%" }]}>🥗</Text>
      <Text style={[ill.floatEmoji, { top: "14%", right: "38%" }]}>🍔</Text>
      <Text style={[ill.floatEmoji, { bottom: "22%", left: "18%" }]}>🧾</Text>
      <Text style={[ill.floatEmoji, { bottom: "18%", right: "20%" }]}>👥</Text>
      <Text style={[ill.sparkle, { top: "26%", left: "28%" }]}>✨</Text>
      <Text style={[ill.sparkle, { top: "48%", right: "22%" }]}>✨</Text>
      <Text style={[ill.sparkle, { bottom: "30%", left: "52%" }]}>✨</Text>
    </View>
  );
}

function FriendsIllustration() {
  const friends = [
    { initials: "JM", color: PRIMARY, name: "Jordan M.", sub: "@jordanm", added: true },
    { initials: "SK", color: "#F97316", name: "Sam K.", sub: "@samkwon", added: true },
    { initials: "AT", color: "#10B981", name: "Alex T.", sub: "@alext", added: true },
    { initials: "RB", color: "#F59E0B", name: "Riley B.", sub: "@rileyb", added: false },
  ];
  return (
    <View style={ill.wrapper}>
      <View style={ill.card}>
        <Text style={ill.cardTitle}>Add to Friday Night Sushi 🍣</Text>
        <Text style={ill.cardSub}>3 of 4 added</Text>
        {friends.map((f, i) => (
          <View key={f.initials} style={[ill.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F3F4F6" }]}>
            <View style={[ill.avatar, { backgroundColor: f.color }]}>
              <Text style={ill.avatarText}>{f.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ill.rowName}>{f.name}</Text>
              <Text style={ill.rowSub}>{f.sub}</Text>
            </View>
            <View style={[ill.pill, f.added ? ill.pillAdded : ill.pillAdd]}>
              <Text style={[ill.pillText, { color: f.added ? CARD : "#6B7280" }]}>
                {f.added ? "✓ Added" : "Add"}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanIllustration() {
  return (
    <View style={ill.wrapper}>
      <View style={ill.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 44, height: 44, backgroundColor: "#FFF7ED", borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>🍣</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ill.cardTitle}>Nobu Downtown</Text>
            <Text style={ill.cardSub}>Japanese · ⭐ 4.8</Text>
          </View>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: CARD, fontSize: 12 }}>✓</Text>
          </View>
        </View>
        <View style={ill.divider} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={ill.fieldLabel}>Date</Text>
            <View style={ill.fieldPill}>
              <Text style={ill.fieldValue}>Fri, Jan 24</Text>
              <Text>📅</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ill.fieldLabel}>Time</Text>
            <View style={ill.fieldPill}>
              <Text style={ill.fieldValue}>7:30 PM</Text>
              <Text>🕣</Text>
            </View>
          </View>
        </View>
        <View style={[ill.fieldPill, { marginTop: 10, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }]}>
          <Text style={{ fontSize: 13, color: PRIMARY, fontFamily: "PlusJakartaSans_500Medium", flex: 1 }}>Friday Night Sushi 🍣</Text>
        </View>
      </View>
    </View>
  );
}

function JoinIllustration() {
  return (
    <View style={ill.wrapper}>
      <View style={ill.card}>
        <View style={{ backgroundColor: "#F3F4F6", borderRadius: 16, borderTopLeftRadius: 4, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {[PRIMARY, "#F97316"].map((c, i) => (
              <View key={i} style={[ill.avatar, { width: 28, height: 28, backgroundColor: c, marginLeft: i > 0 ? -8 : 0, zIndex: 2 - i }]}>
                <Text style={[ill.avatarText, { fontSize: 10 }]}>{i === 0 ? "J" : "S"}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 13, color: "#374151", fontFamily: "PlusJakartaSans_400Regular", lineHeight: 18 }}>
            Jordan added you to Friday Night Sushi 🍣
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ fontSize: 12 }}>🔗</Text>
            <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: "PlusJakartaSans_500Medium" }}>owmo.app/join/fri-sushi</Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans_600SemiBold", color: "#111827" }}>Friday Night Sushi 🍣</Text>
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 3, fontFamily: "PlusJakartaSans_400Regular" }}>Nobu Downtown · Fri Jan 24 · 7:30 PM</Text>
          <View style={{ backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 12 }}>
            <Text style={{ color: CARD, fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold" }}>Join event →</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SnapIllustration() {
  const items = [
    { name: "Spicy Tuna Roll", price: "$18" },
    { name: "Edamame", price: "$8" },
    { name: "Sake (2x)", price: "$28" },
    { name: "Dragon Roll", price: "$22" },
  ];
  return (
    <View style={ill.wrapper}>
      <View style={[ill.card, { transform: [{ rotate: "-2deg" }] }]}>
        <Text style={{ fontSize: 20, textAlign: "center", marginBottom: 4 }}>📷</Text>
        <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans_600SemiBold", color: "#374151", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>Nobu Downtown</Text>
        <Text style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "PlusJakartaSans_400Regular", textAlign: "center", marginBottom: 10 }}>Fri Jan 24 · Table 12</Text>
        <View style={ill.divider} />
        {items.map((item) => (
          <View key={item.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
            <Text style={{ fontSize: 13, color: "#374151", fontFamily: "PlusJakartaSans_400Regular" }}>{item.name}</Text>
            <Text style={{ fontSize: 13, color: "#374151", fontFamily: "PlusJakartaSans_500Medium" }}>{item.price}</Text>
          </View>
        ))}
        <View style={ill.divider} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans_600SemiBold", color: "#111827" }}>Total</Text>
          <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans_600SemiBold", color: PRIMARY }}>$76.00</Text>
        </View>
      </View>
    </View>
  );
}

function SettleIllustration() {
  const people = [
    { initials: "JM", color: PRIMARY, name: "Jordan M.", amount: "$28.50" },
    { initials: "SK", color: "#F97316", name: "Sam K.", amount: "$19.00" },
    { initials: "AT", color: "#10B981", name: "Alex T.", amount: "$22.75" },
  ];
  return (
    <View style={ill.wrapper}>
      <View style={ill.card}>
        <Text style={ill.cardTitle}>Friday Night Sushi 🍣</Text>
        <Text style={[ill.cardSub, { marginBottom: 12 }]}>Everyone's share</Text>
        {people.map((p, i) => (
          <View key={p.initials} style={[ill.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F3F4F6" }]}>
            <View style={[ill.avatar, { backgroundColor: p.color }]}>
              <Text style={ill.avatarText}>{p.initials}</Text>
            </View>
            <Text style={[ill.rowName, { flex: 1 }]}>{p.name}</Text>
            <View style={{ backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "#10B981", fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 13 }}>{p.amount}</Text>
            </View>
          </View>
        ))}
        <View style={ill.divider} />
        <View style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12 }}>
          <Text style={{ color: CARD, fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14 }}>Request payments →</Text>
        </View>
      </View>
    </View>
  );
}

// ── Slide data ─────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: "promise",
    headline: "Split bills,\nnot friendships",
    subtext: "Plan dinners, invite your crew, and split the bill — no awkwardness, ever.",
    illustration: <PromiseIllustration />,
  },
  {
    key: "friends",
    headline: "Your crew is\none tap away.",
    subtext: "Add friends once. Invite them to every dinner after that.",
    illustration: <FriendsIllustration />,
  },
  {
    key: "plan",
    headline: "Plan the\nperfect night.",
    subtext: "Pick a restaurant, set a time. Owmo handles the rest.",
    illustration: <PlanIllustration />,
  },
  {
    key: "join",
    headline: "Tap a link.\nYou're in.",
    subtext: "Got a dinner invite? One tap and you're part of the plan.",
    illustration: <JoinIllustration />,
  },
  {
    key: "snap",
    headline: "Snap a receipt.\nOwmo reads it.",
    subtext: "Point your camera at the bill. We handle the math.",
    illustration: <SnapIllustration />,
  },
  {
    key: "settle",
    headline: "Everyone sees\nexactly what they owe.",
    subtext: "No calculators. No drama. Just tap pay.",
    illustration: <SettleIllustration />,
  },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const markDone = useCallback(async () => {
    await AsyncStorage.setItem("onboardingComplete", "1");
    router.replace("/(auth)/sign-up");
  }, [router]);

  const handleNext = useCallback(() => {
    void Haptics.selectionAsync();
    if (activeIndex === SLIDES.length - 1) {
      markDone();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [activeIndex, markDone]);

  const handleDotPress = useCallback((index: number) => {
    void Haptics.selectionAsync();
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  return (
    <View style={[s.screen, { backgroundColor: BG }]}>
      {/* Wordmark */}
      <View style={[s.topChrome, { paddingTop: insets.top + 12 }]}>
        <Text style={s.wordmark}>Owmo</Text>
        <Pressable onPress={markDone} style={s.skipButton} hitSlop={16}>
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <View style={s.illustrationArea}>{item.illustration}</View>
            <View style={s.textArea}>
              <Text style={s.headline}>{item.headline}</Text>
              <Text style={s.subtext}>{item.subtext}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom chrome */}
      <View style={[s.bottomChrome, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              hitSlop={8}
              onPress={() => handleDotPress(i)}
              style={[
                s.dot,
                i === activeIndex ? s.dotActive : s.dotInactive,
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            s.cta,
            activeIndex === SLIDES.length - 1 && s.ctaFinal,
            pressed && { opacity: 0.88 },
          ]}
        >
          <Text style={s.ctaText}>
            {activeIndex === SLIDES.length - 1 ? "Get started →" : "Next →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Illustration stylesheet ────────────────────────────────────────────────

const ill = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: `${PRIMARY}22`,
    top: "30%",
    left: "25%",
  },
  floatEmoji: {
    position: "absolute",
    fontSize: 44,
  },
  sparkle: {
    position: "absolute",
    fontSize: 22,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 18,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#111827",
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#6B7280",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: CARD,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  rowName: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "#111827",
  },
  rowSub: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#9CA3AF",
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  pillAdded: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  pillAdd: {
    backgroundColor: "transparent",
    borderColor: "#E5E7EB",
  },
  pillText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  fieldPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "#374151",
    flex: 1,
  },
});

// ── Main stylesheet ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  wordmark: {
    color: CARD,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    letterSpacing: 4,
    fontStyle: "italic",
  },
  skipButton: {
    position: "absolute",
    right: 24,
  },
  skipText: {
    color: CARD,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    opacity: 0.6,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  illustrationArea: {
    flex: 1,
    paddingTop: 80,
  },
  textArea: {
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  headline: {
    color: CARD,
    fontSize: 38,
    fontFamily: "PlusJakartaSans_700Bold",
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtext: {
    color: MUTED,
    fontSize: 16,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 24,
  },
  bottomChrome: {
    paddingHorizontal: 24,
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: CARD,
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  cta: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
  },
  ctaFinal: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    color: CARD,
    fontSize: 17,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
