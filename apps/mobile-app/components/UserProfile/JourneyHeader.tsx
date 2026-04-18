import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GOAL_LABELS: Record<string, string> = {
  explore: "\uD83D\uDDFA\uFE0F Explore my area",
  socialize: "\uD83D\uDC4B Meet people",
  routine: "\uD83D\uDD01 Build a routine",
  fitness: "\uD83D\uDCAA Get active",
  new_skill: "\uD83C\uDFAF Pick up a new skill",
  unwind: "\uD83E\uDDD8 Decompress",
};

interface JourneyHeaderProps {
  firstName: string;
  memberSince: string;
  worldSizeSqMi: number | null;
  comfortRadiusMiles: number | null;
  currentStreak: number;
  longestStreak: number;
  goalTags?: string[];
}

export function JourneyHeader({
  firstName,
  memberSince,
  worldSizeSqMi,
  comfortRadiusMiles,
  currentStreak,
  longestStreak,
  goalTags,
}: JourneyHeaderProps) {
  const colors = useColors();
  const s = styles(colors);

  return (
    <View style={s.container}>
      <Text style={s.greeting}>
        {firstName ? `${firstName}'s Journey` : "Your Journey"}
      </Text>
      <Text style={s.memberSince}>Member since {memberSince}</Text>

      {/* World size hero */}
      <View style={s.worldRow}>
        <Text style={s.worldNumber}>
          {worldSizeSqMi != null && Number(worldSizeSqMi) > 0
            ? Number(worldSizeSqMi).toFixed(1)
            : "0"}
        </Text>
        <View>
          <Text style={s.worldLabel}>sq mi</Text>
          <Text style={s.worldSub}>your world</Text>
        </View>
      </View>

      {/* Stat pills */}
      <View style={s.pillRow}>
        {comfortRadiusMiles != null && Number(comfortRadiusMiles) > 0 && (
          <View style={s.pill}>
            <Text style={s.pillText}>
              {Number(comfortRadiusMiles).toFixed(1)} mi radius
            </Text>
          </View>
        )}
        {currentStreak > 0 && (
          <View style={s.pill}>
            <Text style={s.pillText}>
              {currentStreak}w rhythm
            </Text>
          </View>
        )}
        {longestStreak > currentStreak && longestStreak > 0 && (
          <View style={s.pill}>
            <Text style={s.pillTextDim}>
              Best: {longestStreak}w
            </Text>
          </View>
        )}
      </View>

      {/* Goals */}
      {goalTags && goalTags.length > 0 && (
        <View style={s.goalsRow}>
          {goalTags.map((tag) => (
            <View key={tag} style={s.goalChip}>
              <Text style={s.goalText}>
                {GOAL_LABELS[tag] ?? tag}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    greeting: {
      fontFamily: fontFamily.display,
      fontSize: 24,
      color: colors.text.primary,
    },
    memberSince: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    worldRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    worldNumber: {
      fontFamily: fontFamily.display,
      fontSize: 48,
      color: colors.accent.primary,
      lineHeight: 52,
    },
    worldLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    worldSub: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: spacing.sm,
    },
    pill: {
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.15)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pillText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    pillTextDim: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
    },
    goalsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: spacing.sm,
    },
    goalChip: {
      backgroundColor: `rgba(${colors.accent.rgb}, 0.12)`,
      borderWidth: 1,
      borderColor: `rgba(${colors.accent.rgb}, 0.3)`,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    goalText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
    },
  });
