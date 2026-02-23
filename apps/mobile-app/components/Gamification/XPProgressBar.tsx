import React from "react";
import { View, Text, StyleSheet } from "react-native";
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
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ totalXp }) => {
  const nextThreshold = getNextTierThreshold(totalXp);
  const progressPercent = getXPProgressPercent(totalXp);
  const currentTierInfo = getTierForXP(totalXp);
  const isMaxTier = nextThreshold === null;

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
        <View style={[styles.barFill, { width: `${progressPercent}%` }]} />
      </View>
      {!isMaxTier && nextThreshold && (
        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdText}>{currentTierInfo.minXp}</Text>
          <Text style={styles.thresholdText}>{nextThreshold}</Text>
        </View>
      )}
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
  thresholdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  thresholdText: {
    fontSize: 10,
    color: colors.text.disabled,
    fontFamily: fontFamily.mono,
  },
});

export default XPProgressBar;
