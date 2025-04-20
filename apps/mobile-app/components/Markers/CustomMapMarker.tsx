import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MARKER_HEIGHT, MARKER_WIDTH, MarkerSVG, SHADOW_OFFSET, ShadowSVG } from "./MarkerSVGs";
import { TimePopup } from "./TimePopup";
import { Marker } from "@/hooks/useMapWebsocket";

// Animation configurations
const ANIMATIONS = {
  DROP_IN: {
    stiffness: 300,
    damping: 15,
    mass: 1,
  },
  BOUNCE: {
    duration: 600,
    easing: Easing.inOut(Easing.sin),
  },
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
  ({ event, isSelected, isHighlighted = false, onPress, index = 0 }) => {
    // State for random color selection

    const [isDropComplete, setIsDropComplete] = useState(false);
    const animationTimersRef = useRef<Array<NodeJS.Timeout>>([]);

    // Animation values
    const dropY = useSharedValue(-300);
    const scale = useSharedValue(0.5);
    const rotation = useSharedValue(-0.1);
    const shadowOpacity = useSharedValue(0);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const bounceY = useSharedValue(0);

    // Cleanup function for all animations and timers
    const cleanupAnimations = useCallback(() => {
      // Cancel all animations
      createAnimationCleanup([
        dropY,
        scale,
        rotation,
        shadowOpacity,
        rippleScale,
        rippleOpacity,
        bounceY,
      ])();

      // Clear all timers
      animationTimersRef.current.forEach((timer) => clearTimeout(timer));
      animationTimersRef.current = [];
    }, []);

    // Set up drop-in animation on mount
    useEffect(() => {
      // Delay based on index for staggered entrance
      const startDelay = index * 200;

      // Drop animation sequence
      dropY.value = withDelay(startDelay, withSpring(0, ANIMATIONS.DROP_IN));

      // Scale and rotation
      scale.value = withDelay(startDelay, withSpring(1, ANIMATIONS.DROP_IN));

      rotation.value = withDelay(startDelay, withSpring(0, ANIMATIONS.DROP_IN));

      // After drop is complete
      const dropCompleteTimer = setTimeout(() => {
        setIsDropComplete(true);

        // Show shadow
        shadowOpacity.value = withTiming(0.3, ANIMATIONS.SHADOW);

        // Show ripple effect
        rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
        rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

        // Periodic gentle bounce
        const bounceTimer = setTimeout(() => {
          startPeriodicBounce();
        }, 300);
        animationTimersRef.current.push(bounceTimer);
      }, startDelay + 1200);
      animationTimersRef.current.push(dropCompleteTimer);

      return cleanupAnimations;
    }, [index, cleanupAnimations]);

    // Start periodic bounce animation
    const startPeriodicBounce = useCallback(() => {
      bounceY.value = withSequence(
        withTiming(-5, ANIMATIONS.BOUNCE),
        withTiming(0, ANIMATIONS.BOUNCE)
      );

      // Set up periodic repeating
      const timer = setTimeout(() => {
        startPeriodicBounce();
      }, 6000);
      animationTimersRef.current.push(timer);
    }, []);

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
        withSpring(isSelected ? 1 : 1.15, ANIMATIONS.SCALE_RELEASE)
      );

      onPress();
    }, [isSelected, onPress]);

    // Animated styles
    const markerStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: dropY.value + bounceY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
    }));

    const shadowStyle = useAnimatedStyle(() => ({
      opacity: shadowOpacity.value,
      transform: [{ translateX: SHADOW_OFFSET.x }, { translateY: SHADOW_OFFSET.y }],
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
          fill="#1a1a1a"
          stroke="white"
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke="#E2E8F0"
          circleStrokeWidth="1"
        />
      ),
      []
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
        <Animated.View style={[styles.shadowContainer, shadowStyle]}>{ShadowSvg}</Animated.View>

        {/* Marker */}
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
          <Animated.View style={[styles.markerContainer, markerStyle]}>
            {MarkerSvg}

            {/* Emoji */}
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{event.data.emoji}</Text>
            </View>

            {/* Impact ripple effect that appears after drop */}
            {isDropComplete && <Animated.View style={[styles.rippleEffect, rippleStyle]} />}
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
