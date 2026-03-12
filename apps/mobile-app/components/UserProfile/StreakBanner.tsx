import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

interface StreakBannerProps {
  currentStreak: number;
  longestStreak: number;
}

const STREAK_TIERS = [
  { min: 0, label: "Start exploring!", color: "#6b7280" },
  { min: 1, label: "Getting started", color: "#4ade80" },
  { min: 3, label: "Building momentum", color: "#60a5fa" },
  { min: 7, label: "On fire!", color: "#f97316" },
  { min: 12, label: "Dedicated explorer", color: "#a78bfa" },
  { min: 26, label: "Half-year legend", color: "#fbbf24" },
  { min: 52, label: "Year-long adventurer", color: "#ef4444" },
];

function getStreakTier(streak: number) {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].min) {
      return STREAK_TIERS[i];
    }
  }
  return STREAK_TIERS[0];
}

const StreakBanner: React.FC<StreakBannerProps> = ({
  currentStreak,
  longestStreak,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tier = getStreakTier(currentStreak);

  if (currentStreak === 0 && longestStreak === 0) return null;

  return (
    <View style={[styles.container, { borderColor: tier.color + "40" }]}>
      <View style={styles.mainRow}>
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>
            {currentStreak > 0 ? `Week ${currentStreak}` : "No streak"}
          </Text>
          <Text style={[styles.streakLabel, { color: tier.color }]}>
            {tier.label}
          </Text>
        </View>
        {currentStreak > 0 && (
          <Text
            style={[
              styles.flame,
              { opacity: Math.min(1, 0.5 + currentStreak * 0.1) },
            ]}
          >
            {currentStreak >= 7 ? "\uD83D\uDD25" : "\u26FA"}
          </Text>
        )}
      </View>
      {longestStreak > currentStreak && (
        <Text style={styles.longestText}>
          Longest: {longestStreak} week{longestStreak !== 1 ? "s" : ""}
        </Text>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.bg.elevated,
    },
    mainRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    streakInfo: {
      gap: 2,
    },
    streakNumber: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    streakLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
    flame: {
      fontSize: 28,
    },
    longestText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      marginTop: spacing.xs,
    },
  });

export default StreakBanner;
