import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";
import type { ThirdSpaceScoreResponse } from "@/services/api/modules/leaderboard";
import InfoModal from "@/components/InfoModal";

interface ThirdSpaceScoreHeroProps {
  score: ThirdSpaceScoreResponse;
}

const SUB_SCORES = [
  { label: "Vitality", field: "vitalityScore" as const, color: "#93c5fd", info: "How many events are happening nearby, weighted by recency. More recent events count more." },
  { label: "Discovery", field: "discoveryScore" as const, color: "#86efac", info: "How many events have been scanned and discovered by users in your city this week." },
  { label: "Diversity", field: "diversityScore" as const, color: "#fcd34d", info: "How varied the event categories are. A healthy mix of arts, sports, food, etc. scores higher." },
  { label: "Engagement", field: "engagementScore" as const, color: "#c4b5fd", info: "Community interaction with events — saves and views over the last 30 days." },
  { label: "Rootedness", field: "rootednessScore" as const, color: "#f9a8d4", info: "Recurring events and dedicated high-tier community members who keep the scene alive." },
];

const MOMENTUM_CONFIG = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#f87171" },
};

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Returns a green hue that darkens as the score increases.
 * 0 → light mint, 100 → rich forest green.
 */
function getScoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

const ThirdSpaceScoreHero: React.FC<ThirdSpaceScoreHeroProps> = ({ score }) => {
  const targetScore = score.current.score;

  const animatedScore = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    animatedScore.value = 0;
    animatedScore.value = withDelay(
      300,
      withTiming(targetScore, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [targetScore, animatedScore]);

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

  const cityLabel = score.current.city
    ? score.current.city.split(",")[0].trim()
    : "Your City";

  const momentumConfig = MOMENTUM_CONFIG[score.momentum];
  const deltaText =
    score.delta24h > 0
      ? `+${score.delta24h}`
      : score.delta24h < 0
        ? `${score.delta24h}`
        : "";

  const momentumProgress = useSharedValue(0);

  useEffect(() => {
    momentumProgress.value = 0;
    momentumProgress.value = withDelay(
      800,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [score.momentum, momentumProgress]);

  const momentumAnimStyle = useAnimatedStyle(() => ({
    opacity: momentumProgress.value,
    transform: [
      { translateY: (1 - momentumProgress.value) * -8 },
    ],
  }));

  const [activeInfo, setActiveInfo] = useState<{
    label: string;
    info: string;
    color: string;
  } | null>(null);

  const closeInfo = useCallback(() => setActiveInfo(null), []);

  const scoreColor = getScoreColor(targetScore);
  const sparklinePoints = buildSparkline(score.history);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cityText}>{cityLabel}</Text>
          <Text style={styles.label}>THIRD SPACE SCORE</Text>
        </View>
        <Animated.Text
          style={[
            styles.momentumBadge,
            { color: momentumConfig.color },
            momentumAnimStyle,
          ]}
        >
          {momentumConfig.arrow}{" "}
          {score.momentum.charAt(0).toUpperCase() + score.momentum.slice(1)}
          {deltaText ? ` ${deltaText}` : ""}
        </Animated.Text>
      </View>

      <View style={styles.topRow}>
        <View style={styles.circleWrapper}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={colors.border.default}
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
          {SUB_SCORES.map((sub) => {
            const value = score.current[sub.field];
            return (
              <View key={sub.field} style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <View
                    style={[styles.statDot, { backgroundColor: sub.color }]}
                  />
                  <Text style={styles.statLabel}>{sub.label}</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: sub.color }]}>
                    {value}
                  </Text>
                  <Pressable
                    onPress={() => setActiveInfo(sub)}
                    hitSlop={8}
                  >
                    <View
                      style={[
                        styles.infoButton,
                        { borderColor: sub.color },
                      ]}
                    >
                      <Text
                        style={[styles.infoButtonText, { color: sub.color }]}
                      >
                        i
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </View>

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

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
    marginTop: 2,
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
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoButton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.6,
  },
  infoButtonText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    lineHeight: 12,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  cityText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
  sparklineContainer: {
    height: 28,
  },
});

export default ThirdSpaceScoreHero;
