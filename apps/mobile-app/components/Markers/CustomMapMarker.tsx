import { Marker } from "@/types/types";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  spacing,
  spring,
} from "@/theme";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "./MarkerSVGs";
import { TimePopup } from "./TimePopup";

// Animation configurations
const ANIMATIONS = {
  SCALE_PRESS: {
    duration: 100,
  },
  SCALE_RELEASE: spring.bouncy,
  RIPPLE: {
    duration: 800,
  },
  SHADOW: {
    duration: 300,
  },
  FAN_OUT: {
    duration: 800,
    easing: Easing.out(Easing.back(1.2)),
  },
  FAN_IN: {
    duration: 600,
    easing: Easing.in(Easing.back(1.2)),
  },
  PULSE: {
    duration: 1000,
    easing: Easing.inOut(Easing.sin),
  },
  BURST: {
    duration: 400,
    easing: Easing.inOut(Easing.sin),
  },
};

interface EmojiMapMarkerProps {
  event: Marker;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
  index?: number;
}

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress, index = 0 }) => {
    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const fanRotation = useSharedValue(0);
    const fanScale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const burstScale = useSharedValue(1);

    // Calculate stagger delay based on marker index
    const initialDelay = useMemo(() => index * 200, [index]);

    // Initial mount animations
    useEffect(() => {
      // Shadow fade-in
      shadowOpacity.value = withTiming(0.3, ANIMATIONS.SHADOW);

      // Ripple expanding outward
      rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
      rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

      return () => {
        cancelAnimation(scale);
        cancelAnimation(shadowOpacity);
        cancelAnimation(rippleScale);
        cancelAnimation(rippleOpacity);
        cancelAnimation(fanRotation);
        cancelAnimation(fanScale);
        cancelAnimation(pulseScale);
        cancelAnimation(burstScale);
      };
    }, []);

    // Selection state spring
    useEffect(() => {
      if (isSelected) {
        scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
      } else {
        scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
      }
    }, [isSelected]);

    // Fan-out/in animation — gentle wobble on a repeating cycle (UI thread only)
    useEffect(() => {
      fanRotation.value = withDelay(
        initialDelay,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 4000 }), // pause
            withTiming(0.15, ANIMATIONS.FAN_OUT),
            withTiming(-0.15, ANIMATIONS.FAN_OUT),
            withTiming(0, ANIMATIONS.FAN_IN),
          ),
          -1,
          false,
        ),
      );

      fanScale.value = withDelay(
        initialDelay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 4000 }), // pause
            withTiming(1.05, ANIMATIONS.FAN_OUT),
            withTiming(1.05, { duration: 200 }),
            withTiming(1, ANIMATIONS.FAN_IN),
          ),
          -1,
          false,
        ),
      );

      return () => {
        cancelAnimation(fanRotation);
        cancelAnimation(fanScale);
      };
    }, [initialDelay]);

    // Gentle breathing pulse
    useEffect(() => {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1500 }),
          withTiming(0.98, { duration: 1500 }),
        ),
        -1,
        true,
      );

      return () => {
        cancelAnimation(pulseScale);
      };
    }, []);

    // Occasional burst pop (UI thread only)
    useEffect(() => {
      burstScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 8000 }), // pause
          withTiming(1.1, ANIMATIONS.BURST),
          withTiming(1, ANIMATIONS.BURST),
        ),
        -1,
        false,
      );

      return () => {
        cancelAnimation(burstScale);
      };
    }, []);

    // Press handler with haptic + burst
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE),
      );

      burstScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );

      onPress();
    }, [isSelected, onPress]);

    // Composite animated style — all scale/rotation factors multiplied
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale:
            scale.value * fanScale.value * pulseScale.value * burstScale.value,
        },
        { rotate: `${fanRotation.value}rad` },
      ],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
      opacity: shadowOpacity.value,
      transform: [
        { translateX: SHADOW_OFFSET.x },
        { translateY: SHADOW_OFFSET.y },
      ],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
      borderColor: colors.fixed.white,
    }));

    // Memoized SVGs
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={
            event.data.isPrivate ? colors.accent.primary : colors.bg.primary
          }
          stroke={
            event.data.isPrivate ? colors.accent.dark : colors.fixed.white
          }
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke={
            event.data.isPrivate
              ? colors.accent.dark
              : colors.brand.markerStroke
          }
          circleStrokeWidth="1"
        />
      ),
      [event.data.isPrivate],
    );

    return (
      <View style={styles.container}>
        {/* Time popup — only when selected */}
        {isSelected && (
          <Animated.View style={[styles.popupContainer]}>
            <TimePopup
              time={event.data.eventDate || ""}
              endDate={event.data.endDate || ""}
              title={event.data.title || ""}
              index={index}
            />
          </Animated.View>
        )}

        {/* Shadow */}
        <Animated.View style={[styles.shadowContainer, shadowStyle]}>
          {ShadowSvg}
        </Animated.View>

        {/* Marker */}
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          style={styles.touchableArea}
        >
          <Animated.View style={[styles.markerContainer, markerStyle]}>
            {MarkerSvg}

            {/* Emoji */}
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{event.data.emoji}</Text>
            </View>

            {/* Impact ripple */}
            <Animated.View style={[styles.rippleEffect, rippleStyle]} />
          </Animated.View>
        </TouchableOpacity>

        {/* Social proof badge — only when selected */}
        {isSelected && (event.data.goingCount as number) >= 3 && (
          <View style={styles.socialProofBadge}>
            <Text style={styles.socialProofText}>
              {event.data.goingCount as number} going
            </Text>
          </View>
        )}

        {/* Trending badge — only when selected (and social proof not shown) */}
        {isSelected &&
          event.data.isTrending &&
          !((event.data.goingCount as number) >= 3) && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingBadgeText}>Trending</Text>
            </View>
          )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.data.emoji === nextProps.event.data.emoji &&
      prevProps.event.data.title === nextProps.event.data.title &&
      prevProps.event.data.goingCount === nextProps.event.data.goingCount &&
      prevProps.event.data.isTrending === nextProps.event.data.isTrending
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  touchableArea: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    zIndex: -1,
  },
  emojiContainer: {
    position: "absolute",
    top: spacing._10,
    width: MARKER_WIDTH,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.tight,
    textAlign: "center",
    padding: 2,
  },
  rippleEffect: {
    position: "absolute",
    width: spacing._10,
    height: spacing._10,
    borderRadius: 5,
    backgroundColor: colors.fixed.transparent,
    borderWidth: 2,
    opacity: 0.7,
    bottom: spacing.md,
  },
  popupContainer: {
    position: "absolute",
    width: "100%",
    zIndex: 1,
  },
  socialProofBadge: {
    position: "absolute",
    bottom: -12,
    alignSelf: "center",
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing._10,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  socialProofText: {
    color: colors.status.success.text,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
  trendingBadge: {
    position: "absolute",
    bottom: -12,
    alignSelf: "center",
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing._10,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  trendingBadgeText: {
    color: colors.accent.primary,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
});
