import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN_ACCENT = "#86efac";

type Milestone = "early_momentum" | "midpoint" | "approaching" | "final_stretch" | "target_reached";

interface GoalCheckInCardProps {
  milestone: Milestone;
  goalTitle?: string;
  percentElapsed?: number;
  remainingDays?: number;
  onPress: () => void;
}

const MILESTONE_CONFIG: Record<Milestone, { emoji: string; label: string; accent: string }> = {
  early_momentum: {
    emoji: "\uD83C\uDF31",
    label: "Early check-in",
    accent: "rgba(134, 239, 172, 0.15)",
  },
  midpoint: {
    emoji: "\uD83C\uDFAF",
    label: "Halfway reflection",
    accent: "rgba(250, 204, 21, 0.12)",
  },
  approaching: {
    emoji: "\u26A1",
    label: "Goal approaching",
    accent: "rgba(251, 146, 60, 0.12)",
  },
  final_stretch: {
    emoji: "\uD83C\uDFC1",
    label: "Final stretch",
    accent: "rgba(251, 146, 60, 0.15)",
  },
  target_reached: {
    emoji: "\u2B50",
    label: "Target reached",
    accent: "rgba(134, 239, 172, 0.18)",
  },
};

export function GoalCheckInCard({
  milestone,
  goalTitle,
  percentElapsed,
  remainingDays,
  onPress,
}: GoalCheckInCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const config = MILESTONE_CONFIG[milestone];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400).springify().damping(20).stiffness(300)}>
      <Pressable style={[s.card, { backgroundColor: config.accent }]} onPress={handlePress}>
        <View style={s.topRow}>
          <Text style={s.emoji}>{config.emoji}</Text>
          <View style={s.labelWrap}>
            <Text style={s.label}>{config.label}</Text>
            <Text style={s.sublabel}>Tap to reflect on your progress</Text>
          </View>
        </View>

        {goalTitle && (
          <Text style={s.goalText} numberOfLines={2}>
            {"\u201C"}{goalTitle}{"\u201D"}
          </Text>
        )}

        <View style={s.statsRow}>
          {percentElapsed != null && (
            <>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.min(100, percentElapsed)}%` }]} />
              </View>
              <Text style={s.progressText}>{percentElapsed}%</Text>
            </>
          )}
          {remainingDays != null && remainingDays > 0 && (
            <Text style={s.daysText}>{remainingDays}d left</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.2)",
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    emoji: {
      fontSize: 28,
    },
    labelWrap: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontWeight: fontWeight.bold,
      color: GREEN_ACCENT,
      letterSpacing: 0.3,
    },
    sublabel: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      letterSpacing: 0.3,
      opacity: 0.7,
    },
    goalText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      lineHeight: 18,
      fontStyle: "italic",
      opacity: 0.8,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 1.5,
      backgroundColor: GREEN_ACCENT,
      opacity: 0.6,
    },
    progressText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: GREEN_ACCENT,
      fontWeight: fontWeight.bold,
      opacity: 0.7,
      minWidth: 28,
      textAlign: "right",
    },
    daysText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      opacity: 0.6,
    },
  });
