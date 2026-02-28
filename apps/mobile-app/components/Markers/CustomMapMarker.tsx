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
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { colors, fontSize, lineHeight, spacing, spring } from "@/theme";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "./MarkerSVGs";

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
};

interface EmojiMapMarkerProps {
  event: Marker;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
  index?: number;
}

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress }) => {
    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const pulseScale = useSharedValue(1);

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
        cancelAnimation(pulseScale);
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

    // Press handler with haptic
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE),
      );

      onPress();
    }, [isSelected, onPress]);

    // Composite animated style — scale + breathing pulse
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: scale.value * pulseScale.value,
        },
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
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.data.emoji === nextProps.event.data.emoji &&
      prevProps.event.data.title === nextProps.event.data.title
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
});
