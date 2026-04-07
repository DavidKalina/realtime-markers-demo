/**
 * SelfInsight — surfaces expectancy calibration data as a personal
 * awareness card. Shows whether the user over/under-estimates anxiety
 * and difficulty, with a visual gauge.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const BLUE = "#93c5fd";
const AMBER = "#fbbf24";

// ── Types ──────────────────────────────────────────────────────

export type CalibrationType =
  | "strong_overestimator"
  | "mild_overestimator"
  | "well_calibrated"
  | "underestimator";

export interface SelfInsightProps {
  /** Average anxiety prediction delta (positive = overestimates) */
  avgAnxietyDelta: number;
  /** Average difficulty prediction delta */
  avgDifficultyDelta: number;
  /** Total prediction violations */
  totalViolations: number;
  /** Derived calibration type */
  calibrationType: CalibrationType;
  /** Number of quests with predictions */
  questsWithPredictions: number;
}

// ── Config ─────────────────────────────────────────────────────

const CALIBRATION_CONFIG: Record<
  CalibrationType,
  { emoji: string; headline: string; body: string; color: string | null }
> = {
  strong_overestimator: {
    emoji: "\uD83D\uDCA1",
    headline: "You're braver than you think",
    body: "You consistently overestimate how anxious you'll feel. Quests tend to go much better than you expect — lean into that.",
    color: null, // accent
  },
  mild_overestimator: {
    emoji: "\uD83C\uDF31",
    headline: "Growing confidence",
    body: "You tend to expect slightly more anxiety than you actually feel. Your comfort zone is expanding faster than your expectations.",
    color: null, // accent
  },
  well_calibrated: {
    emoji: "\uD83C\uDFAF",
    headline: "Strong self-awareness",
    body: "Your predictions closely match reality. You have a solid read on your comfort level — trust your instincts.",
    color: BLUE,
  },
  underestimator: {
    emoji: "\uD83D\uDEE1\uFE0F",
    headline: "Taking it steady",
    body: "Some quests feel harder than expected. That's okay — we'll adjust pacing so each step feels more manageable.",
    color: AMBER,
  },
};

// ── Gauge helpers ──────────────────────────────────────────────

function computeGaugePercent(delta: number): number {
  // delta range: roughly -3 to +3, center at 0
  const normalized = Math.max(-3, Math.min(3, delta));
  return ((normalized + 3) / 6) * 100; // 0..100
}

// ── Component ──────────────────────────────────────────────────

function SelfInsight({
  avgAnxietyDelta,
  avgDifficultyDelta,
  totalViolations,
  calibrationType,
  questsWithPredictions,
}: SelfInsightProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const rawConfig = CALIBRATION_CONFIG[calibrationType];
  const config = { ...rawConfig, color: rawConfig.color ?? colors.accent.primary };
  const anxietyPct = computeGaugePercent(avgAnxietyDelta);
  const difficultyPct = computeGaugePercent(avgDifficultyDelta);

  if (questsWithPredictions < 3) return null;

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Self-Awareness</Text>

      <View style={s.card}>
        {/* Headline */}
        <View style={s.headlineRow}>
          <Text style={s.emoji}>{config.emoji}</Text>
          <View style={s.headlineText}>
            <Text style={[s.headline, { color: config.color }]}>
              {config.headline}
            </Text>
            <Text style={s.body}>{config.body}</Text>
          </View>
        </View>

        {/* Gauges */}
        <View style={s.gaugesBlock}>
          <View style={s.gaugeRow}>
            <Text style={s.gaugeLabel}>Anxiety</Text>
            <View style={s.gaugeTrack}>
              <View style={s.gaugeCenterLine} />
              <View style={[s.gaugeMarker, { left: `${anxietyPct}%`, backgroundColor: config.color }]} />
            </View>
          </View>
          <View style={s.gaugeScale}>
            <Text style={s.scaleLabel}>overestimates</Text>
            <Text style={s.scaleLabel}>accurate</Text>
            <Text style={s.scaleLabel}>underestimates</Text>
          </View>

          <View style={[s.gaugeRow, { marginTop: spacing.sm }]}>
            <Text style={s.gaugeLabel}>Difficulty</Text>
            <View style={s.gaugeTrack}>
              <View style={s.gaugeCenterLine} />
              <View style={[s.gaugeMarker, { left: `${difficultyPct}%`, backgroundColor: config.color }]} />
            </View>
          </View>
          <View style={s.gaugeScale}>
            <Text style={s.scaleLabel}>overestimates</Text>
            <Text style={s.scaleLabel}>accurate</Text>
            <Text style={s.scaleLabel}>underestimates</Text>
          </View>
        </View>

        {/* Stats footer */}
        <View style={s.footerRow}>
          <Text style={s.footerStat}>
            {questsWithPredictions} quests tracked
          </Text>
          <Text style={s.footerDot}>{"\u00B7"}</Text>
          <Text style={s.footerStat}>
            {totalViolations} surprise{totalViolations !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    headlineRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 22,
      marginTop: 2,
    },
    headlineText: {
      flex: 1,
      gap: 3,
    },
    headline: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.3,
    },
    body: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      lineHeight: 15,
    },
    gaugesBlock: {
      gap: 2,
    },
    gaugeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    gaugeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
      width: 50,
    },
    gaugeTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.12)",
      position: "relative",
      justifyContent: "center",
    },
    gaugeCenterLine: {
      position: "absolute",
      left: "50%",
      width: 1,
      height: 10,
      backgroundColor: "rgba(255,255,255,0.3)",
      marginLeft: -0.5,
    },
    gaugeMarker: {
      position: "absolute",
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: -4,
    },
    gaugeScale: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingLeft: 58, // align with gauge
    },
    scaleLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      color: "rgba(255, 255, 255, 0.25)",
      letterSpacing: 0.3,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.08)",
      paddingTop: spacing.sm,
    },
    footerStat: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
    },
    footerDot: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: "rgba(255, 255, 255, 0.25)",
    },
  });

export default React.memo(SelfInsight);
