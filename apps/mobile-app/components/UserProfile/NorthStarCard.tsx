import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";

interface NorthStarCardProps {
  northStar?: string;
  primaryGoal?: string;
}

function NorthStarCard({ northStar, primaryGoal }: NorthStarCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>NORTH STAR</Text>
      <View style={s.card}>
        {primaryGoal && (
          <View style={s.goalRow}>
            <Text style={s.goalKey}>goal</Text>
            <Text style={s.goalVal} numberOfLines={2}>{primaryGoal}</Text>
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
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    goalKey: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.35)",
    },
    goalVal: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: GREEN,
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
