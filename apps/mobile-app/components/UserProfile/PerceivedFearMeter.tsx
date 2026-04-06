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
const AMBER = "#fbbf24";
const RED = "#f87171";
const BAR_WIDTH = 24;

interface PerceivedFearMeterProps {
  overallScore: number; // 0-1, where 0 = comfortable, 1 = very anxious
  dimensionScores: Record<string, number>;
}

function scoreToLabel(score: number): string {
  if (score <= 0.2) return "Very comfortable";
  if (score <= 0.4) return "Mostly at ease";
  if (score <= 0.6) return "Moderate unease";
  if (score <= 0.8) return "High anxiety";
  return "Significant fear";
}

function scoreToColor(score: number): string {
  if (score <= 0.4) return GREEN;
  if (score <= 0.7) return AMBER;
  return RED;
}

function buildMeterBar(score: number): string {
  const filled = Math.round(score * BAR_WIDTH);
  return "\u2588".repeat(filled) + "\u2591".repeat(BAR_WIDTH - filled);
}

function formatDimension(key: string): string {
  return key.replace(/_/g, " ");
}

function PerceivedFearMeter({ overallScore, dimensionScores }: PerceivedFearMeterProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const meterColor = scoreToColor(overallScore);
  const bar = buildMeterBar(overallScore);
  const label = scoreToLabel(overallScore);
  const pct = Math.round(overallScore * 100);

  // Sort dimensions by score descending
  const sortedDimensions = useMemo(() => {
    return Object.entries(dimensionScores)
      .sort(([, a], [, b]) => b - a);
  }, [dimensionScores]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>PERCEIVED FEAR</Text>
      <View style={s.card}>
        {/* Overall meter */}
        <View style={s.meterSection}>
          <View style={s.meterHeader}>
            <Text style={[s.meterLabel, { color: meterColor }]}>{label}</Text>
            <Text style={[s.meterPct, { color: meterColor }]}>{pct}%</Text>
          </View>
          <Text style={[s.meterBar, { color: meterColor }]}>{bar}</Text>
        </View>

        {/* Dimension breakdown */}
        {sortedDimensions.length > 0 && (
          <View style={s.dimensions}>
            {sortedDimensions.map(([dim, score]) => {
              const dimColor = scoreToColor(score);
              const dimFilled = Math.round(score * 12);
              const dimBar = "\u2588".repeat(dimFilled) + "\u2591".repeat(12 - dimFilled);
              return (
                <View key={dim} style={s.dimRow}>
                  <Text style={s.dimName} numberOfLines={1}>{formatDimension(dim)}</Text>
                  <Text style={[s.dimBar, { color: dimColor }]}>{dimBar}</Text>
                  <Text style={[s.dimScore, { color: dimColor }]}>{Math.round(score * 100)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

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
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    meterSection: {
      gap: spacing.xs,
    },
    meterHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    meterLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
    },
    meterPct: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
    },
    meterBar: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      letterSpacing: -0.5,
    },
    dimensions: {
      gap: 6,
    },
    dimRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    dimName: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
      width: 80,
      textTransform: "capitalize",
    },
    dimBar: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      letterSpacing: -0.5,
      flex: 1,
    },
    dimScore: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      width: 24,
      textAlign: "right",
    },
  });

export default React.memo(PerceivedFearMeter);
