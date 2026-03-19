import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  useColors,
  radius,
  spacing,
  fontSize,
  fontFamily,
  fontWeight,
  spring,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { AdventureScoreSnapshot } from "@/services/api/modules/adventureScore";
import DiscovererCardOverlay from "./DiscovererCardOverlay";

const CARD_HEIGHT = 230;

const CIRCLE_SIZE = 110;
const STROKE_WIDTH = 7;
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
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

interface DiscovererCardProps {
  userId?: string;
  firstName?: string;
  lastName?: string;
  currentTier?: string;
  totalXp?: number;
  currentStreak?: number;
  longestStreak?: number;
  memberSince?: string;
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const AnimatedSubScore: React.FC<{
  value: number;
  color: string;
  delay: number;
}> = ({ value, color, delay }) => {
  const colors = useColors();
  const styles = useMemo(() => createCardStyles(colors), [colors]);
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

  return <Text style={[styles.factorValue, { color }]}>{displayed}</Text>;
};

const DiscovererCard: React.FC<DiscovererCardProps> = ({
  firstName,
  lastName,
  currentTier,
  totalXp,
  currentStreak,
  longestStreak,
  memberSince,
  onRefetchRef,
}) => {
  const colors = useColors();
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const pressScale = useSharedValue(1);

  // Adventure score data
  const [scoreData, setScoreData] = useState<AdventureScoreSnapshot | null>(
    null,
  );

  const fetchScore = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await apiClient.adventureScore.getMyScore();
      // Backwards-compat: old backend returns flat shape without .current
      setScoreData(raw.current ?? raw);
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

  // Score ring animation
  const animatedProgress = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    if (!scoreData) return;
    animatedProgress.value = 0;
    animatedProgress.value = withDelay(
      300,
      withTiming(scoreData.score / 100, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [scoreData, animatedProgress]);

  const animatedScore = useSharedValue(0);

  useEffect(() => {
    if (!scoreData) return;
    animatedScore.value = 0;
    animatedScore.value = withDelay(
      300,
      withTiming(scoreData.score, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [scoreData, animatedScore]);

  useAnimatedReaction(
    () => Math.round(animatedScore.value),
    (current) => {
      scheduleOnRN(setDisplayedScore, current);
    },
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.97, spring.press);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, spring.bouncy);
  }, [pressScale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOverlayVisible(true);
  }, []);

  const color = scoreData ? scoreColor(scoreData.score) : "#4ade80";

  return (
    <>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View style={[cardStyles.card, pressStyle]}>
          {/* Header */}
          <Text style={cardStyles.sectionLabel}>ADVENTURE SCORE</Text>

          {/* Score ring + sub-scores */}
          <View style={cardStyles.topRow}>
            <View style={cardStyles.circleWrapper}>
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
              <View style={cardStyles.circleLabel}>
                <Text style={[cardStyles.circleScore, { color }]}>
                  {displayedScore}
                </Text>
              </View>
            </View>

            <View style={cardStyles.factorsColumn}>
              {FACTOR_META.map((factor, index) => (
                <View key={factor.key} style={cardStyles.factorRow}>
                  <View style={cardStyles.factorLabelRow}>
                    <View
                      style={[
                        cardStyles.factorDot,
                        { backgroundColor: factor.color },
                      ]}
                    />
                    <Text style={cardStyles.factorLabel}>{factor.label}</Text>
                  </View>
                  <AnimatedSubScore
                    value={scoreData?.[factor.key] ?? 0}
                    color={factor.color}
                    delay={400 + index * 150}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Bottom stats row */}
          <View style={cardStyles.bottomRow}>
            <View style={cardStyles.stat}>
              <Text style={[cardStyles.statValue, { color }]}>
                {(totalXp ?? 0).toLocaleString()}
              </Text>
              <Text style={cardStyles.statLabel}>XP</Text>
            </View>
            <View style={cardStyles.stat}>
              <Text style={cardStyles.statValue}>{currentStreak ?? 0}</Text>
              <Text style={cardStyles.statLabel}>STREAK</Text>
            </View>
            <View style={cardStyles.stat}>
              <Text style={cardStyles.statValue}>{longestStreak ?? 0}</Text>
              <Text style={cardStyles.statLabel}>BEST</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>

      <DiscovererCardOverlay
        visible={overlayVisible}
        onDismiss={() => setOverlayVisible(false)}
        firstName={firstName}
        lastName={lastName}
        currentTier={currentTier}
        totalXp={totalXp}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        memberSince={memberSince}
        scoreData={scoreData}
      />
    </>
  );
};

const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      height: CARD_HEIGHT,
      width: "100%",
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.md,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
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
      fontSize: 28,
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
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    stat: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    statValue: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
  });

export default DiscovererCard;
