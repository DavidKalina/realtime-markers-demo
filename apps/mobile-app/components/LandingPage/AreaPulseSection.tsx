import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import {
  CategoryPieChart,
  BAR_COLORS,
  formatNumber,
} from "@/components/AreaScan/AreaScanComponents";
import type { LeaderboardEntry } from "@/services/ApiClient";
import type { TrendingEventType } from "@/types/types";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

interface AreaPulseSectionProps {
  popularCategories: Category[];
  trendingEvents: TrendingEventType[];
  leaderboard: LeaderboardEntry[];
  city?: string;
}

const AreaPulseSection: React.FC<AreaPulseSectionProps> = ({
  popularCategories,
  trendingEvents,
  leaderboard,
  city,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalEvents = useMemo(
    () => popularCategories.reduce((sum, c) => sum + (c.eventCount || 0), 0),
    [popularCategories],
  );

  const pieBreakdown = useMemo(() => {
    if (totalEvents === 0) return [];
    return popularCategories
      .filter((c) => (c.eventCount || 0) > 0)
      .map((c) => ({
        name: c.name,
        pct: Math.round(((c.eventCount || 0) / totalEvents) * 100),
      }));
  }, [popularCategories, totalEvents]);

  if (
    totalEvents === 0 &&
    trendingEvents.length === 0 &&
    leaderboard.length === 0
  ) {
    return null;
  }

  const cityLabel = city ? city.split(",")[0].trim() : "Your Area";

  const STAT_COLORS = ["#93c5fd", "#fcd34d", "#86efac"];

  const stats = [
    { label: "Events", value: formatNumber(totalEvents) },
    { label: "Trending", value: formatNumber(trendingEvents.length) },
    { label: "Scanners", value: formatNumber(leaderboard.length) },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Area Pulse</Text>
      <Text style={styles.subtitle}>{cityLabel} · This Week</Text>

      <View style={styles.card}>
        {/* Stat row */}
        <View style={styles.statRow}>
          {stats.map((stat, i) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: STAT_COLORS[i] }]}>
                {stat.value}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Pie chart + legend */}
        {pieBreakdown.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.chartSection}>
              <CategoryPieChart breakdown={pieBreakdown} />
              <View style={styles.legendWrap}>
                {pieBreakdown.map((cat, i) => (
                  <View key={cat.name} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {cat.name} {cat.pct}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.lg,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      textTransform: "uppercase" as const,
    },
    subtitle: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      fontFamily: fontFamily.mono,
    },
    card: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.default,
      overflow: "hidden",
      padding: spacing.xl,
      gap: spacing.xl,
    },
    statRow: {
      flexDirection: "row",
      gap: spacing._10,
    },
    statCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.cardAlt,
      gap: 2,
    },
    statValue: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    statLabel: {
      fontSize: 10,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.8,
      textTransform: "uppercase" as const,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
    },
    chartSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xl,
    },
    legendWrap: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
  });

export default AreaPulseSection;
