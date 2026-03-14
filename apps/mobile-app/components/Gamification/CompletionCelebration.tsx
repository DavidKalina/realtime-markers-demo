import React, { useEffect, useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useXPStore, type PendingBadge } from "@/stores/useXPStore";
import { useColors, fontFamily } from "@/theme";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CONFETTI_COUNT = 50;
const CONFETTI_COLORS = [
  "#34d399", // emerald
  "#60a5fa", // blue
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb923c", // orange
  "#4ade80", // green
  "#f87171", // red
];

interface ConfettiPiece {
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
  duration: number;
}

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    delay: Math.random() * 800,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
    duration: 2000 + Math.random() * 1500,
  }));
}

function ConfettiParticle({ piece }: { piece: ConfettiPiece }) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: piece.duration,
        easing: Easing.in(Easing.quad),
      }),
    );
    rotate.value = withDelay(
      piece.delay,
      withTiming(piece.rotation + 720, {
        duration: piece.duration,
        easing: Easing.linear,
      }),
    );
    opacity.value = withDelay(
      piece.delay + piece.duration * 0.7,
      withTiming(0, { duration: piece.duration * 0.3 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        {
          position: "absolute",
          left: piece.x,
          top: -20,
          width: piece.size,
          height: piece.size * 0.6,
          backgroundColor: piece.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

export default function CompletionCelebration() {
  const completionData = useActiveItineraryStore((s) => s.completionData);
  const dismissCompletion = useActiveItineraryStore((s) => s.dismissCompletion);
  const consume = useXPStore((s) => s.consume);
  const colors = useColors();
  const router = useRouter();

  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.8);

  const confetti = useMemo(() => generateConfetti(), [completionData]);

  const [xpData, setXpData] = React.useState<{
    totalXP: number;
    badges: PendingBadge[];
  } | null>(null);

  useEffect(() => {
    if (!completionData) {
      setXpData(null);
      return;
    }

    // Wait a moment for XP/badge events to arrive via WebSocket
    const timer = setTimeout(() => {
      const result = consume();
      setXpData({ totalXP: result.totalXP, badges: result.badges });
    }, 1500);

    return () => clearTimeout(timer);
  }, [completionData]);

  useEffect(() => {
    if (!completionData) return;

    // Haptic burst
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 200);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 400);

    // Animate content in
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    contentScale.value = withDelay(
      300,
      withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.back(1.2)),
      }),
    );
  }, [completionData]);

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  if (!completionData) return null;

  const { itinerary } = completionData;
  const stopCount = itinerary.items.length;

  const handleDismiss = () => {
    dismissCompletion();
  };

  const handleShare = () => {
    router.push(`/itineraries/${itinerary.id}` as const);
    dismissCompletion();
  };

  return (
    <View style={styles.overlay}>
      {/* Confetti layer */}
      {confetti.map((piece, i) => (
        <ConfettiParticle key={i} piece={piece} />
      ))}

      {/* Content */}
      <Reanimated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg.elevated,
            borderWidth: 1,
            borderColor: colors.border.medium,
          },
          contentAnimStyle,
        ]}
      >
        <Text style={[styles.emoji]}>{"\u{1F389}"}</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Adventure Complete!
        </Text>
        <Text style={[styles.itineraryTitle, { color: colors.text.secondary }]}>
          {itinerary.title ?? "Your itinerary"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.primary }]}>
          {stopCount} stop{stopCount !== 1 ? "s" : ""} visited in{" "}
          {itinerary.city}
        </Text>

        {/* XP Summary */}
        {xpData && xpData.totalXP > 0 && (
          <View style={[styles.xpRow, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.xpLabel, { color: colors.text.secondary }]}>
              XP Earned
            </Text>
            <Text style={[styles.xpValue, { color: colors.accent.primary }]}>
              +{xpData.totalXP}
            </Text>
          </View>
        )}

        {/* Badges */}
        {xpData && xpData.badges.length > 0 && (
          <View style={styles.badgeSection}>
            <Text
              style={[
                styles.badgeSectionTitle,
                { color: colors.text.secondary },
              ]}
            >
              Badges Unlocked
            </Text>
            {xpData.badges.map((badge) => (
              <View
                key={badge.badgeId}
                style={[
                  styles.badgeRow,
                  { backgroundColor: colors.bg.elevated },
                ]}
              >
                <Text style={styles.badgeEmoji}>{badge.badgeEmoji}</Text>
                <Text
                  style={[styles.badgeName, { color: colors.text.primary }]}
                >
                  {badge.badgeName}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.shareButton,
              { backgroundColor: colors.accent.primary },
            ]}
            onPress={handleShare}
          >
            <Text style={styles.shareButtonText}>View & Share</Text>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={handleDismiss}>
            <Text
              style={[
                styles.dismissButtonText,
                { color: colors.text.tertiary },
              ]}
            >
              Close
            </Text>
          </Pressable>
        </View>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  card: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  itineraryTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    marginBottom: 20,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  xpLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  xpValue: {
    fontFamily: fontFamily.mono,
    fontSize: 20,
    fontWeight: "800",
  },
  badgeSection: {
    width: "100%",
    marginBottom: 12,
  },
  badgeSectionTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeName: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: "700",
  },
  actions: {
    width: "100%",
    marginTop: 8,
    gap: 8,
  },
  shareButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  shareButtonText: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  dismissButton: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
  },
  dismissButtonText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: "600",
  },
});
