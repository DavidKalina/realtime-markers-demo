import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface NorthStarCardProps {
  northStar?: string;
  primaryGoal?: string;
  targetDate?: string;
  goalLocation?: string;
}

function formatTargetDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function NorthStarCard({ northStar, primaryGoal, targetDate, goalLocation }: NorthStarCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>North Star</Text>
      <View style={s.card}>
        {primaryGoal && (
          <View style={s.goalBlock}>
            <Text style={s.goalLabel}>Goal</Text>
            <Text style={s.goalVal} numberOfLines={2}>{primaryGoal}</Text>
          </View>
        )}
        {(targetDate || goalLocation) && (
          <View style={s.metaRow}>
            {targetDate && (
              <View style={s.goalBlock}>
                <Text style={s.goalLabel}>Target</Text>
                <Text style={s.metaVal}>{formatTargetDate(targetDate)}</Text>
              </View>
            )}
            {goalLocation && (
              <View style={s.goalBlock}>
                <Text style={s.goalLabel}>Where</Text>
                <Text style={s.metaVal}>{goalLocation}</Text>
              </View>
            )}
          </View>
        )}
        {northStar ? (
          <Text style={s.northStarText}>"{northStar}"</Text>
        ) : !primaryGoal && (
          <Text style={s.northStarText}>Set your north star in onboarding</Text>
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
      color: colors.text.secondary,
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: `rgba(${colors.accent.rgb}, 0.15)`,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    goalBlock: {
      gap: 2,
    },
    goalLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: "rgba(255, 255, 255, 0.7)",
    },
    goalVal: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.accent.primary,
      flex: 1,
    },
    metaRow: {
      flexDirection: "row",
      gap: spacing.lg,
    },
    metaVal: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.7)",
      flex: 1,
    },
    northStarText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      lineHeight: 18,
      fontStyle: "italic",
    },
  });

export default React.memo(NorthStarCard);
