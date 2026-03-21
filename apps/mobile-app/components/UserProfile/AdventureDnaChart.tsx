import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";
import {
  ACTIVITY_OPTIONS,
  INTENTION_OPTIONS,
} from "@/constants/adventureOptions";
import type {
  VibeCount,
  IntentionCount,
} from "@/services/api/modules/profileInsights";

interface AdventureDnaChartProps {
  vibes: VibeCount[];
  intentions: IntentionCount[];
}

const VIBE_COLORS = [
  "#4ade80", // green
  "#60a5fa", // blue
  "#fbbf24", // amber
  "#a78bfa", // purple
  "#f97316", // orange
  "#f472b6", // pink
  "#67e8f9", // cyan
  "#fb923c", // light orange
  "#34d399", // emerald
  "#818cf8", // indigo
];

const INTENTION_COLORS = [
  "#c084fc", // violet
  "#38bdf8", // sky
  "#fb7185", // rose
  "#a3e635", // lime
  "#fbbf24", // amber
  "#2dd4bf", // teal
  "#f472b6", // pink
  "#818cf8", // indigo
];

const VIBE_EMOJI: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map((o) => [o.value, o.emoji]),
);

const VIBE_LABEL: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map((o) => [o.value, o.label]),
);

const INTENTION_EMOJI: Record<string, string> = Object.fromEntries(
  INTENTION_OPTIONS.map((o) => [o.value, o.emoji]),
);

const INTENTION_LABEL: Record<string, string> = Object.fromEntries(
  INTENTION_OPTIONS.map((o) => [o.value, o.label]),
);

const AdventureDnaChart: React.FC<AdventureDnaChartProps> = ({
  vibes,
  intentions,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isEmpty = vibes.length === 0 && intentions.length === 0;
  const vibeMax = vibes.length > 0 ? Math.max(...vibes.map((v) => v.pct)) : 0;
  const intentionMax =
    intentions.length > 0 ? Math.max(...intentions.map((i) => i.pct)) : 0;

  return (
    <View>
      <Text style={styles.sectionLabel}>ADVENTURE DNA</Text>
      <View style={styles.container}>
        {isEmpty ? (
          <Text style={styles.emptyHint}>
            Your adventure style builds as you complete itineraries
          </Text>
        ) : null}

        {/* Vibes section */}
        {vibes.length > 0 && (
          <>
            <Text style={styles.subsectionLabel}>Vibes</Text>
            {vibes.map((item, i) => {
              const barColor = VIBE_COLORS[i % VIBE_COLORS.length];
              const barWidth = vibeMax > 0 ? (item.pct / vibeMax) * 100 : 0;
              const emoji = VIBE_EMOJI[item.vibe] || "\uD83C\uDFB2";
              const label = VIBE_LABEL[item.vibe] || item.vibe;

              return (
                <View key={item.vibe} style={styles.row}>
                  <View style={styles.labelRow}>
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={styles.categoryLabel}>{label}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.pctLabel, { color: barColor }]}>
                    {item.pct}%
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Intentions section */}
        {intentions.length > 0 && (
          <>
            <Text
              style={[
                styles.subsectionLabel,
                vibes.length > 0 && { marginTop: spacing.md },
              ]}
            >
              Intentions
            </Text>
            {intentions.map((item, i) => {
              const barColor = INTENTION_COLORS[i % INTENTION_COLORS.length];
              const barWidth =
                intentionMax > 0 ? (item.pct / intentionMax) * 100 : 0;
              const emoji = INTENTION_EMOJI[item.intention] || "\uD83C\uDFAF";
              const label = INTENTION_LABEL[item.intention] || item.intention;

              return (
                <View key={item.intention} style={styles.row}>
                  <View style={styles.labelRow}>
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={styles.categoryLabel}>{label}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.pctLabel, { color: barColor }]}>
                    {item.pct}%
                  </Text>
                </View>
              );
            })}
          </>
        )}
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
    subsectionLabel: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      marginBottom: spacing.xs,
      textTransform: "uppercase",
    },
    container: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      width: 100,
    },
    emoji: {
      fontSize: 12,
    },
    categoryLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textTransform: "capitalize",
    },
    barTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.bg.cardAlt,
      borderRadius: 4,
      overflow: "hidden",
    },
    barFill: {
      height: 8,
      borderRadius: 4,
    },
    pctLabel: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      width: 32,
      textAlign: "right",
    },
    emptyHint: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
  });

export default AdventureDnaChart;
