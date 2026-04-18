import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface AIFocusCardProps {
  summary: string | null | undefined;
  completedQuests: number;
}

function AIFocusCard({ summary, completedQuests }: AIFocusCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isCalibrating = !summary || completedQuests < 1;

  return (
    <View style={s.container}>
      <Text style={s.label}>What I'm noticing</Text>
      <Text style={s.summary}>
        {isCalibrating
          ? "I'm still learning your patterns. Complete a few reps and I'll share what seems to help."
          : summary}
      </Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: spacing._6,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.medium,
      color: colors.text.disabled,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
    },
    summary: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 22,
      fontStyle: "italic" as const,
    },
  });

export default React.memo(AIFocusCard);
