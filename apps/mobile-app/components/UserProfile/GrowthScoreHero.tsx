/**
 * GrowthScoreHero — terminal-aesthetic growth score with unicode block
 * characters arranged in a circular ring, typewriter animations,
 * sparkline trend, and momentum indicator.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Text as SvgText, Polyline } from "react-native-svg";
import Animated, {
  Easing,
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

const GREEN = "#86efac";
const BLUE = "#93c5fd";
const AMBER = "#fbbf24";

const RING_SIZE = 130;
const CENTER = RING_SIZE / 2;
const RING_RADIUS = 48;
const SEGMENT_COUNT = 36;
const TYPE_SPEED = 35;
const BAR_WIDTH = 12;

// ── Types ──────────────────────────────────────────────────────

export interface GrowthHistoryPoint {
  score: number;
  date: string;
}

export type Momentum = "rising" | "steady" | "cooling";

export interface GrowthScoreHeroProps {
  /** Composite score 0-100 */
  score: number;
  momentum: Momentum;
  /** +/- delta over last 7 days */
  delta7d: number;
  /** Score history for sparkline */
  history: GrowthHistoryPoint[];
  /** Sub-score breakdown */
  subScores: {
    resonance: number;
    consistency: number;
    expansion: number;
    depth: number;
  };
  /** Summary stats */
  questCount: number;
  currentStreak: number;
  totalXp: number;
}

// ── Helpers ────────────────────────────────────────────────────

const MOMENTUM_CONFIG = {
  rising: { arrow: "\u2191", color: GREEN, label: "RISING" },
  steady: { arrow: "\u2192", color: "#a3a3a3", label: "STEADY" },
  cooling: { arrow: "\u2193", color: BLUE, label: "COOLING" },
} as const;

const SUB_SCORES = [
  {
    key: "resonance" as const,
    label: "RES",
    fullLabel: "Resonance",
    color: GREEN,
    info: "How emotionally aligned your quests feel. High resonance means the algorithm is finding experiences that genuinely click with you.",
  },
  {
    key: "consistency" as const,
    label: "CON",
    fullLabel: "Consistency",
    color: BLUE,
    info: "How regularly you complete quests. Streaks, weekly activity, and follow-through all contribute. Consistency compounds growth.",
  },
  {
    key: "expansion" as const,
    label: "EXP",
    fullLabel: "Expansion",
    color: AMBER,
    info: "How much you're pushing beyond your comfort zone — new areas, new venue types, further from home. Measures geographic and experiential breadth.",
  },
  {
    key: "depth" as const,
    label: "DPT",
    fullLabel: "Depth",
    color: "#c4b5fd",
    info: "How deeply you're engaging with your pathways. Returning to what resonates, increasing difficulty, and reflecting meaningfully all build depth.",
  },
];

const OVERALL_SCORE_INFO = {
  title: "Growth Score",
  body: "A composite of your Resonance, Consistency, Expansion, and Depth scores. It reflects how actively and meaningfully you're growing through quests — not just how many you complete, but how well they're working for you.",
};

function scoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildBar(value: number, width = BAR_WIDTH): string {
  const pct = value / 100;
  const filled = Math.round(pct * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

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

// Polar coordinate helper
function polarXY(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // start from top
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

// ── Typewriter hook (matches PhaseHeader) ──────────────────────

function useTypewriter(text: string, speed: number, delay = 0): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current++;
        if (indexRef.current >= text.length) {
          setDisplayed(text);
          clearInterval(interval);
        } else {
          setDisplayed(text.slice(0, indexRef.current));
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, speed, delay]);

  return displayed;
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
}: GrowthScoreHeroProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const mc = MOMENTUM_CONFIG[momentum];
  const sc = scoreColor(score);

  // ── Typewriter label ─────────────────────────────
  const fullLabel = `GROWTH: ${score}`;
  const typedLabel = useTypewriter(fullLabel, TYPE_SPEED, 200);
  const showCursor = typedLabel.length < fullLabel.length;

  // ── Animated ring fill ───────────────────────────
  const filledTarget = Math.round((score / 100) * SEGMENT_COUNT);
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    setFilledCount(0);
    const labelDone = fullLabel.length * TYPE_SPEED + 300;
    const timer = setTimeout(() => {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        if (count >= filledTarget) {
          setFilledCount(filledTarget);
          clearInterval(interval);
        } else {
          setFilledCount(count);
        }
      }, 30);
      return () => clearInterval(interval);
    }, labelDone);
    return () => clearTimeout(timer);
  }, [filledTarget, fullLabel.length]);

  // ── Momentum badge fade ──────────────────────────
  const mProg = useSharedValue(0);
  useEffect(() => {
    mProg.value = 0;
    mProg.value = withDelay(
      fullLabel.length * TYPE_SPEED + 400,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [momentum, mProg, fullLabel.length]);
  const mStyle = useAnimatedStyle(() => ({
    opacity: mProg.value,
    transform: [{ translateY: (1 - mProg.value) * -6 }],
  }));

  // ── Sub-score bars appear after ring ─────────────
  const subsDelay = fullLabel.length * TYPE_SPEED + SEGMENT_COUNT * 30 + 200;
  const [showSubs, setShowSubs] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowSubs(true), subsDelay);
    return () => clearTimeout(timer);
  }, [subsDelay]);

  // ── Stats row appears last ───────────────────────
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), subsDelay + 400);
    return () => clearTimeout(timer);
  }, [subsDelay]);

  // ── Info modal state ──────────────────────────────
  const [activeInfo, setActiveInfo] = useState<{
    title: string;
    body: string;
    color?: string;
  } | null>(null);
  const closeInfo = useCallback(() => setActiveInfo(null), []);

  const handleRingPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveInfo({ title: OVERALL_SCORE_INFO.title, body: OVERALL_SCORE_INFO.body, color: sc });
  }, [sc]);

  const handleSubPress = useCallback((sub: typeof SUB_SCORES[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveInfo({ title: sub.fullLabel, body: sub.info, color: sub.color });
  }, []);

  const deltaText =
    delta7d > 0 ? `+${delta7d}` : delta7d < 0 ? `${delta7d}` : "";
  const sparkline = buildSparkline(history);

  // Build ring segments
  const segments = useMemo(() => {
    const segs: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const angleDeg = (i / SEGMENT_COUNT) * 360;
      const [x, y] = polarXY(angleDeg, RING_RADIUS);
      segs.push({ x, y, angle: angleDeg });
    }
    return segs;
  }, []);

  return (
    <View style={s.container}>
      {/* Header: Typewriter label + momentum */}
      <View style={s.headerRow}>
        <Text style={[s.typeLabel, { color: sc }]}>
          {typedLabel}
          {showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
        </Text>
        <Animated.Text style={[s.momentumBadge, { color: mc.color }, mStyle]}>
          {mc.arrow} {mc.label}{deltaText ? ` ${deltaText}` : ""}
        </Animated.Text>
      </View>

      {/* Ring + sub-scores side by side */}
      <View style={s.topRow}>
        {/* Unicode block ring (tappable for overall score info) */}
        <Pressable style={s.ringWrapper} onPress={handleRingPress}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {segments.map((seg, i) => {
              const isFilled = i < filledCount;
              const char = isFilled ? "\u2588" : "\u2591";
              const fillColor = isFilled ? sc : "rgba(255, 255, 255, 0.08)";

              return (
                <SvgText
                  key={i}
                  x={seg.x}
                  y={seg.y}
                  fill={fillColor}
                  fontSize={11}
                  fontFamily="SpaceMono"
                  textAnchor="middle"
                  alignmentBaseline="central"
                  rotation={seg.angle}
                  origin={`${seg.x}, ${seg.y}`}
                >
                  {char}
                </SvgText>
              );
            })}
            {/* Center score */}
            <SvgText
              x={CENTER}
              y={CENTER - 4}
              fill={sc}
              fontSize={24}
              fontFamily="SpaceMono"
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {filledCount > 0 ? Math.round((filledCount / SEGMENT_COUNT) * 100) : ""}
            </SvgText>
            <SvgText
              x={CENTER}
              y={CENTER + 14}
              fill="rgba(255, 255, 255, 0.25)"
              fontSize={7}
              fontFamily="SpaceMono"
              textAnchor="middle"
              alignmentBaseline="central"
            >
              /100
            </SvgText>
          </Svg>
        </Pressable>

        {/* Sub-score bars (each tappable for info) */}
        <View style={[s.subsColumn, { opacity: showSubs ? 1 : 0 }]}>
          {SUB_SCORES.map((sub) => (
            <Pressable key={sub.key} style={s.subRow} onPress={() => handleSubPress(sub)}>
              <Text style={s.subLabel}>{sub.label}</Text>
              <Text style={[s.subBar, { color: sub.color }]}>
                {buildBar(subScores[sub.key])}
              </Text>
              <Text style={[s.subValue, { color: sub.color }]}>
                {subScores[sub.key]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Sparkline (subtle, below ring) */}
      {sparkline && (
        <View style={[s.sparkContainer, { opacity: showSubs ? 1 : 0 }]}>
          <Svg width="100%" height={22} viewBox="0 0 200 28">
            <Polyline
              points={sparkline}
              fill="none"
              stroke={sc}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.6}
            />
          </Svg>
        </View>
      )}

      {/* Stats row (fades in last) */}
      <View style={[s.statsRow, { opacity: showStats ? 1 : 0 }]}>
        <Text style={s.stat}>{questCount} quests</Text>
        <Text style={s.statDot}>{"\u00B7"}</Text>
        <Text style={s.stat}>{currentStreak}w streak</Text>
        <Text style={s.statDot}>{"\u00B7"}</Text>
        <Text style={s.stat}>{totalXp.toLocaleString()} XP</Text>
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
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    typeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      fontWeight: fontWeight.bold,
      letterSpacing: 1.5,
    },
    cursor: {
      fontSize: 14,
      opacity: 0.6,
    },
    momentumBadge: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    ringWrapper: {
      width: RING_SIZE,
      height: RING_SIZE,
    },
    subsColumn: {
      flex: 1,
      gap: spacing._6,
    },
    subRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._6,
    },
    subLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.8,
      width: 24,
    },
    subBar: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      letterSpacing: -0.5,
      flex: 1,
    },
    subValue: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      width: 22,
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
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: fontWeight.medium,
    },
    statDot: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: "rgba(255, 255, 255, 0.2)",
    },
  });

export default React.memo(GrowthScoreHero);
