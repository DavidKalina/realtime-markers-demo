import { useAuth } from "@/contexts/AuthContext";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  radius,
} from "@/theme";
import {
  getTierByName,
  getXPProgressPercent,
  getNextTierThreshold,
} from "@/utils/gamification";
import React, { useMemo } from "react";
import { StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";

const StatusBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
      },
    ],
    [insets.top],
  );

  const totalXp = user?.totalXp || 0;
  const tierInfo = getTierByName(user?.currentTier || "Explorer");
  const progressPercent = getXPProgressPercent(totalXp);
  const nextThreshold = getNextTierThreshold(totalXp);

  return (
    <View style={containerStyle}>
      <RNStatusBar
        barStyle="light-content"
        backgroundColor={colors.bg.primary}
        translucent
      />

      <View style={styles.bannerContent} />

      {/* XP Progress Bar */}
      {user && (
        <View style={styles.xpContainer}>
          <View style={styles.xpRow}>
            <Text style={styles.xpTierLabel}>
              {tierInfo.emoji} {tierInfo.name}
            </Text>
            <Text style={styles.xpValueLabel}>
              {totalXp.toLocaleString()} XP
              {nextThreshold !== null && (
                <Text style={styles.xpNextLabel}>
                  {" "}
                  / {nextThreshold.toLocaleString()}
                </Text>
              )}
            </Text>
          </View>
          <View style={styles.xpBarBg}>
            <View
              style={[styles.xpBarFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </View>
      )}

      <View style={styles.engagementContainer}>
        <DiscoveryIndicator position="bottom-left" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    shadowColor: "rgba(0, 0, 0, 0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: spacing.sm,
    elevation: 4,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  xpContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  xpTierLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
  xpValueLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  xpNextLabel: {
    color: colors.text.disabled,
  },
  xpBarBg: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.accent.primary,
  },
  engagementContainer: {
    position: "absolute",
    left: 0,
    bottom: -20,
    zIndex: 999,
  },
});

export default React.memo(StatusBar);
