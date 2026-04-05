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

const GREEN = "#86efac";
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
  { emoji: string; headline: string; body: string; color: string }
> = {
  strong_overestimator: {
    emoji: "\uD83D\uDCA1",
    headline: "You're braver than you think",
    body: "You consistently overestimate how anxious you'll feel. Quests tend to go much better than you expect — lean into that.",
    color: GREEN,
  },
  mild_overestimator: {
    emoji: "\uD83C\uDF31",
    headline: "Growing confidence",
    body: "You tend to expect slightly more anxiety than you actually feel. Your comfort zone is expanding faster than your expectations.",
    color: GREEN,
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

const GAUGE_WIDTH = 30; // unicode chars

function buildGauge(delta: number): { bar: string; markerPos: number } {
  // delta range: roughly -3 to +3, center at 0
  const normalized = Math.max(-3, Math.min(3, delta));
  const pct = (normalized + 3) / 6; // 0..1
  const markerPos = Math.round(pct * (GAUGE_WIDTH - 1));

  const chars: string[] = [];
  for (let i = 0; i < GAUGE_WIDTH; i++) {
    if (i === markerPos) {
      chars.push("\u2588");
    } else if (i === Math.round(GAUGE_WIDTH / 2)) {
      chars.push("\u2502");
    } else {
      chars.push("\u2591");
    }
  }
  return { bar: chars.join(""), markerPos };
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
  const config = CALIBRATION_CONFIG[calibrationType];
  const anxietyGauge = buildGauge(avgAnxietyDelta);
  const difficultyGauge = buildGauge(avgDifficultyDelta);

  if (questsWithPredictions < 3) return null;

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>SELF-AWARENESS</Text>

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
            <Text style={[s.gaugeBar, { color: config.color }]}>
              {anxietyGauge.bar}
            </Text>
          </View>
          <View style={s.gaugeScale}>
            <Text style={s.scaleLabel}>overestimates</Text>
            <Text style={s.scaleLabel}>accurate</Text>
            <Text style={s.scaleLabel}>underestimates</Text>
          </View>

          <View style={[s.gaugeRow, { marginTop: spacing.sm }]}>
            <Text style={s.gaugeLabel}>Difficulty</Text>
            <Text style={[s.gaugeBar, { color: config.color }]}>
              {difficultyGauge.bar}
            </Text>
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
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
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
    gaugeBar: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      letterSpacing: -0.5,
      flex: 1,
    },
    gaugeScale: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingLeft: 58, // align with gauge
    },
    scaleLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      color: "rgba(255, 255, 255, 0.15)",
      letterSpacing: 0.3,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.04)",
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
      color: "rgba(255, 255, 255, 0.15)",
    },
  });

export default React.memo(SelfInsight);
