import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  radius,
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
      {primaryGoal && (
        <Text style={s.goalText}>{primaryGoal}</Text>
      )}

      {(targetDate || goalLocation) && (
        <View style={s.metaRow}>
          {targetDate && (
            <Text style={s.metaText}>
              By {formatTargetDate(targetDate)}
            </Text>
          )}
          {targetDate && goalLocation && (
            <Text style={s.metaDot}>{"\u00B7"}</Text>
          )}
          {goalLocation && (
            <Text style={s.metaText}>{goalLocation}</Text>
          )}
        </View>
      )}

      {northStar && (
        <Text style={s.northStarText}>
          {"\u201C"}{northStar}{"\u201D"}
        </Text>
      )}

      {!northStar && !primaryGoal && (
        <Text style={s.emptyText}>Set your north star in onboarding</Text>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: `rgba(${colors.accent.rgb}, 0.06)`,
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: spacing.md,
    },
    goalText: {
      fontFamily: fontFamily.mono,
      fontSize: 15,
      color: colors.text.primary,
      lineHeight: 24,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    metaText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      opacity: 0.8,
    },
    metaDot: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      opacity: 0.4,
    },
    northStarText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      fontStyle: "italic",
      opacity: 0.8,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      opacity: 0.5,
    },
  });

export default React.memo(NorthStarCard);
