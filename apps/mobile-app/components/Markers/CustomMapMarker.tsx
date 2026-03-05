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
  type SharedValue,
} from "react-native-reanimated";
import { colors, fontSize, lineHeight, spacing, spring } from "@/theme";
import { getCategoryColorScheme } from "@/utils/categoryColors";
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
};

// Static shadow style — shadow opacity was animating 0.3→0.3 (no-op)
const staticShadowStyle = {
  opacity: 0.3,
  transform: [
    { translateX: SHADOW_OFFSET.x },
    { translateY: SHADOW_OFFSET.y },
  ],
};

interface EmojiMapMarkerProps {
  event: Marker;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
  index?: number;
  breathingScale?: SharedValue<number>;
}

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress, breathingScale }) => {
    // Per-instance animation values
    const scale = useSharedValue(1);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);

    // Mount ripple — fire once
    useEffect(() => {
      rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
      rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

      return () => {
        cancelAnimation(scale);
        cancelAnimation(rippleScale);
        cancelAnimation(rippleOpacity);
      };
    }, []);

    // Handle external deselection (e.g. tapping map background)
    useEffect(() => {
      if (isSelected) {
        scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
      } else {
        scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
      }
    }, [isSelected]);

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
    }, [isSelected, onPress, scale]);

    // Composite animated style — scale + shared breathing pulse (from parent)
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: scale.value * (breathingScale?.value ?? 1),
        },
      ],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
      borderColor: colors.fixed.white,
    }));

    // Memoized SVGs
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const primaryCategory = event.data.categories?.[0];
    const MarkerSvg = useMemo(() => {
      // Private markers keep accent styling (higher priority)
      if (event.data.isPrivate) {
        return (
          <MarkerSVG
            fill={colors.accent.primary}
            stroke={colors.accent.dark}
            strokeWidth="3"
            highlightStrokeWidth="2.5"
            circleRadius="12"
            circleStroke={colors.accent.dark}
            circleStrokeWidth="1"
          />
        );
      }
      const scheme = getCategoryColorScheme(primaryCategory);
      return (
        <MarkerSVG
          fill={scheme.fill}
          stroke={scheme.stroke}
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke={scheme.circleStroke}
          circleStrokeWidth="1"
        />
      );
    }, [event.data.isPrivate, primaryCategory]);

    return (
      <View style={styles.container}>
        {/* Shadow — static */}
        <View style={[styles.shadowContainer, staticShadowStyle]}>
          {ShadowSvg}
        </View>

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
      prevProps.event.data.title === nextProps.event.data.title &&
      prevProps.event.data.categories?.[0] ===
        nextProps.event.data.categories?.[0]
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
