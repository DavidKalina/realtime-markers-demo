import React, { useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
import {
  eventBroker,
  EventTypes,
  type XPAwardedEvent,
  type LevelUpdateEvent,
} from "@/services/EventBroker";
import { useXPGainAnimation } from "@/components/StatusBar/useXPGainAnimation";
import { getTierByName } from "@/utils/gamification";
import { useState } from "react";

const XPNotificationOverlay: React.FC = () => {
  const { xpGainOpacity, xpGainTranslateY, xpGainAmount, showXPGain } =
    useXPGainAnimation();

  const [levelUpInfo, setLevelUpInfo] = useState<{
    tierName: string;
    emoji: string;
  } | null>(null);

  const {
    xpGainOpacity: levelUpOpacity,
    xpGainTranslateY: levelUpTranslateY,
    showXPGain: showLevelUp,
  } = useXPGainAnimation({
    onAnimationComplete: () => setLevelUpInfo(null),
  });

  const handleXPAwarded = useCallback(
    (event: XPAwardedEvent) => {
      if (event.data?.amount) {
        showXPGain(event.data.amount);
      }
    },
    [showXPGain],
  );

  const handleLevelUpdate = useCallback(
    (event: LevelUpdateEvent) => {
      if (event.data?.action === "level_up" && event.data?.title) {
        const tier = getTierByName(event.data.title);
        setLevelUpInfo({ tierName: tier.name, emoji: tier.emoji });
        showLevelUp(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [showLevelUp],
  );

  useEffect(() => {
    const unsubXP = eventBroker.on<XPAwardedEvent>(
      EventTypes.XP_AWARDED,
      handleXPAwarded,
    );
    const unsubLevel = eventBroker.on<LevelUpdateEvent>(
      EventTypes.LEVEL_UPDATE,
      handleLevelUpdate,
    );

    return () => {
      unsubXP();
      unsubLevel();
    };
  }, [handleXPAwarded, handleLevelUpdate]);

  const xpAnimatedStyle = useAnimatedStyle(() => ({
    opacity: xpGainOpacity.value,
    transform: [{ translateY: xpGainTranslateY.value }],
  }));

  const levelUpAnimatedStyle = useAnimatedStyle(() => ({
    opacity: levelUpOpacity.value,
    transform: [{ translateY: levelUpTranslateY.value }],
  }));

  return (
    <>
      {/* XP Toast */}
      <Animated.View
        style={[styles.xpToast, xpAnimatedStyle]}
        pointerEvents="none"
      >
        <Animated.Text style={styles.xpToastText}>
          +{xpGainAmount} XP
        </Animated.Text>
      </Animated.View>

      {/* Level Up Toast */}
      {levelUpInfo && (
        <Animated.View
          style={[styles.levelUpToast, levelUpAnimatedStyle]}
          pointerEvents="none"
        >
          <Animated.Text style={styles.levelUpEmoji}>
            {levelUpInfo.emoji}
          </Animated.Text>
          <Animated.Text style={styles.levelUpText}>
            You&apos;re now a {levelUpInfo.tierName}!
          </Animated.Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  xpToast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    zIndex: 9999,
  },
  xpToastText: {
    color: colors.accent.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  levelUpToast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: colors.bg.card,
    borderColor: colors.accent.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    zIndex: 9999,
  },
  levelUpEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  levelUpText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
});

export default XPNotificationOverlay;
