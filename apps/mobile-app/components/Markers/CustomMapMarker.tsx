import { Marker } from "@/hooks/useMapWebsocket";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
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
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";
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
  index?: number; // For staggered animations
}

// Helper to create animation cleanup
const createAnimationCleanup = (animations: Animated.SharedValue<number>[]) => {
  return () => {
    animations.forEach((anim) => cancelAnimation(anim));
  };
};

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress, index = 0 }) => {
    const animationTimersRef = useRef<Array<NodeJS.Timeout>>([]);
    const animationIntervalsRef = useRef<Array<NodeJS.Timeout>>([]);

    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const fanRotation = useSharedValue(0);
    const fanScale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const burstScale = useSharedValue(1);

    // Calculate random offsets based on marker index
    const initialDelay = useMemo(() => index * 200, [index]);

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
      animationIntervalsRef.current.forEach((interval) =>
        clearInterval(interval),
      );
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
      if (isSelected) {
        scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
      } else {
        scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
      }
    }, [isSelected]);

    // Add fanning animation effect
    useEffect(() => {
      // Initial fan animation with delay based on index
      const startFanAnimation = () => {
        fanRotation.value = withSequence(
          withTiming(0.15, ANIMATIONS.FAN_OUT), // Slightly smaller rotation than clusters
          withTiming(-0.15, ANIMATIONS.FAN_OUT),
          withTiming(0, ANIMATIONS.FAN_IN),
        );

        fanScale.value = withSequence(
          withTiming(1.05, ANIMATIONS.FAN_OUT), // Smaller scale than clusters
          withTiming(1.05, { duration: 200 }),
          withTiming(1, ANIMATIONS.FAN_IN),
        );
      };

      // Start with initial delay
      const initialTimer = setTimeout(startFanAnimation, initialDelay);
      animationTimersRef.current.push(initialTimer);

      // Repeat the fanning animation every 4-6 seconds (randomized)
      const fanInterval = setInterval(
        () => {
          const randomDelay = Math.random() * 2000; // 0-2s random delay
          setTimeout(startFanAnimation, randomDelay);
        },
        4000 + Math.random() * 2000,
      ); // 4-6s interval

      animationIntervalsRef.current.push(fanInterval);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(fanInterval);
      };
    }, [initialDelay]);

    // Add gentle pulsing animation
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

    // Add occasional burst effect
    useEffect(() => {
      const triggerBurst = () => {
        burstScale.value = withSequence(
          withTiming(1.1, ANIMATIONS.BURST),
          withTiming(1, ANIMATIONS.BURST),
        );
      };

      // Trigger burst every 8-12 seconds
      const burstInterval = setInterval(
        () => {
          const randomDelay = Math.random() * 2000; // 0-2s random delay
          setTimeout(triggerBurst, randomDelay);
        },
        8000 + Math.random() * 4000,
      ); // 8-12s interval

      animationIntervalsRef.current.push(burstInterval);

      return () => {
        clearInterval(burstInterval);
      };
    }, []);

    // Handle press with haptic feedback
    const handlePress = useCallback(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE),
      );

      // Trigger a burst effect on press
      burstScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );

      onPress();
    }, [isSelected, onPress]);

    // Update marker style to include all animations
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
      borderColor: "#fff", // Use consistent dark gray
    }));

    // Remove the old SVG components and use the shared ones
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={event.data.isPrivate ? COLORS.accent : "#1a1a1a"}
          stroke={event.data.isPrivate ? COLORS.accentDark : "white"}
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke={event.data.isPrivate ? COLORS.accentDark : "#E2E8F0"}
          circleStrokeWidth="1"
        />
      ),
      [event.data.isPrivate],
    );

    return (
      <View style={styles.container}>
        {/* Popup */}
        <Animated.View style={[styles.popupContainer]}>
          <TimePopup
            time={event.data.eventDate || ""}
            endDate={event.data.endDate || ""}
            title={event.data.title || ""}
          />
        </Animated.View>

        {/* Marker Shadow */}
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
    top: 10,
    width: MARKER_WIDTH,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    padding: 2,
  },
  rippleEffect: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
    borderWidth: 2,
    opacity: 0.7,
    bottom: 12,
  },
  popupContainer: {
    position: "absolute",
    width: "100%",
    zIndex: 1,
  },
});
