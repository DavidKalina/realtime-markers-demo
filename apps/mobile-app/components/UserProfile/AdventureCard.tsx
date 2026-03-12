import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
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
import {
  getTierForXP,
  getXPProgressPercent,
  getNextTierThreshold,
} from "@/utils/gamification";

interface AdventureCardProps {
  totalXp: number;
  scanCount: number;
  discoveryCount: number;
  saveCount: number;
  viewCount: number;
  weeklyScanCount?: number;
}

const TIER_COLORS: Record<string, string> = {
  Explorer: "#4ade80",
  Scout: "#60a5fa",
  Curator: "#fbbf24",
  Ambassador: "#a78bfa",
};

const SUB_STATS = [
  { label: "Scans", field: "scanCount" as const, color: "#86efac" },
  { label: "Discoveries", field: "discoveryCount" as const, color: "#93c5fd" },
  { label: "Saves", field: "saveCount" as const, color: "#fcd34d" },
  { label: "Views", field: "viewCount" as const, color: "#c4b5fd" },
];

const CIRCLE_SIZE = 110;
const STROKE_WIDTH = 7;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const AnimatedSubScore: React.FC<{
  value: number;
  color: string;
  delay: number;
}> = ({ value, color, delay }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  return <Text style={[styles.statValue, { color }]}>{displayed}</Text>;
};

const AdventureCard: React.FC<AdventureCardProps> = ({
  totalXp,
  scanCount,
  discoveryCount,
  saveCount,
  viewCount,
  weeklyScanCount,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tier = getTierForXP(totalXp);
  const progressPercent = getXPProgressPercent(totalXp);
  const nextThreshold = getNextTierThreshold(totalXp);
  const tierColor = TIER_COLORS[tier.name] || "#4ade80";

  const animatedProgress = useSharedValue(0);
  const [displayedXP, setDisplayedXP] = useState(0);

  useEffect(() => {
    animatedProgress.value = 0;
    animatedProgress.value = withDelay(
      300,
      withTiming(progressPercent / 100, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [progressPercent, animatedProgress]);

  const animatedXP = useSharedValue(0);

  useEffect(() => {
    animatedXP.value = 0;
    animatedXP.value = withDelay(
      300,
      withTiming(totalXp, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [totalXp, animatedXP]);

  useAnimatedReaction(
    () => Math.round(animatedXP.value),
    (current) => {
      scheduleOnRN(setDisplayedXP, current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  const statValues = { scanCount, discoveryCount, saveCount, viewCount };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.tierRow}>
          <Text style={styles.tierEmoji}>{tier.emoji}</Text>
          <Text style={[styles.tierName, { color: tierColor }]}>
            {tier.name}
          </Text>
        </View>
        {weeklyScanCount != null && weeklyScanCount > 0 && (
          <View style={[styles.weeklyBadge, { borderColor: tierColor }]}>
            <Text style={[styles.weeklyText, { color: tierColor }]}>
              {weeklyScanCount} this week
            </Text>
          </View>
        )}
      </View>

      <View style={styles.topRow}>
        <View style={styles.circleWrapper}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={colors.border.accent}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={tierColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.circleLabel}>
            <Text style={[styles.circleXP, { color: tierColor }]}>
              {displayedXP}
            </Text>
            <Text style={styles.circleXPLabel}>XP</Text>
          </View>
        </View>

        <View style={styles.statsColumn}>
          {SUB_STATS.map((sub, index) => (
            <View key={sub.field} style={styles.statRow}>
              <View style={styles.statLabelRow}>
                <View
                  style={[styles.statDot, { backgroundColor: sub.color }]}
                />
                <Text style={styles.statLabel}>{sub.label}</Text>
              </View>
              <AnimatedSubScore
                value={statValues[sub.field]}
                color={sub.color}
                delay={400 + index * 150}
              />
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.nextTier}>
        {nextThreshold !== null
          ? `NEXT: ${nextThreshold - totalXp} XP`
          : "MAX TIER"}
      </Text>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    tierRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    tierEmoji: {
      fontSize: 20,
    },
    tierName: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    weeklyBadge: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    weeklyText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    circleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    circleLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    circleXP: {
      fontSize: 26,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    circleXPLabel: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      letterSpacing: 1,
      marginTop: -2,
    },
    statsColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    statValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    nextTier: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      letterSpacing: 1.5,
      textAlign: "center",
    },
  });

export default AdventureCard;
