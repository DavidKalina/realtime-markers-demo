import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useRouter } from "expo-router";
import { useLocationStore } from "@/stores/useLocationStore";
import { getTimeLeftLabel } from "@/utils/timeUtils";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  shadows,
  spacing,
} from "@/theme";

interface MarkerInfoHUDProps {
  safeAreaBottom: number;
}
const MARQUEE_SPEED = 30; // px per second
const MARQUEE_GAP = 48; // px gap between the two copies

export const MarkerInfoHUD: React.FC<MarkerInfoHUDProps> = React.memo(
  ({ safeAreaBottom }) => {
    const router = useRouter();
    const selectedItem = useLocationStore((s) => s.selectedItem);

    const [timeLabel, setTimeLabel] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const [titleWidth, setTitleWidth] = useState(0);

    const isMarker = selectedItem?.type === "marker";
    const data = isMarker ? selectedItem.data : null;

    // Countdown timer — recalculate on mount + every 60s
    useEffect(() => {
      if (!data?.eventDate) return;

      const update = () => {
        const result = getTimeLeftLabel(data.eventDate!, data.endDate);
        setTimeLabel(result.label);
        setIsExpired(result.isExpired);
      };

      update();
      const interval = setInterval(update, 60_000);
      return () => clearInterval(interval);
    }, [data?.eventDate, data?.endDate]);

    // Continuous ticker marquee — two copies scroll left; when the first copy
    // is fully off-screen the second copy is exactly where the first started,
    // so a simple repeat creates a seamless loop.
    const translateX = useSharedValue(0);
    const clipWidth = useRef(0);

    const needsMarquee =
      titleWidth > 0 && clipWidth.current > 0 && titleWidth > clipWidth.current;

    // Full cycle distance = one copy width + gap
    const cycleWidth = titleWidth + MARQUEE_GAP;

    useEffect(() => {
      translateX.value = 0;
      if (!needsMarquee) return;

      const cycleDurationMs = (cycleWidth / MARQUEE_SPEED) * 1000;

      translateX.value = withRepeat(
        withTiming(-cycleWidth, {
          duration: cycleDurationMs,
          easing: Easing.linear,
        }),
        -1,
        false,
      );

      return () => cancelAnimation(translateX);
    }, [needsMarquee, cycleWidth]);

    const marqueeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    // Press bounce animation
    const pressScale = useSharedValue(1);
    const selectedId = selectedItem?.id;

    const navigate = useCallback(() => {
      if (selectedId) {
        router.push(`/details?eventId=${selectedId}`);
      }
    }, [router, selectedId]);

    const handlePress = useCallback(() => {
      pressScale.value = withSequence(
        withTiming(0.96, { duration: 80 }),
        withTiming(1, { duration: 100 }, () => {
          scheduleOnRN(navigate);
        }),
      );
    }, [navigate]);

    const cardAnimStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pressScale.value }],
    }));

    if (!isMarker || !data) return null;

    const goingCount = data.goingCount as number | undefined;
    const showGoingBadge = typeof goingCount === "number" && goingCount >= 3;
    const showTrending = !showGoingBadge && data.isTrending;

    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.wrapper, { bottom: safeAreaBottom + spacing.xs }]}
        key={selectedItem.id}
      >
        {/* Off-screen measurement text */}
        <Text
          style={styles.measureText}
          onLayout={(e) => setTitleWidth(Math.ceil(e.nativeEvent.layout.width))}
        >
          {data.title}
        </Text>

        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.card, cardAnimStyle]}>
            {/* Row: Emoji + Title + Chevron */}
            <View style={styles.headerRow}>
              <Text style={styles.emoji}>{data.emoji}</Text>
              <View
                style={styles.titleClip}
                onLayout={(e) => {
                  clipWidth.current = e.nativeEvent.layout.width;
                }}
              >
                {needsMarquee ? (
                  <Animated.View style={[styles.tickerRow, marqueeStyle]}>
                    <Text style={[styles.title, { width: titleWidth }]}>
                      {data.title}
                    </Text>
                    <Text
                      style={[
                        styles.title,
                        { width: titleWidth, marginLeft: MARQUEE_GAP },
                      ]}
                    >
                      {data.title}
                    </Text>
                  </Animated.View>
                ) : (
                  <Text style={styles.title} numberOfLines={1}>
                    {data.title}
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>

            {/* Bottom row: countdown + badges */}
            <View style={styles.metaRow}>
              {timeLabel !== "" && (
                <Text
                  style={[
                    styles.countdown,
                    isExpired && styles.countdownExpired,
                  ]}
                >
                  {isExpired ? "expired" : timeLabel}
                </Text>
              )}
              {showGoingBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{goingCount} going</Text>
                </View>
              )}
              {showTrending && (
                <View style={[styles.badge, styles.trendingBadge]}>
                  <Text style={[styles.badgeText, styles.trendingText]}>
                    Trending
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emoji: {
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight.heading,
  },
  chevron: {
    color: colors.text.secondary,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.relaxed,
    marginLeft: spacing.xs,
  },
  titleClip: {
    flex: 1,
    overflow: "hidden",
  },
  tickerRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    width: 9999,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
  },
  measureText: {
    position: "absolute",
    opacity: 0,
    top: -9999,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
  countdown: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
  },
  countdownExpired: {
    color: colors.status.warning.text,
  },
  badge: {
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  badgeText: {
    color: colors.status.success.text,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
  trendingBadge: {
    borderColor: colors.accent.border,
  },
  trendingText: {
    color: colors.accent.primary,
  },
});
