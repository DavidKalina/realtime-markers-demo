import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const AMBER = "#fbbf24";
const RED = "#f87171";

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

function scoreToColor(score: number, accent: string): string {
  if (score <= 0.4) return accent;
  if (score <= 0.7) return AMBER;
  return RED;
}

function formatDimension(key: string): string {
  return key.replace(/_/g, " ");
}

function PerceivedFearMeter({ overallScore, dimensionScores }: PerceivedFearMeterProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const meterColor = scoreToColor(overallScore, colors.accent.primary);
  const label = scoreToLabel(overallScore);
  const pct = Math.round(overallScore * 100);

  // Sort dimensions by score descending
  const sortedDimensions = useMemo(() => {
    return Object.entries(dimensionScores)
      .sort(([, a], [, b]) => b - a);
  }, [dimensionScores]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Perceived Fear</Text>
      <View style={s.card}>
        {/* Overall meter */}
        <View style={s.meterSection}>
          <View style={s.meterHeader}>
            <Text style={[s.meterLabel, { color: meterColor }]}>{label}</Text>
            <Text style={[s.meterPct, { color: meterColor }]}>{pct}%</Text>
          </View>
          <View style={s.meterTrack}>
            <View style={[s.meterFill, { width: `${overallScore * 100}%`, backgroundColor: meterColor }]} />
          </View>
        </View>

        {/* Dimension breakdown */}
        {sortedDimensions.length > 0 && (
          <View style={s.dimensions}>
            {sortedDimensions.map(([dim, score]) => {
              const dimColor = scoreToColor(score, colors.accent.primary);
              return (
                <View key={dim} style={s.dimRow}>
                  <Text style={s.dimName} numberOfLines={1}>{formatDimension(dim)}</Text>
                  <View style={s.dimTrack}>
                    <View style={[s.dimFill, { width: `${score * 100}%`, backgroundColor: dimColor }]} />
                  </View>
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
    meterTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    meterFill: {
      height: 6,
      borderRadius: 3,
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
    dimTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    dimFill: {
      height: 4,
      borderRadius: 2,
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
