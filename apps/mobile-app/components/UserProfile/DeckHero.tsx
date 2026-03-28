import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import type { DeckStatsResponse } from "@/services/api/modules/deckStats";

/* ─── Tier colors (matches QuestCardDeck) ─── */

const TIER_COLORS = {
  QUICK: "rgba(134, 239, 172, 0.9)",
  SWEET_SPOT: "rgba(251, 191, 36, 0.9)",
  BEST: "rgba(168, 85, 247, 0.9)",
};

/* ─── Mini card fan (decorative) ─── */

const MINI_CARD_WIDTH = 36;
const MINI_CARD_HEIGHT = MINI_CARD_WIDTH * 1.4;
const FAN_CARDS = [
  { rotate: "-12deg", translateX: -8, color: TIER_COLORS.QUICK, emoji: "⚡" },
  { rotate: "0deg", translateX: 0, color: TIER_COLORS.SWEET_SPOT, emoji: "🎯" },
  { rotate: "12deg", translateX: 8, color: TIER_COLORS.BEST, emoji: "👑" },
];

const MiniCardFan: React.FC<{ colors: Colors }> = ({ colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.fanContainer}>
      {FAN_CARDS.map((card, i) => (
        <View
          key={i}
          style={[
            styles.miniCard,
            {
              borderColor: card.color,
              transform: [
                { translateX: card.translateX },
                { rotate: card.rotate },
              ],
              zIndex: i === 1 ? 3 : i === 2 ? 2 : 1,
            },
          ]}
        >
          <Text style={styles.miniCardEmoji}>{card.emoji}</Text>
          <View
            style={[styles.miniCardInner, { backgroundColor: card.color }]}
          />
        </View>
      ))}
    </View>
  );
};

/* ─── Animated counter ─── */

const AnimatedCounter: React.FC<{
  value: number;
  delay: number;
  style: object;
}> = ({ value, delay, style }) => {
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      delay,
      withTiming(value, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [value, delay, animated]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return <Text style={style}>{displayed.toLocaleString()}</Text>;
};

/* ─── Component ─── */

interface DeckHeroProps {
  data: DeckStatsResponse | null;
  totalXp?: number;
  currentStreak?: number;
  longestStreak?: number;
}

const DeckHero: React.FC<DeckHeroProps> = ({
  data,
  totalXp = 0,
  currentStreak = 0,
  longestStreak = 0,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Fade-in stagger
  const heroOpacity = useSharedValue(0);
  const statsOpacity = useSharedValue(0);

  useEffect(() => {
    if (!data) return;
    heroOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    statsOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [data, heroOpacity, statsOpacity]);

  const heroAnimStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));

  const statsAnimStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  if (!data) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>YOUR DECK</Text>

      {/* Top row: card fan + big number */}
      <Animated.View style={[styles.topRow, heroAnimStyle]}>
        <MiniCardFan colors={colors} />

        <View style={styles.bigNumberCol}>
          <View style={styles.bigNumberRow}>
            <AnimatedCounter
              value={data.totalCards}
              delay={300}
              style={styles.bigNumber}
            />
            <Text style={styles.bigNumberUnit}>cards</Text>
          </View>
          {data.newThisWeek > 0 && (
            <Text style={styles.newBadge}>+{data.newThisWeek} this week</Text>
          )}
        </View>
      </Animated.View>

      {/* Stats row */}
      <Animated.View style={[styles.statsRow, statsAnimStyle]}>
        <View style={styles.stat}>
          <AnimatedCounter
            value={data.cardsPlayed}
            delay={500}
            style={[styles.statValue, { color: TIER_COLORS.QUICK }]}
          />
          <Text style={styles.statLabel}>PLAYED</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AnimatedCounter
            value={data.cardsActive}
            delay={600}
            style={[styles.statValue, { color: TIER_COLORS.SWEET_SPOT }]}
          />
          <Text style={styles.statLabel}>ACTIVE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AnimatedCounter
            value={data.cardsInDeck}
            delay={700}
            style={[styles.statValue, { color: TIER_COLORS.BEST }]}
          />
          <Text style={styles.statLabel}>IN DECK</Text>
        </View>
      </Animated.View>

      {/* Bottom row: XP + streak */}
      <Animated.View style={[styles.bottomRow, statsAnimStyle]}>
        <View style={styles.bottomStat}>
          <AnimatedCounter
            value={totalXp}
            delay={800}
            style={styles.bottomStatValue}
          />
          <Text style={styles.bottomStatLabel}>XP</Text>
        </View>
        <View style={styles.bottomStat}>
          <AnimatedCounter
            value={currentStreak}
            delay={900}
            style={styles.bottomStatValue}
          />
          <Text style={styles.bottomStatLabel}>STREAK</Text>
        </View>
        <View style={styles.bottomStat}>
          <AnimatedCounter
            value={longestStreak}
            delay={1000}
            style={styles.bottomStatValue}
          />
          <Text style={styles.bottomStatLabel}>BEST</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    // Top row
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    fanContainer: {
      width: 80,
      height: MINI_CARD_HEIGHT + 16,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
    },
    miniCard: {
      width: MINI_CARD_WIDTH,
      height: MINI_CARD_HEIGHT,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      backgroundColor: colors.bg.elevated,
      position: "absolute",
      justifyContent: "flex-end",
      padding: 3,
      overflow: "hidden",
    },
    miniCardEmoji: {
      fontSize: 14,
      textAlign: "center",
      marginTop: 2,
    },
    miniCardInner: {
      height: "30%",
      borderRadius: 2,
      opacity: 0.3,
    },
    bigNumberCol: {
      flex: 1,
    },
    bigNumberRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    bigNumber: {
      fontSize: 40,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    bigNumberUnit: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    newBadge: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: TIER_COLORS.QUICK,
      marginTop: 2,
    },
    // Stats row
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    stat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border.default,
    },
    statValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    statLabel: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
    // Bottom row
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    bottomStat: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    bottomStatValue: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    bottomStatLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
  });

export default DeckHero;
