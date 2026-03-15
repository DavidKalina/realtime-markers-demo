import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { INTENTION_OPTIONS } from "@/constants/adventureOptions";

interface VibesStepProps {
  selected: string[];
  onToggle: (value: string) => void;
}

export const VibesStep: React.FC<VibesStepProps> = ({
  selected,
  onToggle,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleToggle = useCallback(
    (value: string) => {
      // Enforce max 2 selections
      if (!selected.includes(value) && selected.length >= 2) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(value);
    },
    [onToggle, selected],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's your vibe?</Text>
      <Text style={styles.subtitle}>
        Pick 1-2 intentions for your adventures.
      </Text>

      <View style={styles.chipGrid}>
        {INTENTION_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleToggle(option.value)}
            >
              <Text style={styles.chipEmoji}>{option.emoji}</Text>
              <Text
                style={[
                  styles.chipLabel,
                  isSelected && styles.chipLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.counter}>
        {selected.length}/2 max
      </Text>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing["3xl"],
      paddingTop: spacing["3xl"],
    },
    title: {
      fontSize: fontSize["3xl"],
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: lineHeight.relaxed,
      marginBottom: spacing["3xl"],
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.md,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.elevated,
    },
    chipSelected: {
      borderColor: colors.accent.primary,
      backgroundColor: colors.accent.muted,
    },
    chipEmoji: {
      fontSize: fontSize.xl,
    },
    chipLabel: {
      fontSize: fontSize.md,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    chipLabelSelected: {
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },
    counter: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      textAlign: "center",
      marginTop: spacing.xl,
    },
  });
