import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import type { VenueCategory } from "@/services/api/modules/profileInsights";

interface VenueDnaChartProps {
  data: VenueCategory[];
}

const CATEGORY_COLORS = [
  "#4ade80", // green
  "#60a5fa", // blue
  "#fbbf24", // amber
  "#a78bfa", // purple
  "#f97316", // orange
  "#f472b6", // pink
  "#67e8f9", // cyan
  "#fb923c", // light orange
];

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "\u2615",
  restaurant: "\uD83C\uDF7D\uFE0F",
  bar: "\uD83C\uDF7B",
  park: "\uD83C\uDF33",
  museum: "\uD83C\uDFDB\uFE0F",
  gallery: "\uD83C\uDFA8",
  market: "\uD83D\uDED2",
  venue: "\uD83C\uDFB5",
  attraction: "\u2B50",
  trail: "\uD83E\uDD7E",
  other: "\uD83D\uDCCD",
};

const VenueDnaChart: React.FC<VenueDnaChartProps> = ({ data }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isEmpty = data.length === 0;
  const maxPct = isEmpty ? 0 : Math.max(...data.map((d) => d.pct));

  return (
    <View>
      <Text style={styles.sectionLabel}>VENUE DNA</Text>
      <View style={styles.container}>
        {isEmpty ? (
          <Text style={styles.emptyHint}>
            Your venue taste profile builds as you check in
          </Text>
        ) : null}
        {data.map((item, i) => {
          const barColor = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          const barWidth = maxPct > 0 ? (item.pct / maxPct) * 100 : 0;
          const emoji = CATEGORY_EMOJI[item.category] || "\uD83D\uDCCD";

          return (
            <View key={item.category} style={styles.row}>
              <View style={styles.labelRow}>
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={styles.categoryLabel}>{item.category}</Text>
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

export default VenueDnaChart;
