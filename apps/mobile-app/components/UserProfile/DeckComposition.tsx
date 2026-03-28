import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
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

const TIER_COLORS: Record<string, string> = {
  QUICK: "rgba(134, 239, 172, 0.9)",
  SWEET_SPOT: "rgba(251, 191, 36, 0.9)",
  BEST: "rgba(168, 85, 247, 0.9)",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#4ade80",
  active: "#60a5fa",
  unplayed: "#a3a3a3",
};

/* ─── Animated bar ─── */

const AnimatedBar: React.FC<{
  pct: number;
  color: string;
  delay: number;
}> = ({ pct, color, delay }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [pct, delay, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    backgroundColor: color,
  }));

  return <Animated.View style={[{ height: 6, borderRadius: 3 }, barStyle]} />;
};

/* ─── Component ─── */

interface DeckCompositionProps {
  data: DeckStatsResponse | null;
}

const DeckComposition: React.FC<DeckCompositionProps> = ({ data }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!data) return null;

  const totalByTier = data.byTier.reduce((s, t) => s + t.count, 0);
  const totalByStatus = data.byStatus.reduce((s, t) => s + t.count, 0);

  return (
    <View style={styles.container}>
      {/* Tier breakdown */}
      <Text style={styles.sectionLabel}>DECK BY RARITY</Text>
      <View style={styles.card}>
        {/* Stacked bar */}
        {totalByTier > 0 && (
          <View style={styles.stackedBar}>
            {data.byTier.map((tier, i) => (
              <AnimatedBar
                key={tier.tier}
                pct={totalByTier > 0 ? (tier.count / totalByTier) * 100 : 0}
                color={TIER_COLORS[tier.tier] || "#a3a3a3"}
                delay={200 + i * 100}
              />
            ))}
          </View>
        )}

        {/* Legend rows */}
        {data.byTier.map((tier) => (
          <View key={tier.tier} style={styles.legendRow}>
            <View style={styles.legendLabelRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: TIER_COLORS[tier.tier] || "#a3a3a3" },
                ]}
              />
              <Text style={styles.legendLabel}>{tier.label}</Text>
            </View>
            <Text
              style={[
                styles.legendValue,
                { color: TIER_COLORS[tier.tier] || "#a3a3a3" },
              ]}
            >
              {tier.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Status breakdown */}
      <Text style={styles.sectionLabel}>DECK BY STATUS</Text>
      <View style={styles.card}>
        {totalByStatus > 0 && (
          <View style={styles.stackedBar}>
            {data.byStatus.map((s, i) => (
              <AnimatedBar
                key={s.status}
                pct={totalByStatus > 0 ? (s.count / totalByStatus) * 100 : 0}
                color={STATUS_COLORS[s.status] || "#a3a3a3"}
                delay={500 + i * 100}
              />
            ))}
          </View>
        )}

        {data.byStatus.map((s) => (
          <View key={s.status} style={styles.legendRow}>
            <View style={styles.legendLabelRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: STATUS_COLORS[s.status] || "#a3a3a3" },
                ]}
              />
              <Text style={styles.legendLabel}>{s.label}</Text>
            </View>
            <Text
              style={[
                styles.legendValue,
                { color: STATUS_COLORS[s.status] || "#a3a3a3" },
              ]}
            >
              {s.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Recently added cards */}
      {data.recentCards.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>RECENTLY ADDED</Text>
          <View style={styles.card}>
            {data.recentCards.map((card, i) => (
              <View
                key={i}
                style={[
                  styles.recentRow,
                  i < data.recentCards.length - 1 && styles.recentRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.recentTierPip,
                    { backgroundColor: TIER_COLORS[card.tier] || "#a3a3a3" },
                  ]}
                />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {card.daysAgo === 0
                      ? "Today"
                      : card.daysAgo === 1
                        ? "Yesterday"
                        : `${card.daysAgo}d ago`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    card: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: spacing.sm,
    },
    // Stacked bar
    stackedBar: {
      flexDirection: "row",
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bg.cardAlt,
      overflow: "hidden",
      gap: 2,
    },
    // Legend
    legendRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    legendLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    legendLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    legendValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    // Recent cards
    recentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    recentRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    recentTierPip: {
      width: 4,
      height: 28,
      borderRadius: 2,
    },
    recentInfo: {
      flex: 1,
      gap: 1,
    },
    recentName: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    recentMeta: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });

export default DeckComposition;
