import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface WorldStatsProps {
  worldSizeSqMi: number | null;
  furthestMiles: number | null;
  uniqueVenues: number;
  categoriesExplored: number;
}

export function WorldStats({
  worldSizeSqMi,
  furthestMiles,
  uniqueVenues,
  categoriesExplored,
}: WorldStatsProps) {
  const colors = useColors();
  const s = styles(colors);

  const stats = [
    {
      emoji: "\uD83C\uDF0D",
      value: worldSizeSqMi != null && worldSizeSqMi > 0 ? worldSizeSqMi.toFixed(1) : "0",
      label: "sq mi explored",
    },
    {
      emoji: "\uD83E\uDDED",
      value: furthestMiles != null && furthestMiles > 0 ? furthestMiles.toFixed(1) : "0",
      label: "mi furthest out",
    },
    {
      emoji: "\uD83D\uDCCD",
      value: String(uniqueVenues),
      label: "unique venues",
    },
    {
      emoji: "\uD83C\uDFAF",
      value: String(categoriesExplored),
      label: "categories",
    },
  ];

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>YOUR WORLD</Text>
      <View style={s.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={s.cell}>
            <Text style={s.emoji}>{stat.emoji}</Text>
            <Text style={s.value}>{stat.value}</Text>
            <Text style={s.label}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    cell: {
      width: "48%",
      backgroundColor: colors.bg.card,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      gap: 4,
    },
    emoji: {
      fontSize: 24,
      marginBottom: 4,
    },
    value: {
      fontFamily: fontFamily.display,
      fontSize: 28,
      color: colors.text.primary,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
  });
