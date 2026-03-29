import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
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
  duration,
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

/* ─── Stat pill (inline label + value) ─── */

const StatPill: React.FC<{
  label: string;
  value: number;
  color: string;
  delay: number;
  colors: Colors;
}> = ({ label, value, color, delay, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      entering={FadeIn.duration(duration.normal).delay(delay)}
      style={styles.statPill}
    >
      <View style={[styles.statPillDot, { backgroundColor: color }]} />
      <AnimatedCounter
        value={value}
        delay={delay}
        style={[styles.statPillValue, { color }]}
      />
      <Text style={styles.statPillLabel}>{label}</Text>
    </Animated.View>
  );
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

  useEffect(() => {
    if (!data) return;
    heroOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [data, heroOpacity]);

  const heroAnimStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));

  if (!data) return null;

  const hasBreakdown =
    data.cardsPlayed > 0 || data.cardsActive > 0 || data.cardsInDeck > 0;
  const hasXp = totalXp > 0;
  const hasStreak = currentStreak > 0 || longestStreak > 0;
  const hasAnyStats = hasBreakdown || hasXp || hasStreak;
  const isNewUser = data.totalCards === 0 && !hasAnyStats;

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
            <Text style={styles.bigNumberUnit}>
              {data.totalCards === 1 ? "card" : "cards"}
            </Text>
          </View>
          {data.newThisWeek > 0 && (
            <Text style={styles.newBadge}>+{data.newThisWeek} this week</Text>
          )}
          {isNewUser && (
            <Text style={styles.emptyHint}>Draw your first sidequest below</Text>
          )}
        </View>
      </Animated.View>

      {/* Inline stat pills — only rendered when non-zero */}
      {hasAnyStats && (
        <View style={styles.pillsRow}>
          {data.cardsPlayed > 0 && (
            <StatPill
              label="played"
              value={data.cardsPlayed}
              color={TIER_COLORS.QUICK}
              delay={400}
              colors={colors}
            />
          )}
          {data.cardsActive > 0 && (
            <StatPill
              label="active"
              value={data.cardsActive}
              color={TIER_COLORS.SWEET_SPOT}
              delay={500}
              colors={colors}
            />
          )}
          {data.cardsInDeck > 0 && (
            <StatPill
              label="in deck"
              value={data.cardsInDeck}
              color={TIER_COLORS.BEST}
              delay={600}
              colors={colors}
            />
          )}
          {hasXp && (
            <StatPill
              label="xp"
              value={totalXp}
              color="#93c5fd"
              delay={700}
              colors={colors}
            />
          )}
          {currentStreak > 0 && (
            <StatPill
              label={currentStreak === 1 ? "week streak" : "week streak"}
              value={currentStreak}
              color="#fbbf24"
              delay={800}
              colors={colors}
            />
          )}
          {longestStreak > 0 && longestStreak !== currentStreak && (
            <StatPill
              label="best"
              value={longestStreak}
              color="#fbbf24"
              delay={900}
              colors={colors}
            />
          )}
        </View>
      )}
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
    emptyHint: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: 4,
    },
    // Stat pills
    pillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    statPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    statPillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statPillValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    statPillLabel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });

export default DeckHero;
