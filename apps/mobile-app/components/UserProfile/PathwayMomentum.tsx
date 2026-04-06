/**
 * PathwayMomentum — enhanced pathway list with mini sparklines
 * showing resonance + difficulty trends per pathway.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
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

export interface PathwayTrendPoint {
  resonance: number;
  difficulty: number;
}

export interface PathwayWithMomentum {
  theme: string;
  themeLabel: string;
  phase: "bfs" | "dfs";
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
  /** Per-quest resonance + difficulty for sparkline */
  trendHistory: PathwayTrendPoint[];
}

export interface PathwayMomentumProps {
  pathways: PathwayWithMomentum[];
}

// ── Helpers ────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "\u2615",
  coffee: "\u2615",
  restaurant: "\uD83C\uDF7D\uFE0F",
  food: "\uD83C\uDF7D\uFE0F",
  bar: "\uD83C\uDF78",
  trail: "\uD83E\uDD7E",
  hiking: "\uD83E\uDD7E",
  park: "\uD83C\uDF33",
  museum: "\uD83C\uDFDB\uFE0F",
  gallery: "\uD83C\uDFA8",
  market: "\uD83D\uDED2",
  venue: "\uD83C\uDFAA",
  attraction: "\uD83C\uDF1F",
  fitness: "\uD83D\uDCAA",
  wellness: "\uD83E\uDDD8",
  bookstore: "\uD83D\uDCDA",
  other: "\uD83D\uDCCD",
};

const SPARK_W = 60;
const SPARK_H = 20;

function buildMiniSparkline(
  points: number[],
  width: number,
  height: number,
): string | null {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;

  return points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function trendArrow(trend: number): string {
  if (trend > 0.1) return "\u2191";
  if (trend < -0.1) return "\u2193";
  return "\u2192";
}

// ── Component ──────────────────────────────────────────────────

function PathwayMomentum({ pathways }: PathwayMomentumProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(() => {
    const dfs = pathways.filter((p) => p.phase === "dfs").sort((a, b) => b.avgResonance - a.avgResonance);
    const bfs = pathways.filter((p) => p.phase === "bfs").sort((a, b) => b.avgResonance - a.avgResonance);
    return [...dfs, ...bfs];
  }, [pathways]);

  if (sorted.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>Pathway Momentum</Text>
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>Complete quests to reveal your pathways</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Pathway Momentum</Text>

      {sorted.map((p) => {
        const isDfs = p.phase === "dfs";
        const accent = isDfs ? colors.accent.primary : BLUE;
        const emoji = CATEGORY_EMOJI[p.theme] ?? CATEGORY_EMOJI.other;
        const resonancePoints = p.trendHistory.map((t) => t.resonance);
        const diffPoints = p.trendHistory.map((t) => t.difficulty);
        const resSpark = buildMiniSparkline(resonancePoints, SPARK_W, SPARK_H);
        const diffSpark = buildMiniSparkline(diffPoints, SPARK_W, SPARK_H);

        return (
          <View key={p.theme} style={s.pathwayCard}>
            {/* Header row */}
            <View style={s.headerRow}>
              <Text style={s.emoji}>{emoji}</Text>
              <Text style={[s.label, { color: accent }]} numberOfLines={1}>
                {p.themeLabel}
              </Text>
              <View style={[s.badge, { borderColor: `${accent}44` }]}>
                <Text style={[s.badgeText, { color: accent }]}>
                  {isDfs ? "Groove" : "Exploring"}
                </Text>
              </View>
            </View>

            {/* Sparklines row */}
            <View style={s.sparklinesRow}>
              {/* Resonance sparkline */}
              <View style={s.sparkBlock}>
                <Text style={s.sparkLabel}>Resonance</Text>
                {resSpark ? (
                  <Svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
                    <Polyline
                      points={resSpark}
                      fill="none"
                      stroke={accent}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </Svg>
                ) : (
                  <View style={{ width: SPARK_W, height: SPARK_H }} />
                )}
                <Text style={[s.sparkValue, { color: accent }]}>
                  {Math.round(p.avgResonance * 100)}%
                </Text>
              </View>

              {/* Difficulty sparkline */}
              <View style={s.sparkBlock}>
                <Text style={s.sparkLabel}>Difficulty</Text>
                {diffSpark ? (
                  <Svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
                    <Polyline
                      points={diffSpark}
                      fill="none"
                      stroke={AMBER}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </Svg>
                ) : (
                  <View style={{ width: SPARK_W, height: SPARK_H }} />
                )}
                <Text style={[s.sparkValue, { color: AMBER }]}>
                  {trendArrow(p.difficultyTrend)} {p.currentDifficulty.toFixed(1)}
                </Text>
              </View>

              {/* Quest count */}
              <View style={s.countBlock}>
                <Text style={s.countValue}>{p.questCount}</Text>
                <Text style={s.countLabel}>Quests</Text>
              </View>
            </View>
          </View>
        );
      })}
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
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    pathwayCard: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 14,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
      flex: 1,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    badgeText: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    sparklinesRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.md,
    },
    sparkBlock: {
      alignItems: "center",
      gap: 2,
    },
    sparkLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
    sparkValue: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
    },
    countBlock: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    countValue: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    countLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
    emptyCard: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      padding: spacing.lg,
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: fontWeight.medium,
    },
  });

export default React.memo(PathwayMomentum);
