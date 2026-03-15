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

const PACE_CARDS = [
  {
    value: "chill",
    emoji: "🧘",
    title: "Chill",
    description: "Slow mornings, cozy spots, no rush.",
  },
  {
    value: "balanced",
    emoji: "⚖️",
    title: "Balanced",
    description: "A mix of chill and go — room to breathe between stops.",
  },
  {
    value: "send_it",
    emoji: "🚀",
    title: "Send It",
    description: "Pack the day. Maximum stops, maximum adventure.",
  },
];

interface PaceStepProps {
  selected: string;
  onSelect: (value: string) => void;
}

export const PaceStep: React.FC<PaceStepProps> = ({ selected, onSelect }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSelect = useCallback(
    (value: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelect(value);
    },
    [onSelect],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set your pace</Text>
      <Text style={styles.subtitle}>
        How packed do you like your adventures?
      </Text>

      <View style={styles.cardList}>
        {PACE_CARDS.map((card) => {
          const isSelected = selected === card.value;
          return (
            <Pressable
              key={card.value}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(card.value)}
            >
              <Text style={styles.cardEmoji}>{card.emoji}</Text>
              <View style={styles.cardTextContainer}>
                <Text
                  style={[
                    styles.cardTitle,
                    isSelected && styles.cardTitleSelected,
                  ]}
                >
                  {card.title}
                </Text>
                <Text style={styles.cardDescription}>{card.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
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
    cardList: {
      gap: spacing.md,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      padding: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.elevated,
    },
    cardSelected: {
      borderColor: colors.accent.primary,
      backgroundColor: colors.accent.muted,
    },
    cardEmoji: {
      fontSize: 32,
    },
    cardTextContainer: {
      flex: 1,
    },
    cardTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    cardTitleSelected: {
      color: colors.accent.primary,
    },
    cardDescription: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: lineHeight.relaxed,
    },
  });
