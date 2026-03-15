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
import type { WeekActivity } from "@/services/api/modules/profileInsights";

interface StreakCalendarProps {
  data: WeekActivity[];
  currentStreak: number;
  longestStreak: number;
}

const TOTAL_WEEKS = 16;

function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getWeekColor(count: number): string {
  if (count === 0) return "transparent";
  if (count >= 5) return "#4ade80";
  if (count >= 3) return "#86efac";
  if (count >= 1) return "rgba(134, 239, 172, 0.4)";
  return "transparent";
}

const STREAK_TIERS = [
  { min: 52, label: "Year-long adventurer", color: "#ef4444" },
  { min: 26, label: "Half-year legend", color: "#fbbf24" },
  { min: 12, label: "Dedicated explorer", color: "#a78bfa" },
  { min: 7, label: "On fire!", color: "#f97316" },
  { min: 3, label: "Building momentum", color: "#60a5fa" },
  { min: 1, label: "Getting started", color: "#4ade80" },
  { min: 0, label: "Start exploring!", color: "#6b7280" },
];

function getStreakTier(streak: number) {
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.min) return tier;
  }
  return STREAK_TIERS[STREAK_TIERS.length - 1];
}

const StreakCalendar: React.FC<StreakCalendarProps> = ({
  data,
  currentStreak,
  longestStreak,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tier = getStreakTier(currentStreak);

  const weeks = useMemo(() => {
    const weekMap = new Map<string, number>();
    for (const w of data) {
      weekMap.set(w.weekStart, w.count);
    }

    // Generate 16 weeks ending at current week
    const today = new Date();
    const currentMonday = getWeekMonday(today);

    const result: { weekStart: string; count: number; label: string }[] = [];
    for (let i = TOTAL_WEEKS - 1; i >= 0; i--) {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() - i * 7);
      const ws = d.toISOString().slice(0, 10);
      const count = weekMap.get(ws) || 0;

      // Month label for first week of each month
      const monthDay = d.getDate();
      const label =
        monthDay <= 7 ? d.toLocaleDateString("en-US", { month: "short" }) : "";

      result.push({ weekStart: ws, count, label });
    }
    return result;
  }, [data]);

  if (currentStreak === 0 && longestStreak === 0 && data.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>ADVENTURE STREAK</Text>
      <View style={[styles.container, { borderColor: tier.color + "40" }]}>
        {/* Streak header */}
        <View style={styles.headerRow}>
          <View style={styles.streakInfo}>
            <Text style={styles.streakNumber}>
              {currentStreak > 0 ? `Week ${currentStreak}` : "No streak"}
            </Text>
            <Text style={[styles.streakTier, { color: tier.color }]}>
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

        {/* Visual week strip */}
        <View style={styles.weekStrip}>
          {weeks.map((week) => (
            <View key={week.weekStart} style={styles.weekColumn}>
              <View
                style={[
                  styles.weekCell,
                  {
                    backgroundColor:
                      week.count > 0
                        ? getWeekColor(week.count)
                        : colors.bg.cardAlt,
                    borderColor:
                      week.count > 0
                        ? getWeekColor(week.count)
                        : colors.border.default,
                  },
                ]}
              >
                {week.count > 0 && (
                  <Text style={styles.weekCount}>{week.count}</Text>
                )}
              </View>
              {week.label ? (
                <Text style={styles.monthLabel}>{week.label}</Text>
              ) : (
                <Text style={styles.monthLabel}> </Text>
              )}
            </View>
          ))}
        </View>

        {/* Footer stats */}
        {longestStreak > currentStreak && (
          <Text style={styles.longestText}>
            Longest: {longestStreak} week{longestStreak !== 1 ? "s" : ""}
          </Text>
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
    container: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.bg.elevated,
      gap: spacing.md,
    },
    headerRow: {
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
    streakTier: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
    },
    flame: {
      fontSize: 28,
    },
    weekStrip: {
      flexDirection: "row",
      gap: 3,
    },
    weekColumn: {
      flex: 1,
      alignItems: "center",
      gap: 3,
    },
    weekCell: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: "center",
      justifyContent: "center",
    },
    weekCount: {
      fontSize: 8,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "rgba(0,0,0,0.5)",
    },
    monthLabel: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
    longestText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
  });

export default StreakCalendar;
