import React, { useCallback, useEffect, useState } from "react";
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
import { CheckinCaptureModal } from "@/components/Itinerary/CheckinCaptureModal";
import { QuestMemoryModal } from "@/components/Itinerary/QuestMemoryModal";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Memory modal for reviewing completed quests
  const [memoryCard, setMemoryCard] = useState<SidequestResponse | null>(null);

  // Capture modal for filling in skipped check-in data
  const [captureObjective, setCaptureObjective] = useState<{
    id: string;
    title: string;
    emoji?: string;
    suggestedActivities: string[];
    journalPrompt?: string;
  } | null>(null);

  const fetchCards = useCallback(() => {
    apiClient.sidequests
      .listCompleted()
      .then(({ data }) => setCards(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Tap a card → open memory modal, or capture modal if data is missing
  const handleCardPress = useCallback((card: SidequestResponse) => {
    // Track which card is active for promote
    const idx = cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) setActiveCardIndex(idx);

    // Check if any objective needs data capture
    const uncaptured = (card.objectives ?? []).find(
      (o) => o.checkedInAt && !o.journalEntry && !o.completedActivity,
    );
    if (uncaptured) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCaptureObjective({
        id: uncaptured.id,
        title: uncaptured.title,
        emoji: uncaptured.emoji,
        suggestedActivities: uncaptured.suggestedActivities ?? [],
        journalPrompt: uncaptured.journalPrompt,
      });
      return;
    }

    // Otherwise open the memory view
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMemoryCard(card);
  }, [cards]);

  const handlePromote = useCallback(() => {
    const card = cards[activeCardIndex];
    if (!card || overlayVisible || card.promotedAt) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPromotingCard(card);
    setOverlayVisible(true);
  }, [cards, activeCardIndex, overlayVisible]);

  const handleMidpoint = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);

    // Hit the API (fire-and-forget — animation shouldn't wait)
    if (promotingCard?.id) {
      apiClient.sidequests.promote(promotingCard.id).catch((err) => {
        console.error("[Deck] Promote API failed:", err);
      });
    }

    // Optimistically mark as promoted (assigns holographic foil)
    const now = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === promotingCard?.id ? { ...c, promotedAt: now } : c,
      ),
    );
    setPromotingCard((prev) =>
      prev ? { ...prev, promotedAt: now } : prev,
    );
  }, [promotingCard]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOverlayVisible(false);
    setPromotingCard(null);
  }, []);

  const activeCard = cards[activeCardIndex];
  const canPromote =
    !overlayVisible && activeCard && !activeCard.promotedAt;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: colors.bg.primary,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: colors.text.primary }]}>
          YOUR DECK
        </Text>
        <Text style={[styles.headerHint, { color: colors.text.secondary }]}>
          Swipe to browse · Tap to open
        </Text>
      </View>

      <View style={styles.deckArea}>
        {loading ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : cards.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            No completed sidequests yet
          </Text>
        ) : (
          <QuestCardDeck
            options={cards}
            mode="browse"
            hideHeader
            onPress={handleCardPress}
            onActiveIndexChange={setActiveCardIndex}
          />
        )}
      </View>

      {cards.length > 0 ? (
        <View
          style={[
            styles.promoteBar,
            !canPromote && { opacity: 0.4 },
          ]}
        >
          <Pressable
            style={styles.promoteButton}
            onPress={handlePromote}
            disabled={!canPromote}
          >
            <Text style={styles.promoteText}>Promote Card</Text>
          </Pressable>
        </View>
      ) : null}

      <CheckinCaptureModal
        visible={!!captureObjective}
        objectiveId={captureObjective?.id ?? ""}
        objectiveTitle={captureObjective?.title ?? ""}
        objectiveEmoji={captureObjective?.emoji}
        suggestedActivities={captureObjective?.suggestedActivities ?? []}
        journalPrompt={captureObjective?.journalPrompt}
        onDismiss={() => setCaptureObjective(null)}
        onComplete={() => {
          setCaptureObjective(null);
          fetchCards(); // Refresh to reflect saved data
        }}
      />

      <QuestMemoryModal
        quest={memoryCard}
        visible={!!memoryCard}
        onDismiss={() => setMemoryCard(null)}
      />

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
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  headerLabel: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  headerHint: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
  },
  deckArea: {
    flex: 1,
    justifyContent: "center",
  },
  promoteBar: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  promoteButton: {
    alignItems: "center",
    paddingVertical: 2,
  },
  promoteText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(168, 85, 247, 0.95)",
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  emptyText: {
    textAlign: "center",
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
});

export default DeckScreen;
