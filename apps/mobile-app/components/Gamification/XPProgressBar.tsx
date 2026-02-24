import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
import {
  getNextTierThreshold,
  getXPProgressPercent,
  getTierForXP,
} from "@/utils/gamification";

interface XPProgressBarProps {
  totalXp: number;
  currentTier: string;
  pendingXP?: number;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({
  totalXp,
  pendingXP = 0,
}) => {
  const hasGain = pendingXP > 0;

  // Calculate the "before" state (what the bar looked like last visit)
  const previousXP = hasGain ? totalXp - pendingXP : totalXp;
  const previousPercent = getXPProgressPercent(Math.max(0, previousXP));

  // Calculate the "after" state (current)
  const nextThreshold = getNextTierThreshold(totalXp);
  const currentPercent = getXPProgressPercent(totalXp);
  const currentTierInfo = getTierForXP(totalXp);
  const isMaxTier = nextThreshold === null;

  // Animated values
  const barWidth = useSharedValue(hasGain ? previousPercent : currentPercent);
  const gainOpacity = useSharedValue(0);

  useEffect(() => {
    if (hasGain) {
      // Animate bar from old width to new width after a short delay
      barWidth.value = withDelay(
        600,
        withTiming(currentPercent, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        }),
      );

      // Fade in the "+X XP" text after bar finishes
      gainOpacity.value = withDelay(
        1400,
        withTiming(1, { duration: 300 }),
      );
    }
  }, [hasGain, currentPercent, previousPercent]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  const gainTextStyle = useAnimatedStyle(() => ({
    opacity: gainOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.xpText}>{totalXp.toLocaleString()} XP</Text>
        {!isMaxTier && nextThreshold && (
          <Text style={styles.nextTierText}>
            {nextThreshold - totalXp} XP to next tier
          </Text>
        )}
        {isMaxTier && <Text style={styles.maxTierText}>Max tier reached</Text>}
      </View>
      <View style={styles.barBackground}>
        <Animated.View style={[styles.barFill, barAnimatedStyle]} />
      </View>
      <View style={styles.bottomRow}>
        {!isMaxTier && nextThreshold ? (
          <>
            <Text style={styles.thresholdText}>{currentTierInfo.minXp}</Text>
            {hasGain ? (
              <Animated.Text style={[styles.gainText, gainTextStyle]}>
                +{pendingXP} XP
              </Animated.Text>
            ) : null}
            <Text style={styles.thresholdText}>{nextThreshold}</Text>
          </>
        ) : hasGain ? (
          <Animated.Text style={[styles.gainText, gainTextStyle]}>
            +{pendingXP} XP
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  xpText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
  nextTierText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  maxTierText: {
    fontSize: fontSize.xs,
    color: colors.status.success.text,
    fontFamily: fontFamily.mono,
  },
  barBackground: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.accent.primary,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    minHeight: 16,
  },
  thresholdText: {
    fontSize: 10,
    color: colors.text.disabled,
    fontFamily: fontFamily.mono,
  },
  gainText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
});

export default XPProgressBar;
