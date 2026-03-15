import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useColors,
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import {
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const categoryBreakdown = useMemo(() => {
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
      <View style={styles.container}>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonStat} />
          <View style={styles.skeletonStat} />
          <View style={styles.skeletonStat} />
        </View>
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
    { label: "Explorers", value: formatNumber(stats.totalUsers) },
    { label: "Cities", value: formatNumber(stats.cityBreakdown.length) },
  ];

  return (
    <View style={styles.container}>
      {/* Stats as inline rows */}
      <Text style={styles.sectionLabel}>STATS</Text>
      {statItems.map((stat, i) => (
        <View key={stat.label} style={styles.statRow}>
          <View style={styles.statLabelRow}>
            <View
              style={[styles.statDot, { backgroundColor: STAT_COLORS[i] }]}
            />
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
          <Text style={[styles.statValue, { color: STAT_COLORS[i] }]}>
            {stat.value}
          </Text>
        </View>
      ))}

      {/* Category breakdown as dot rows */}
      {categoryBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            CATEGORIES
          </Text>
          {categoryBreakdown.map((cat, i) => (
            <View key={cat.name} style={styles.statRow}>
              <View style={styles.statLabelRow}>
                <View
                  style={[
                    styles.statDot,
                    { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
                  ]}
                />
                <Text style={styles.statLabel}>{cat.name}</Text>
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: BAR_COLORS[i % BAR_COLORS.length] },
                ]}
              >
                {cat.pct}%
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Cities scanned as pills */}
      {stats.cityBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            CITIES EXPLORED
          </Text>
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
        </>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    // Skeleton
    skeletonRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    skeletonStat: {
      flex: 1,
      height: 32,
      backgroundColor: colors.bg.cardAlt,
      borderRadius: radius.md,
    },
    // Section labels
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    sectionGap: {
      marginTop: spacing.md,
    },
    // Stat rows (like ThirdSpaceScoreHero sub-scores)
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    statLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    statValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    // Cities
    cityPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xs,
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
