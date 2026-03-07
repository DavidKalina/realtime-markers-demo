import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import {
  CategoryPieChart,
  BAR_COLORS,
  formatNumber,
} from "@/components/AreaScan/AreaScanComponents";
import type { UserStats } from "@/services/ApiClient";

interface UserStatsCardProps {
  stats: UserStats | null;
  isLoading: boolean;
}

const STAT_COLORS = ["#93c5fd", "#fcd34d", "#86efac"];

const UserStatsCard: React.FC<UserStatsCardProps> = ({ stats, isLoading }) => {
  const pieBreakdown = useMemo(() => {
    if (!stats) return [];
    const total = stats.categoryBreakdown.reduce((s, c) => s + c.count, 0);
    if (total === 0) return [];
    return stats.categoryBreakdown
      .filter((c) => c.count > 0)
      .map((c) => ({
        name: c.name,
        pct: Math.round((c.count / total) * 100),
      }));
  }, [stats]);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonStat} />
          <View style={styles.skeletonStat} />
          <View style={styles.skeletonStat} />
        </View>
        <View style={styles.divider} />
        <View style={styles.skeletonBlock} />
      </View>
    );
  }

  if (
    !stats ||
    (stats.categoryBreakdown.length === 0 && stats.cityBreakdown.length === 0)
  ) {
    return null;
  }

  const statItems = [
    { label: "Rank", value: `#${stats.globalRank}` },
    { label: "Scanners", value: formatNumber(stats.totalUsers) },
    { label: "Cities", value: formatNumber(stats.cityBreakdown.length) },
  ];

  return (
    <View style={styles.card}>
      {/* Stat row */}
      <View style={styles.statRow}>
        {statItems.map((stat, i) => (
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
            <ScrollView style={styles.legendScroll} nestedScrollEnabled>
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
            </ScrollView>
          </View>
        </>
      )}

      {/* Cities scanned */}
      {stats.cityBreakdown.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.citiesSection}>
            <Text style={styles.sectionLabel}>CITIES SCANNED</Text>
            <ScrollView style={styles.cityPillsScroll} nestedScrollEnabled>
              <View style={styles.cityPills}>
                {stats.cityBreakdown.map((c) => (
                  <View key={c.city} style={styles.cityPill}>
                    <Text style={styles.cityName}>
                      {c.city.split(",")[0].trim()}
                    </Text>
                    <Text style={styles.cityCount}>{c.count}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  // Skeleton
  skeletonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  skeletonStat: {
    flex: 1,
    height: 56,
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.lg,
  },
  skeletonBlock: {
    height: 80,
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.lg,
  },
  // Stat row
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
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
  // Pie chart
  chartSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  legendScroll: {
    flex: 1,
    maxHeight: 120,
  },
  legendWrap: {
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
  // Cities
  citiesSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
  },
  cityPillsScroll: {
    maxHeight: 120,
  },
  cityPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bg.cardAlt,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cityName: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  cityCount: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

export default UserStatsCard;
