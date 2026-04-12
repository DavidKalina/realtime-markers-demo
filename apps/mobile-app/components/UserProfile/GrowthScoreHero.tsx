/**
 * GrowthScoreHero — growth score with clean arc ring,
 * sparkline trend, and momentum indicator.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Text as SvgText,
  Polyline,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import InfoModal from "@/components/InfoModal";

// ── Constants ──────────────────────────────────────────────────

const RING_SIZE = 120;
const CENTER = RING_SIZE / 2;
const RING_RADIUS = 46;
const STROKE_WIDTH = 5;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Types ──────────────────────────────────────────────────────

export interface GrowthHistoryPoint {
  score: number;
  date: string;
}

export type Momentum = "rising" | "steady" | "cooling";

export interface GrowthScoreHeroProps {
  score: number;
  momentum: Momentum;
  delta7d: number;
  history: GrowthHistoryPoint[];
  subScores: {
    resonance: number;
    consistency: number;
    expansion: number;
    depth: number;
  };
  questCount: number;
  currentStreak: number;
  totalXp: number;
  calibrating?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

const MOMENTUM_CONFIG = {
  rising: { arrow: "\u2191", label: "Rising" },
  steady: { arrow: "\u2192", label: "Steady" },
  cooling: { arrow: "\u2193", label: "Cooling" },
};

const SUB_SCORES = [
  {
    key: "resonance" as const,
    label: "Resonance",
    info: "How well your outings match what actually energizes you. High resonance means we're finding the right places and activities for you.",
  },
  {
    key: "consistency" as const,
    label: "Consistency",
    info: "How regularly you're getting out. Consistency is how strangers become regulars become friends.",
  },
  {
    key: "expansion" as const,
    label: "Expansion",
    info: "How much you're stretching — new places, new types of activities, further from home. Expanding your world expands your options.",
  },
  {
    key: "depth" as const,
    label: "Depth",
    info: "How deeply you're engaging — returning to what resonates, increasing social challenge, and reflecting meaningfully.",
  },
];

const OVERALL_SCORE_INFO = {
  title: "Social Growth Score",
  body: "A composite of how consistently you're getting out, how well the outings match you, how much you're expanding your world, and how deeply you're engaging socially.",
};

function buildSparkline(history: GrowthHistoryPoint[]): string | null {
  if (history.length < 2) return null;
  const W = 200;
  const H = 28;
  const PAD = 4;
  const scores = history.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  return history
    .map((h, i) => {
      const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((h.score - min) / range) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

// ── Component ──────────────────────────────────────────────────

function GrowthScoreHero({
  score,
  momentum,
  delta7d,
  history,
  subScores,
  questCount,
  currentStreak,
  totalXp,
  calibrating = false,
}: GrowthScoreHeroProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const mc = MOMENTUM_CONFIG[momentum];
  const accentColor = colors.accent.primary;

  // ── Animated ring fill ───────────────────────────
  const ringProgress = useSharedValue(0);

  useEffect(() => {
    ringProgress.value = 0;
    ringProgress.value = withDelay(
      300,
      withTiming(calibrating ? 0 : score / 100, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [score, calibrating]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  // ── Momentum badge fade ──────────────────────────
  const mProg = useSharedValue(0);
  useEffect(() => {
    mProg.value = 0;
    mProg.value = withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [momentum, mProg]);
  const mStyle = useAnimatedStyle(() => ({
    opacity: mProg.value,
    transform: [{ translateY: (1 - mProg.value) * -6 }],
  }));

  // ── Sub-score bars appear after ring ─────────────
  const [showSubs, setShowSubs] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowSubs(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // ── Stats row appears last ───────────────────────
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 1600);
    return () => clearTimeout(timer);
  }, []);

  // ── Info modal state ──────────────────────────────
  const [activeInfo, setActiveInfo] = useState<{
    title: string;
    body: string;
    color?: string;
  } | null>(null);
  const closeInfo = useCallback(() => setActiveInfo(null), []);

  const handleRingPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveInfo({
      title: OVERALL_SCORE_INFO.title,
      body: OVERALL_SCORE_INFO.body,
      color: accentColor,
    });
  }, [accentColor]);

  const handleSubPress = useCallback(
    (sub: (typeof SUB_SCORES)[number]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveInfo({
        title: sub.label,
        body: sub.info,
        color: accentColor,
      });
    },
    [accentColor],
  );

  const deltaText =
    delta7d > 0 ? `+${delta7d}` : delta7d < 0 ? `${delta7d}` : "";
  const sparkline = buildSparkline(history);

  return (
    <View style={s.container}>
      {/* Momentum badge */}
      {!calibrating && (
        <Animated.Text style={[s.momentumBadge, { color: accentColor }, mStyle]}>
          {mc.arrow} {mc.label}{deltaText ? ` ${deltaText}` : ""}
        </Animated.Text>
      )}

      {/* Ring + sub-scores side by side */}
      <View style={s.topRow}>
        <Pressable style={s.ringWrapper} onPress={handleRingPress}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RING_RADIUS}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              r={RING_RADIUS}
              stroke={accentColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedCircleProps}
              rotation={-90}
              origin={`${CENTER}, ${CENTER}`}
            />
            <SvgText
              x={CENTER}
              y={calibrating ? CENTER : CENTER - 2}
              fill={calibrating ? colors.text.secondary : colors.text.primary}
              fontSize={calibrating ? 14 : 28}
              fontFamily="SpaceMono"
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {calibrating ? "\u2022\u2022\u2022" : score}
            </SvgText>
            {!calibrating && (
              <SvgText
                x={CENTER}
                y={CENTER + 16}
                fill={colors.text.secondary}
                fontSize={10}
                fontFamily="SpaceMono"
                textAnchor="middle"
                alignmentBaseline="central"
                opacity={0.6}
              >
                / 100
              </SvgText>
            )}
          </Svg>
        </Pressable>

        {/* Sub-score bars */}
        <View style={[s.subsColumn, { opacity: showSubs ? 1 : 0 }]}>
          {SUB_SCORES.map((sub) => {
            const subPct = subScores[sub.key];
            return (
              <Pressable
                key={sub.key}
                style={s.subRow}
                onPress={
                  calibrating ? undefined : () => handleSubPress(sub)
                }
              >
                <Text style={s.subLabel}>
                  {sub.label}
                </Text>
                <View style={s.subBarTrack}>
                  <View
                    style={[
                      s.subBarFill,
                      {
                        width: calibrating ? "0%" : `${subPct}%`,
                        backgroundColor: calibrating
                          ? "rgba(255, 255, 255, 0.06)"
                          : accentColor,
                        opacity: calibrating ? 1 : 0.7,
                      },
                    ]}
                  />
                </View>
                <Text style={s.subValue}>
                  {calibrating ? "--" : subPct}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sparkline */}
      {sparkline && (
        <View style={[s.sparkContainer, { opacity: showSubs ? 1 : 0 }]}>
          <Svg width="100%" height={22} viewBox="0 0 200 28">
            <Polyline
              points={sparkline}
              fill="none"
              stroke={accentColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.5}
            />
          </Svg>
        </View>
      )}

      {/* Stats row */}
      <View style={[s.statsRow, { opacity: showStats ? 1 : 0 }]}>
        {calibrating ? (
          <Text style={s.calibratingHint}>
            Complete your first outing to start tracking
          </Text>
        ) : (
          <>
            <Text style={s.stat}>{questCount} quests</Text>
            <Text style={s.statDot}>{"\u00B7"}</Text>
            <Text style={s.stat}>{currentStreak}w streak</Text>
            <Text style={s.statDot}>{"\u00B7"}</Text>
            <Text style={s.stat}>{totalXp.toLocaleString()} XP</Text>
          </>
        )}
      </View>

      <InfoModal
        visible={activeInfo !== null}
        title={activeInfo?.title ?? ""}
        body={activeInfo?.body ?? ""}
        accentColor={activeInfo?.color}
        onClose={closeInfo}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.lg,
    },
    momentumBadge: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    ringWrapper: {
      width: RING_SIZE,
      height: RING_SIZE,
    },
    subsColumn: {
      flex: 1,
      gap: spacing._10,
    },
    subRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    subLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      width: 84,
    },
    subBarTrack: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      overflow: "hidden",
      flex: 1,
    },
    subBarFill: {
      height: 3,
      borderRadius: 1.5,
    },
    subValue: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      width: 24,
      textAlign: "right",
    },
    sparkContainer: {
      height: 22,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    stat: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: fontWeight.medium,
      opacity: 0.7,
    },
    statDot: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      opacity: 0.4,
    },
    calibratingHint: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontStyle: "italic",
      opacity: 0.6,
    },
  });

export default React.memo(GrowthScoreHero);
