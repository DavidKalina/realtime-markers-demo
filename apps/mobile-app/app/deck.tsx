import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import QuestCardDeck from "@/components/Itinerary/QuestCardDeck";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TIER_ORDER = ["QUICK", "SWEET_SPOT", "BEST"] as const;

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
      backdropOpacity.value = withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.ease),
      });
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
  const [cards, setCards] = useState<SidequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [promotingCard, setPromotingCard] = useState<SidequestResponse | null>(
    null,
  );

  const activeCardRef = useRef(0);

  useEffect(() => {
    apiClient.sidequests
      .listCompleted()
      .then(({ data }) => setCards(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    !overlayVisible &&
    activeCard &&
    getNextTier(activeCard.tier ?? "QUICK") !== null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: colors.bg.primary,
        },
      ]}
    >
      <View style={styles.deckArea}>
        {loading ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : cards.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            No completed sidequests yet
          </Text>
        ) : (
          <QuestCardDeck options={cards} mode="browse" hideHeader />
        )}
      </View>

      {cards.length > 0 ? (
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
      ) : null}

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
  emptyText: {
    textAlign: "center",
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
});

export default DeckScreen;
