import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ShadowSVG, MarkerSVG, MARKER_WIDTH, MARKER_HEIGHT, SHADOW_OFFSET } from "./MarkerSVGs";
import { COLORS } from "../Layout/ScreenLayout";

interface ClusterMarkerProps {
  count: number;
  coordinates: [number, number];
  onPress: () => void;
  isSelected?: boolean;
  isHighlighted?: boolean;
  index?: number; // For staggered animations
}

// Color schemes with teardrop design
const COLOR_SCHEMES = {
  small: {
    fill: COLORS.background,
    stroke: COLORS.textPrimary,
    text: COLORS.textPrimary,
  },
  medium: {
    fill: COLORS.background,
    stroke: COLORS.textPrimary,
    text: COLORS.textPrimary,
  },
  large: {
    fill: COLORS.background,
    stroke: COLORS.accent, // Use accent color for large clusters
    text: COLORS.textPrimary,
  },
};

// Calculate marker size based on count
const calculateMarkerSize = (count: number) => {
  if (count < 5) return 1; // Keep small clusters at 1x scale

  const baseSize = 1;
  const maxSize = 5.0; // Increased to 5x
  const growthRate = 0.2; // Increased growth rate for more dramatic scaling

  // Logarithmic scaling to prevent too large sizes
  const scale = Math.min(baseSize + Math.log10(count) * growthRate, maxSize);
  return scale;
};

// Animation configurations
const ANIMATIONS = {
  SCALE_PRESS: {
    duration: 100,
  },
  SCALE_RELEASE: {
    stiffness: 200,
    damping: 12,
  },
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
};

// Helper to create animation cleanup
const createAnimationCleanup = (animations: Animated.SharedValue<number>[]) => {
  return () => {
    animations.forEach((anim) => cancelAnimation(anim));
  };
};

export const ClusterMarker: React.FC<ClusterMarkerProps> = React.memo(
  ({ count, onPress, isSelected = false, isHighlighted = false, index = 0 }) => {
    // Component state
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);
    const animationTimersRef = useRef<Array<NodeJS.Timeout>>([]);
    const animationIntervalsRef = useRef<Array<NodeJS.Timeout>>([]);

    // Calculate base scale based on count
    const baseScale = useMemo(() => calculateMarkerSize(count), [count]);

    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const fanRotation = useSharedValue(0);
    const fanScale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const burstScale = useSharedValue(1);

    // Memoize color scheme based on count
    const colorScheme = useMemo(() => {
      if (count < 5) return COLOR_SCHEMES.small;
      if (count < 15) return COLOR_SCHEMES.medium;
      return COLOR_SCHEMES.large;
    }, [count]);

    // Memoize formatted count
    const formattedCount = useMemo(() => (count > 99 ? "99+" : count.toString()), [count]);

    // Use shared SVG components
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={colorScheme.fill}
          stroke={colorScheme.stroke}
          strokeWidth={count > 5 ? "4" : "3"}
          highlightStrokeWidth={count > 5 ? "3" : "2.5"}
          circleRadius={count > 5 ? "14" : "12"}
          circleStroke={count > 15 ? COLORS.accent : COLORS.buttonBorder}
          circleStrokeWidth={count > 15 ? "2" : "1"}
        />
      ),
      [colorScheme, count]
    );

    // Cleanup function for all animations and timers
    const cleanupAnimations = useCallback(() => {
      // Cancel all animations
      createAnimationCleanup([
        scale,
        shadowOpacity,
        rippleScale,
        rippleOpacity,
        fanRotation,
        fanScale,
        pulseScale,
        burstScale,
      ])();

      // Clear all timers
      animationTimersRef.current.forEach((timer) => clearTimeout(timer));
      animationTimersRef.current = [];

      // Clear all intervals
      animationIntervalsRef.current.forEach((interval) => clearInterval(interval));
      animationIntervalsRef.current = [];
    }, []);

    // Set up initial animations on mount
    useEffect(() => {
      // Show shadow immediately
      shadowOpacity.value = withTiming(0.3, ANIMATIONS.SHADOW);

      // Show ripple effect
      rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
      rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

      return cleanupAnimations;
    }, [cleanupAnimations]);

    // Handle selection state changes
    useEffect(() => {
      if (isSelected !== prevSelectedRef.current) {
        prevSelectedRef.current = isSelected;

        if (isSelected) {
          scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
        } else {
          scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
        }
      }
    }, [isSelected]);

    // Handle press with haptic feedback
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(
          isSelected ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE)
      );

      onPress();
    }, [isSelected, onPress]);

    // Add fanning animation effect
    useEffect(() => {
      // Fan out and in sequence
      fanRotation.value = withSequence(
        withTiming(0.2, ANIMATIONS.FAN_OUT),
        withTiming(-0.2, ANIMATIONS.FAN_OUT),
        withTiming(0, ANIMATIONS.FAN_IN)
      );

      fanScale.value = withSequence(
        withTiming(1.1, ANIMATIONS.FAN_OUT),
        withTiming(1.1, { duration: 200 }),
        withTiming(1, ANIMATIONS.FAN_IN)
      );

      // Repeat the fanning animation every 4 seconds
      const fanTimer = setInterval(() => {
        fanRotation.value = withSequence(
          withTiming(0.2, ANIMATIONS.FAN_OUT),
          withTiming(-0.2, ANIMATIONS.FAN_OUT),
          withTiming(0, ANIMATIONS.FAN_IN)
        );

        fanScale.value = withSequence(
          withTiming(1.1, ANIMATIONS.FAN_OUT),
          withTiming(1.1, { duration: 200 }),
          withTiming(1, ANIMATIONS.FAN_IN)
        );
      }, 4000);
      animationIntervalsRef.current.push(fanTimer);

      return () => {
        clearInterval(fanTimer);
      };
    }, []);

    // Add pulsing animation for larger clusters
    useEffect(() => {
      if (count > 15) {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 300 }),
            withTiming(0.95, { duration: 300 }),
            withTiming(1.1, { duration: 200 }),
            withTiming(1, { duration: 200 })
          ),
          -1,
          true
        );
      } else if (count > 5) {
        pulseScale.value = withRepeat(
          withSequence(withTiming(1.08, { duration: 1000 }), withTiming(1, { duration: 1000 })),
          -1,
          true
        );
      }

      return () => {
        cancelAnimation(pulseScale);
      };
    }, [count]);

    // Add a secondary "burst" effect for very large clusters
    useEffect(() => {
      if (count > 15) {
        burstScale.value = withRepeat(
          withSequence(withTiming(1.2, { duration: 400 }), withTiming(1, { duration: 400 })),
          -1,
          true
        );
      }

      return () => {
        cancelAnimation(burstScale);
      };
    }, [count]);

    // Animated styles
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value * fanScale.value * baseScale * pulseScale.value * burstScale.value },
        { rotate: `${fanRotation.value}rad` },
      ],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
      opacity: shadowOpacity.value,
      transform: [{ translateX: SHADOW_OFFSET.x }, { translateY: SHADOW_OFFSET.y }],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
    }));

    return (
      <View style={styles.container}>
        {/* Marker Shadow */}
        <Animated.View style={[styles.shadowContainer, shadowStyle]}>{ShadowSvg}</Animated.View>

        {/* Marker */}
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
          <Animated.View style={[styles.markerContainer, markerStyle]}>
            {MarkerSvg}

            {/* Cluster Count Text */}
            <View style={styles.countContainer}>
              <Text style={[styles.countText, { fontSize: count > 99 ? 14 : count > 9 ? 16 : 18 }]}>
                {formattedCount}
              </Text>
            </View>

            {/* Impact ripple effect */}
            <Animated.View style={[styles.rippleEffect, rippleStyle]} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders
    return (
      prevProps.count === nextProps.count &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.coordinates[0] === nextProps.coordinates[0] &&
      prevProps.coordinates[1] === nextProps.coordinates[1]
    );
  }
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
  countContainer: {
    position: "absolute",
    top: 12,
    width: MARKER_WIDTH,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "SpaceMono",
    textAlign: "center",
    lineHeight: 24,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.2)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 1,
      },
      android: {
        textShadowColor: "rgba(0,0,0,0.2)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
    }),
  },
  clusterText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
  },
  rippleEffect: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "white",
    opacity: 0.7,
    bottom: 12,
  },
});
