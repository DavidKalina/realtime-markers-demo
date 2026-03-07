import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import {
  useColors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
  type Colors,
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const barWidth = useSharedValue(currentPercent);
  const gainOpacity = useSharedValue(0);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (hasGain) {
      if (!hasAnimatedRef.current) {
        // First gain: jump to previous position, then animate to current
        hasAnimatedRef.current = true;
        barWidth.value = withSequence(
          withTiming(previousPercent, { duration: 0 }),
          withDelay(
            600,
            withTiming(currentPercent, {
              duration: 800,
              easing: Easing.out(Easing.cubic),
            }),
          ),
        );
        gainOpacity.value = 0;
        gainOpacity.value = withDelay(1400, withTiming(1, { duration: 300 }));
      } else {
        // Subsequent gain (live XP): animate from current position to new target
        barWidth.value = withTiming(currentPercent, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        });
      }
    } else {
      hasAnimatedRef.current = false;
      barWidth.value = currentPercent;
      gainOpacity.value = 0;
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

const createStyles = (colors: Colors) => StyleSheet.create({
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
