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
  LABEL_SHOW: {
    duration: 300,
  },
  LABEL_SPRING: {
    stiffness: 300,
    damping: 25,
  },
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
  index?: number; // For staggered animations
}

// Helper to create animation cleanup
const createAnimationCleanup = (animations: Animated.SharedValue<number>[]) => {
  return () => {
    animations.forEach((anim) => cancelAnimation(anim));
  };
};

export const EmojiMapMarker: React.FC<EmojiMapMarkerProps> = React.memo(
  ({ event, isSelected, onPress }) => {
    const animationTimersRef = useRef<Array<NodeJS.Timeout>>([]);

    // Animation values
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);

    // Cleanup function for all animations and timers
    const cleanupAnimations = useCallback(() => {
      // Cancel all animations
      createAnimationCleanup([
        scale,
        shadowOpacity,
        rippleScale,
        rippleOpacity,
      ])();

      // Clear all timers
      animationTimersRef.current.forEach((timer) => clearTimeout(timer));
      animationTimersRef.current = [];
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

    // Handle press with haptic feedback
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

    // Animated styles
    const markerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
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
