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
import React, { useEffect, useRef, useMemo } from "react";
import {
  Animated,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoveryIndicator from "../DiscoveryIndicator/DiscoveryIndicator";
import JobIndicator from "../JobIndicator/JobIndicator";

const StatusBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const totalXp = user?.totalXp || 0;
  const currentTier = user?.currentTier || "Explorer";
  const tierInfo = getTierByName(currentTier);
  const progressPercent = getXPProgressPercent(totalXp);
  const nextThreshold = getNextTierThreshold(totalXp);

  // Animated values for smooth XP bar transitions
  const barWidth = useRef(new Animated.Value(progressPercent)).current;
  const barGlow = useRef(new Animated.Value(0)).current;
  const prevTierRef = useRef(currentTier);

  // Animate XP bar width when progress changes
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: progressPercent,
      duration: 600,
      useNativeDriver: false,
    }).start();

    // Brief glow pulse on XP gain
    Animated.sequence([
      Animated.timing(barGlow, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(barGlow, {
        toValue: 0,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start();
  }, [progressPercent]);

  // Flash tier label on rank-up
  useEffect(() => {
    if (prevTierRef.current !== currentTier) {
      prevTierRef.current = currentTier;
      // Stronger glow on tier change
      Animated.sequence([
        Animated.timing(barGlow, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(barGlow, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [currentTier]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingTop: insets.top,
      },
    ],
    [insets.top],
  );

  const displayName = user?.firstName || user?.email || "";

  const animatedBarStyle = {
    ...styles.xpBarFill,
    width: barWidth.interpolate({
      inputRange: [0, 100],
      outputRange: ["0%", "100%"],
    }),
    backgroundColor: barGlow.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.accent.primary, "#f59e0b"],
    }),
  };

  return (
    <View style={containerStyle}>
      <RNStatusBar
        barStyle="light-content"
        backgroundColor={colors.bg.primary}
        translucent
      />

      <View style={styles.bannerContent}>
        {user && <Text style={styles.userName}>{displayName}</Text>}
        <JobIndicator />
      </View>

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
            <Animated.View style={animatedBarStyle} />
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
    paddingVertical: spacing.md,
    minHeight: spacing["5xl"],
  },
  userName: {
    color: colors.fixed.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.2,
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
