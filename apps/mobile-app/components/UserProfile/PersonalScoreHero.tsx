import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
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
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { AdventureScoreResponse } from "@/services/api/modules/adventureScore";
import InfoModal from "@/components/InfoModal";

const SUB_SCORES = [
  {
    label: "Activity",
    field: "activityScore" as const,
    color: "#4ade80",
    info: "How frequently you go on adventures, weighted by recency.",
  },
  {
    label: "Consistency",
    field: "consistencyScore" as const,
    color: "#60a5fa",
    info: "Maintaining a regular adventure streak over time.",
  },
  {
    label: "Diversity",
    field: "diversityScore" as const,
    color: "#fbbf24",
    info: "Variety of adventure intentions, categories, and venues.",
  },
  {
    label: "Completion",
    field: "completionScore" as const,
    color: "#a78bfa",
    info: "How often you finish what you plan — stops visited, itineraries completed.",
  },
  {
    label: "Discovery",
    field: "discoveryScore" as const,
    color: "#f97316",
    info: "How many unique venues and new places you explore.",
  },
];

const MOMENTUM_CONFIG = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#7dd3fc" },
};

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getScoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildSparkline(
  history: { score: number; computedAt: string }[],
): string | null {
  if (history.length < 2) return null;

  const width = 200;
  const height = 40;
  const padding = 4;
  const scores = history.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  return history
    .map((h, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((h.score - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

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

interface PersonalScoreHeroProps {
  totalXp?: number;
  currentStreak?: number;
  longestStreak?: number;
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const PersonalScoreHero: React.FC<PersonalScoreHeroProps> = ({
  totalXp,
  currentStreak,
  longestStreak,
  onRefetchRef,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<AdventureScoreResponse | null>(null);

  const fetchScore = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await apiClient.adventureScore.getMyScore();
      // Backwards-compat: if backend returns old flat shape, wrap it
      if (raw && !raw.current && typeof raw.score === "number") {
        setData({
          current: raw,
          previous: null,
          history: [],
          delta24h: 0,
          momentum: "steady",
        });
      } else {
        setData(raw);
      }
    } catch (err) {
      console.error("Failed to fetch adventure score:", err);
    }
  }, []);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchScore;
    }
  }, [onRefetchRef, fetchScore]);

  const targetScore = data?.current.score ?? 0;
  const isEmpty = data !== null && targetScore === 0;
  const scoreColor = getScoreColor(targetScore);

  const animatedScore = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    if (!data) return;
    animatedScore.value = 0;
    animatedScore.value = withDelay(
      300,
      withTiming(targetScore, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [targetScore, data, animatedScore]);

  useAnimatedReaction(
    () => Math.round(animatedScore.value),
    (current) => {
      scheduleOnRN(setDisplayedScore, current);
    },
  );

  const animatedProps = useAnimatedProps(() => {
    const progress = animatedScore.value / 100;
    return {
      strokeDashoffset: CIRCUMFERENCE * (1 - progress),
    };
  });

  // Momentum badge animation
  const momentumProgress = useSharedValue(0);

  useEffect(() => {
    if (!data) return;
    momentumProgress.value = 0;
    momentumProgress.value = withDelay(
      800,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [data?.momentum, momentumProgress, data]);

  const momentumAnimStyle = useAnimatedStyle(() => ({
    opacity: momentumProgress.value,
    transform: [{ translateY: (1 - momentumProgress.value) * -8 }],
  }));

  const [activeInfo, setActiveInfo] = useState<{
    label: string;
    info: string;
    color: string;
  } | null>(null);

  const closeInfo = useCallback(() => setActiveInfo(null), []);

  const momentumConfig = data
    ? MOMENTUM_CONFIG[data.momentum]
    : MOMENTUM_CONFIG.steady;
  const deltaText = data
    ? data.delta24h > 0
      ? `+${data.delta24h}`
      : data.delta24h < 0
        ? `${data.delta24h}`
        : ""
    : "";
  const sparklinePoints = data ? buildSparkline(data.history) : null;

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>ADVENTURE SCORE</Text>
        <View style={styles.emptyState}>
          <View style={styles.emptyCircleWrapper}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={CIRCLE_RADIUS}
                stroke={colors.border.accent}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray="6 4"
              />
            </Svg>
            <View style={styles.circleLabel}>
              <Text style={styles.emptyCircleIcon}>?</Text>
            </View>
          </View>
          <View style={styles.emptyTextColumn}>
            <Text style={styles.emptyTitle}>Your score awaits</Text>
            <Text style={styles.emptyBody}>
              Complete your first itinerary to unlock your Adventure Score
              — five dimensions of how you explore the world.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>ADVENTURE SCORE</Text>
        {data && (
          <Animated.Text
            style={[
              styles.momentumBadge,
              { color: momentumConfig.color },
              momentumAnimStyle,
            ]}
          >
            {momentumConfig.arrow}{" "}
            {data.momentum.charAt(0).toUpperCase() + data.momentum.slice(1)}
            {deltaText ? ` ${deltaText}` : ""}
          </Animated.Text>
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
              stroke={scoreColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.circleLabel}>
            <Text style={[styles.circleScore, { color: scoreColor }]}>
              {displayedScore}
            </Text>
          </View>
        </View>

        <View style={styles.statsColumn}>
          {SUB_SCORES.map((sub, index) => {
            const value = data?.current[sub.field] ?? 0;
            return (
              <Pressable
                key={sub.field}
                style={styles.statRow}
                onPress={() => setActiveInfo(sub)}
              >
                <View style={styles.statLabelRow}>
                  <View
                    style={[styles.statDot, { backgroundColor: sub.color }]}
                  />
                  <Text style={styles.statLabel}>{sub.label}</Text>
                </View>
                <AnimatedSubScore
                  value={value}
                  color={sub.color}
                  delay={400 + index * 150}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sparkline */}
      {sparklinePoints && (
        <View style={styles.sparklineContainer}>
          <Svg width="100%" height={28} viewBox="0 0 200 40">
            <Polyline
              points={sparklinePoints}
              fill="none"
              stroke={scoreColor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}

      {/* Bottom stats row */}
      <View style={styles.bottomRow}>
        <View style={styles.stat}>
          <Text style={[styles.bottomStatValue, { color: scoreColor }]}>
            {(totalXp ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.bottomStatLabel}>XP</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.bottomStatValue}>{currentStreak ?? 0}</Text>
          <Text style={styles.bottomStatLabel}>STREAK</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.bottomStatValue}>{longestStreak ?? 0}</Text>
          <Text style={styles.bottomStatLabel}>BEST</Text>
        </View>
      </View>

      <InfoModal
        visible={activeInfo !== null}
        title={activeInfo?.label ?? ""}
        body={activeInfo?.info ?? ""}
        accentColor={activeInfo?.color}
        onClose={closeInfo}
      />
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
      alignItems: "flex-start",
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    momentumBadge: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
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
    circleScore: {
      fontSize: 32,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
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
    emptyState: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    emptyCircleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
      opacity: 0.5,
    },
    emptyCircleIcon: {
      fontSize: 32,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    emptyTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    emptyBody: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    emptyTextColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    sparklineContainer: {
      height: 28,
    },
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    stat: {
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

export default PersonalScoreHero;
