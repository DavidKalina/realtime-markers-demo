import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  withRepeat,
  cancelAnimation,
  Easing,
  interpolateColor,
} from "react-native-reanimated";

// Define marker colors
const markerColors = [
  "#1a1a1a", // Updated to match status bar color
];

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

// Pre-define constants
const SHADOW_OFFSET = { x: 3, y: 3 };
const MARKER_WIDTH = 48;
const MARKER_HEIGHT = 64;

export interface EventType {
  title: string;
  emoji: string;
  location: string;
  distance: string;
  time: string;
  description: string;
  categories: string[];
  isVerified?: boolean;
  color?: string;
}

interface EmojiMapMarkerProps {
  event: EventType;
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
  ({
    event,
    isSelected,
    isHighlighted = false,
    onPress,
    index = 0,
  }) => {
    // State for random color selection
    const [markerColor] = useState(() => {
      return event.color || markerColors[Math.floor(Math.random() * markerColors.length)];
    });
    const [isDropComplete, setIsDropComplete] = useState(false);

    // Animation values
    const dropY = useSharedValue(-300);
    const scale = useSharedValue(0.5);
    const rotation = useSharedValue(-0.1); // Slight initial rotation
    const shadowOpacity = useSharedValue(0);
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0.8);
    const bounceY = useSharedValue(0);

    // Set up drop-in animation on mount
    useEffect(() => {
      // Delay based on index for staggered entrance
      const startDelay = index * 200;

      // Drop animation sequence
      dropY.value = withDelay(
        startDelay,
        withSpring(0, ANIMATIONS.DROP_IN)
      );

      // Scale and rotation
      scale.value = withDelay(
        startDelay,
        withSpring(1, ANIMATIONS.DROP_IN)
      );

      rotation.value = withDelay(
        startDelay,
        withSpring(0, ANIMATIONS.DROP_IN)
      );

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

        return () => clearTimeout(bounceTimer);
      }, startDelay + 1200);

      return () => {
        clearTimeout(dropCompleteTimer);
        createAnimationCleanup([dropY, scale, rotation, shadowOpacity, rippleScale, rippleOpacity])();
      };
    }, [index]);

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

      return () => clearTimeout(timer);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
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

    // SVG components - memoized for performance
    const ShadowSvg = useMemo(() => (
      <Svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
        <Path
          d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
          fill="black"
          fillOpacity="0.3"
        />
      </Svg>
    ), []);

    const MarkerSvg = useMemo(() => (
      <Svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 48 64">
        {/* Teardrop marker */}
        <Path
          d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
          fill="#1a1a1a"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Nintendo-style highlight */}
        <Path
          d="M16 12C16 12 19 9 24 9C29 9 32 12 32 12"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Emoji background circle */}
        <Circle
          cx="24"
          cy="22"
          r="12"
          fill="white"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
      </Svg>
    ), [markerColor]);

    return (
      <View style={styles.container}>
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
              <Text style={styles.emojiText}>{event.emoji}</Text>
            </View>

            {/* Impact ripple effect that appears after drop */}
            {isDropComplete && (
              <Animated.View style={[styles.rippleEffect, rippleStyle]} />
            )}
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
      prevProps.event.emoji === nextProps.event.emoji &&
      prevProps.event.title === nextProps.event.title
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
});