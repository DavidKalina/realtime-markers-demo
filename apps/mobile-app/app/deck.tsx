import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Search, X } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import QuestCardDeck from "@/components/Itinerary/QuestCardDeck";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { fontFamily, fontSize, fontWeight, radius, spacing, useColors } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TIER_ORDER = ["QUICK", "SWEET_SPOT", "BEST"] as const;

const MOCK_COMPLETED: SidequestResponse[] = [
  {
    id: "mock-aurora-001",
    city: "Portland",
    budgetMax: 45,
    activityTypes: ["hiking", "outdoors"],
    title: "Forest Park Loop",
    summary: "Wind through old-growth trails and end at a hidden overlook above the city.",
    status: "READY",
    tier: "QUICK",
    categories: ["trail", "outdoors"],
    completedAt: "2026-03-15T18:30:00Z",
    createdAt: "2026-03-15T10:00:00Z",
    objectives: [
      { id: "o1a", sortOrder: 0, title: "Wildwood Trailhead", emoji: "\ud83c\udf32", venueName: "Wildwood Trail", hook: "Start at the stone marker", checkedInAt: "2026-03-15T11:00:00Z" },
      { id: "o1b", sortOrder: 1, title: "Witch's Castle", emoji: "\ud83c\udff0", venueName: "Stone House Ruins", hook: "Snap a pic of the mossy walls", estimatedCost: 0, checkedInAt: "2026-03-15T12:30:00Z" },
      { id: "o1c", sortOrder: 2, title: "Pittock Mansion Overlook", emoji: "\ud83c\udf05", venueName: "Pittock Mansion", hook: "Catch the city view from the lawn", estimatedCost: 0, checkedInAt: "2026-03-15T14:00:00Z" },
    ],
  },
  {
    id: "mock-stardust-002",
    city: "Austin",
    budgetMax: 60,
    activityTypes: ["music", "nightlife"],
    title: "6th Street Soundwalk",
    summary: "Hop between live music stages and end at a rooftop with skyline views.",
    status: "READY",
    tier: "SWEET_SPOT",
    categories: ["music", "nightlife"],
    completedAt: "2026-03-10T23:45:00Z",
    createdAt: "2026-03-10T19:00:00Z",
    objectives: [
      { id: "o2a", sortOrder: 0, title: "Continental Club", emoji: "\ud83c\udfb8", venueName: "Continental Club", hook: "Catch whoever's on the small stage", estimatedCost: 10, checkedInAt: "2026-03-10T20:00:00Z" },
      { id: "o2b", sortOrder: 1, title: "Skylark Lounge", emoji: "\ud83c\udf78", venueName: "Skylark Lounge", hook: "Try the house mezcal flight", estimatedCost: 18, checkedInAt: "2026-03-10T21:30:00Z" },
    ],
  },
  {
    id: "mock-mythic-003",
    city: "Chicago",
    budgetMax: 35,
    activityTypes: ["food", "restaurant"],
    title: "Pilsen Taco Crawl",
    summary: "Hit three legendary taquerias in Pilsen and vote on the best al pastor.",
    status: "READY",
    tier: "QUICK",
    categories: ["restaurant", "food"],
    completedAt: "2026-03-08T20:00:00Z",
    createdAt: "2026-03-08T17:00:00Z",
    objectives: [
      { id: "o3a", sortOrder: 0, title: "Don Pedro Carnitas", emoji: "\ud83c\udf2e", venueName: "Don Pedro Carnitas", hook: "Order the carnitas by the pound", estimatedCost: 12, checkedInAt: "2026-03-08T17:30:00Z" },
      { id: "o3b", sortOrder: 1, title: "Taqueria Los Comales", emoji: "\ud83c\udf36\ufe0f", venueName: "Los Comales", hook: "The green salsa here is no joke", estimatedCost: 10, checkedInAt: "2026-03-08T18:30:00Z" },
      { id: "o3c", sortOrder: 2, title: "5 Rabanitos", emoji: "\ud83e\udd29", venueName: "5 Rabanitos", hook: "Finish with their birria quesadilla", estimatedCost: 14, checkedInAt: "2026-03-08T19:30:00Z" },
    ],
  },
  {
    id: "mock-aurora-004",
    city: "Denver",
    budgetMax: 25,
    activityTypes: ["cafe", "reading"],
    title: "Bookshop & Brew",
    summary: "Browse indie bookshops, grab a cortado, and read in a sunny park.",
    status: "READY",
    tier: "SWEET_SPOT",
    categories: ["cafe", "reading"],
    completedAt: "2026-03-05T16:00:00Z",
    createdAt: "2026-03-05T10:00:00Z",
    objectives: [
      { id: "o4a", sortOrder: 0, title: "Tattered Cover", emoji: "\ud83d\udcda", venueName: "Tattered Cover Bookstore", hook: "Head straight to the staff picks wall", estimatedCost: 15, checkedInAt: "2026-03-05T11:00:00Z" },
      { id: "o4b", sortOrder: 1, title: "Huckleberry Roasters", emoji: "\u2615", venueName: "Huckleberry Roasters", hook: "The cortado with oat milk", estimatedCost: 6, checkedInAt: "2026-03-05T12:30:00Z" },
      { id: "o4c", sortOrder: 2, title: "Cheesman Park", emoji: "\ud83c\udf33", venueName: "Cheesman Park", hook: "Find a bench near the pavilion and read", estimatedCost: 0, checkedInAt: "2026-03-05T14:00:00Z" },
    ],
  },
  {
    id: "mock-stardust-005",
    city: "Seattle",
    budgetMax: 50,
    activityTypes: ["museum", "culture"],
    title: "Capitol Hill Art Walk",
    summary: "Gallery hop through Capitol Hill's best spots and end with ramen.",
    status: "READY",
    tier: "BEST",
    categories: ["gallery", "art"],
    completedAt: "2026-03-01T21:00:00Z",
    createdAt: "2026-03-01T14:00:00Z",
    objectives: [
      { id: "o5a", sortOrder: 0, title: "SOIL Gallery", emoji: "\ud83c\udfa8", venueName: "SOIL Art Gallery", hook: "Rotating local artists \u2014 always a surprise", estimatedCost: 0, checkedInAt: "2026-03-01T15:00:00Z" },
      { id: "o5b", sortOrder: 1, title: "Vermillion", emoji: "\ud83d\uddbc\ufe0f", venueName: "Vermillion Art Bar", hook: "Art on the walls, cocktails in hand", estimatedCost: 14, checkedInAt: "2026-03-01T16:30:00Z" },
      { id: "o5c", sortOrder: 2, title: "Kizuki Ramen", emoji: "\ud83c\udf5c", venueName: "Kizuki Ramen", hook: "The garlic tonkotsu after all that walking", estimatedCost: 16, checkedInAt: "2026-03-01T18:00:00Z" },
    ],
  },
  {
    id: "mock-cosmic-006",
    city: "San Diego",
    budgetMax: 30,
    activityTypes: ["beach", "swimming"],
    title: "Tide Pool Expedition",
    summary: "Chase the low tide through La Jolla's hidden coves and sea caves.",
    status: "READY",
    tier: "BEST",
    categories: ["beach", "swimming"],
    completedAt: "2026-02-28T17:30:00Z",
    createdAt: "2026-02-28T09:00:00Z",
    objectives: [
      { id: "o6a", sortOrder: 0, title: "Shell Beach Pools", emoji: "\ud83e\uddea", venueName: "Shell Beach", hook: "Look for the sea hare in the big pool", estimatedCost: 0, checkedInAt: "2026-02-28T10:00:00Z" },
      { id: "o6b", sortOrder: 1, title: "Sea Cave Kayak", emoji: "\ud83d\udef6", venueName: "La Jolla Sea Cave", hook: "Paddle into the seventh cave at low tide", estimatedCost: 20, checkedInAt: "2026-02-28T12:00:00Z" },
      { id: "o6c", sortOrder: 2, title: "Sunset Fish Tacos", emoji: "\ud83c\udf2e", venueName: "Oscar's Mexican Seafood", hook: "Smoked fish taco on the seawall", estimatedCost: 10, checkedInAt: "2026-02-28T16:30:00Z" },
    ],
  },
  {
    id: "mock-sahara-007",
    city: "Tucson",
    budgetMax: 20,
    activityTypes: ["thrift", "antique"],
    title: "Desert Vintage Run",
    summary: "Dig through Tucson's best thrift and antique shops before the heat hits.",
    status: "READY",
    tier: "QUICK",
    categories: ["thrift", "antique"],
    completedAt: "2026-02-22T14:00:00Z",
    createdAt: "2026-02-22T08:00:00Z",
    objectives: [
      { id: "o7a", sortOrder: 0, title: "Speedway Antique Mall", emoji: "\ud83c\udffa", venueName: "Speedway Antique Mall", hook: "The turquoise jewelry case in the back", estimatedCost: 10, checkedInAt: "2026-02-22T09:00:00Z" },
      { id: "o7b", sortOrder: 1, title: "Buffalo Exchange", emoji: "\ud83d\udc55", venueName: "Buffalo Exchange", hook: "Vintage denim wall \u2014 trust", estimatedCost: 8, checkedInAt: "2026-02-22T10:30:00Z" },
    ],
  },
  {
    id: "mock-forest-008",
    city: "Asheville",
    budgetMax: 40,
    activityTypes: ["camping", "bonfire"],
    title: "Blue Ridge Firelight",
    summary: "Hike to a ridge overlook, gather wood, and watch fireflies fill the valley.",
    status: "READY",
    tier: "SWEET_SPOT",
    categories: ["camping", "bonfire"],
    completedAt: "2026-02-18T22:00:00Z",
    createdAt: "2026-02-18T15:00:00Z",
    objectives: [
      { id: "o8a", sortOrder: 0, title: "Craggy Gardens Trail", emoji: "\u26f0\ufe0f", venueName: "Craggy Gardens", hook: "The rhododendron tunnel is wild", estimatedCost: 0, checkedInAt: "2026-02-18T16:00:00Z" },
      { id: "o8b", sortOrder: 1, title: "Ridge Fire Pit", emoji: "\ud83d\udd25", venueName: "Craggy Pinnacle Overlook", hook: "Best spot for the sunset bonfire", estimatedCost: 5, checkedInAt: "2026-02-18T18:30:00Z" },
      { id: "o8c", sortOrder: 2, title: "Firefly Watch", emoji: "\u2728", venueName: "Blue Ridge Parkway Meadow", hook: "Lights off, eyes open \u2014 they come around 9pm", estimatedCost: 0, checkedInAt: "2026-02-18T21:00:00Z" },
    ],
  },
  {
    id: "mock-cavern-009",
    city: "Nashville",
    budgetMax: 55,
    activityTypes: ["arcade", "brewery"],
    title: "Neon Underground",
    summary: "Pinball bars, craft beer tunnels, and an escape room under Broadway.",
    status: "READY",
    tier: "BEST",
    categories: ["arcade", "brewery"],
    completedAt: "2026-02-14T23:30:00Z",
    createdAt: "2026-02-14T18:00:00Z",
    objectives: [
      { id: "o9a", sortOrder: 0, title: "Two Bits", emoji: "\ud83c\udfae", venueName: "Two Bits Retro Arcade", hook: "Find the broken Galaga \u2014 it gives free credits", estimatedCost: 10, checkedInAt: "2026-02-14T19:00:00Z" },
      { id: "o9b", sortOrder: 1, title: "Bearded Iris Taproom", emoji: "\ud83c\udf7a", venueName: "Bearded Iris Brewing", hook: "The Homestyle IPA on nitro", estimatedCost: 18, checkedInAt: "2026-02-14T20:30:00Z" },
      { id: "o9c", sortOrder: 2, title: "The Escape Game", emoji: "\ud83d\udd10", venueName: "The Escape Game Nashville", hook: "Gold Rush room \u2014 the hardest one", estimatedCost: 28, checkedInAt: "2026-02-14T22:00:00Z" },
    ],
  },
];

function getNextTier(current: string): string | null {
  const idx = TIER_ORDER.indexOf(current as (typeof TIER_ORDER)[number]);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

// --- Promotion Overlay ---

const PromotionOverlay: React.FC<{
  card: SidequestResponse | null;
  visible: boolean;
  onMidpoint: () => void;
  onComplete: () => void;
}> = React.memo(({ card, visible, onMidpoint, onComplete }) => {
  const [promotingId, setPromotingId] = useState<string | null>(null);
  // Keep modal mounted until exit animation finishes
  const [modalVisible, setModalVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);

  const finishClose = useCallback(() => {
    setModalVisible(false);
    setClosing(false);
    onComplete();
  }, [onComplete]);

  // Open: fade in backdrop, scale up card
  useEffect(() => {
    if (visible && card) {
      setModalVisible(true);
      setClosing(false);
      backdropOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });
      cardScale.value = withSpring(1, { damping: 18, stiffness: 140 });
      cardOpacity.value = withTiming(1, { duration: 300 });
      // Start promotion after entrance settles
      const t = setTimeout(() => setPromotingId(card.id), 500);
      return () => clearTimeout(t);
    }
  }, [visible, card?.id]);

  // After promotion animation completes — start the exit
  const handlePromotionComplete = useCallback(() => {
    setPromotingId(null);
    // Linger on upgraded card, then animate out
    setTimeout(() => {
      setClosing(true);
      // Card shrinks and fades
      cardScale.value = withTiming(0.75, {
        duration: 350,
        easing: Easing.in(Easing.cubic),
      });
      cardOpacity.value = withTiming(0, { duration: 300 });
      // Backdrop fades
      backdropOpacity.value = withTiming(
        0,
        { duration: 400, easing: Easing.in(Easing.ease) },
        () => {
          scheduleOnRN(finishClose);
        },
      );
    }, 600);
  }, [finishClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardContainerStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  if (!card) return null;

  const options = [card];

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={overlayStyles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            tint="dark"
            intensity={60}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>
        <Animated.View style={[overlayStyles.content, cardContainerStyle]}>
          <QuestCardDeck
            options={options}
            mode="browse"
            hideHeader
            promotingId={promotingId}
            onPromotionMidpoint={onMidpoint}
            onPromotionComplete={handlePromotionComplete}
          />
        </Animated.View>
      </View>
    </Modal>
  );
});

PromotionOverlay.displayName = "PromotionOverlay";

const overlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
});

// --- Screen ---

const DeckScreen = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState(MOCK_COMPLETED);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [promotingCard, setPromotingCard] = useState<SidequestResponse | null>(null);

  const activeCardRef = useRef(0);

  const handlePromote = useCallback(() => {
    const card = cards[activeCardRef.current];
    if (!card || overlayVisible) return;
    const next = getNextTier(card.tier ?? "QUICK");
    if (!next) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPromotingCard(card);
    setOverlayVisible(true);
  }, [cards, overlayVisible]);

  const handleMidpoint = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    // Upgrade tier in the overlay card AND the deck
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== promotingCard?.id) return c;
        const next = getNextTier(c.tier ?? "QUICK");
        const now = new Date().toISOString();
        return next
          ? { ...c, tier: next as SidequestResponse["tier"], promotedAt: now }
          : c;
      }),
    );
    setPromotingCard((prev) => {
      if (!prev) return prev;
      const next = getNextTier(prev.tier ?? "QUICK");
      const now = new Date().toISOString();
      return next
        ? { ...prev, tier: next as SidequestResponse["tier"], promotedAt: now }
        : prev;
    });
  }, [promotingCard]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverlayVisible(false);
    setPromotingCard(null);
  }, []);

  const activeCard = cards[activeCardRef.current];
  const canPromote =
    !overlayVisible && activeCard && getNextTier(activeCard.tier ?? "QUICK") !== null;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.bg.primary },
      ]}
    >
      <View style={styles.deckArea}>
        <QuestCardDeck
          options={cards}
          mode="browse"
          hideHeader
        />
      </View>

      <Pressable
        style={[
          styles.promoteButton,
          {
            backgroundColor: canPromote
              ? "rgba(168, 85, 247, 0.15)"
              : "rgba(255, 255, 255, 0.04)",
            borderColor: canPromote
              ? "rgba(168, 85, 247, 0.4)"
              : "rgba(255, 255, 255, 0.08)",
          },
        ]}
        onPress={handlePromote}
        disabled={!canPromote}
      >
        <Text
          style={[
            styles.promoteText,
            {
              color: canPromote
                ? "rgba(168, 85, 247, 0.95)"
                : "rgba(255, 255, 255, 0.2)",
            },
          ]}
        >
          PROMOTE
        </Text>
      </Pressable>

      <PromotionOverlay
        card={promotingCard}
        visible={overlayVisible}
        onMidpoint={handleMidpoint}
        onComplete={handleComplete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  deckArea: {
    flex: 1,
    justifyContent: "center",
  },
  promoteButton: {
    alignSelf: "center",
    paddingHorizontal: spacing.xl + spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  promoteText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    letterSpacing: 2,
  },
});

export default DeckScreen;
