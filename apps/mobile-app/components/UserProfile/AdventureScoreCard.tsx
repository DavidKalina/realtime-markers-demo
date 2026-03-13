import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiClient } from "@/services/ApiClient";
import type { AdventureScoreResponse } from "@/services/api/modules/adventureScore";

interface AdventureScoreCardProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const CIRCLE_SIZE = 90;
const STROKE_WIDTH = 6;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FACTOR_META = [
  { key: "activityScore" as const, label: "Activity", color: "#4ade80" },
  { key: "consistencyScore" as const, label: "Consistency", color: "#60a5fa" },
  { key: "diversityScore" as const, label: "Diversity", color: "#fbbf24" },
  { key: "completionScore" as const, label: "Completion", color: "#a78bfa" },
  { key: "discoveryScore" as const, label: "Discovery", color: "#f97316" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#60a5fa";
}

const AdventureScoreCard: React.FC<AdventureScoreCardProps> = ({
  onRefetchRef,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<AdventureScoreResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchScore = useCallback(async () => {
    try {
      const result = await apiClient.adventureScore.getMyScore();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch adventure score:", err);
    } finally {
      setLoaded(true);
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

  // Animation
  const animatedProgress = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    if (!data) return;
    animatedProgress.value = 0;
    animatedProgress.value = withDelay(
      200,
      withTiming(data.score / 100, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [data, animatedProgress]);

  const animatedScore = useSharedValue(0);

  useEffect(() => {
    if (!data) return;
    animatedScore.value = 0;
    animatedScore.value = withDelay(
      200,
      withTiming(data.score, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [data, animatedScore]);

  useAnimatedReaction(
    () => Math.round(animatedScore.value),
    (current) => {
      scheduleOnRN(setDisplayedScore, current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  if (!loaded || !data) return null;

  // Don't show if score is 0 and user has no activity
  if (data.score === 0 && data.activityScore === 0) return null;

  const color = scoreColor(data.score);

  return (
    <View>
      <Text style={styles.sectionLabel}>ADVENTURE SCORE</Text>
      <View style={styles.container}>
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
                stroke={color}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={animatedProps}
                transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.circleLabel}>
              <Text style={[styles.circleScore, { color }]}>
                {displayedScore}
              </Text>
            </View>
          </View>

          <View style={styles.factorsColumn}>
            {FACTOR_META.map((factor) => (
              <View key={factor.key} style={styles.factorRow}>
                <View style={styles.factorLabelRow}>
                  <View
                    style={[
                      styles.factorDot,
                      { backgroundColor: factor.color },
                    ]}
                  />
                  <Text style={styles.factorLabel}>{factor.label}</Text>
                </View>
                <Text style={[styles.factorValue, { color: factor.color }]}>
                  {data[factor.key]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    container: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
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
      fontSize: 24,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    factorsColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    factorRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    factorLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    factorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    factorLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    factorValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
  });

export default AdventureScoreCard;
