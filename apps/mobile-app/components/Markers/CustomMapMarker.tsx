import * as Haptics from "expo-haptics";
import { Star } from "lucide-react-native";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Define EventType if not already imported
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

interface MysteryEmojiMarkerProps {
  event: EventType;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
}

// Pre-defined animation configurations - outside component to avoid recreation
const ANIMATIONS = {
  SCALE_PRESS: { duration: 100 },
  SCALE_RELEASE: { duration: 200, easing: Easing.out(Easing.back(1.2)) },
  SCALE_UP_CONFIG: { duration: 300, easing: Easing.out(Easing.back(1.2)) },
  HIGHLIGHT_CONFIG: { duration: 150 },
  PULSE_CONFIG: { duration: 1500, easing: Easing.out(Easing.ease) },
  FADE_CONFIG: { duration: 300 },
  INITIAL_MOUNT: { duration: 400, easing: Easing.out(Easing.back(1.5)) },
  FLOAT_CONFIG: { duration: 1500, easing: Easing.inOut(Easing.sin) },
};

// Constant colors updated to match our design language
const COLORS = {
  BASE: "#3a3a3a",
  INNER: "#333333",
  BORDER: "rgba(147, 197, 253, 0.7)",
  ACCENT: "rgba(147, 197, 253, 0.8)",
  ACCENT_BG: "rgba(147, 197, 253, 0.15)",
  TEXT: "#FFFFFF",
  VERIFIED: "#FFD700",
};

// Create animation cleanup factory function
const createAnimationCleanup = (animations: Animated.SharedValue<number>[]) => {
  return () => {
    animations.forEach((anim) => cancelAnimation(anim));
  };
};

// Styled components to reduce re-renders and improve readability
const PulseRing = React.memo(({ style }: { style: any }) => <Animated.View style={style} />);

const EmojiContent = React.memo(({ emoji }: { emoji: string }) => (
  <Text style={styles.emojiText}>{emoji}</Text>
));

const VerifiedBadge = React.memo(() => (
  <View style={styles.verifiedBadge}>
    <Star size={7} color={COLORS.VERIFIED} fill={COLORS.VERIFIED} />
  </View>
));

export const MysteryEmojiMarker: React.FC<MysteryEmojiMarkerProps> = React.memo(
  ({ event, isSelected, isHighlighted = false, onPress }) => {
    // Animation values
    const scale = useSharedValue(1);
    const floatY = useSharedValue(0);
    const rotation = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);

    // Collected animations for cleanup
    const animations = useMemo(() => [scale, floatY, rotation, pulseScale, pulseOpacity], []);

    // Component state
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Add subtle float animation
    useEffect(() => {
      if (isSelected) {
        floatY.value = withRepeat(
          withSequence(
            withTiming(1, ANIMATIONS.FLOAT_CONFIG),
            withTiming(-1, ANIMATIONS.FLOAT_CONFIG)
          ),
          -1, // Infinite repeats
          true // Reverse
        );

        // Add subtle rotation
        rotation.value = withRepeat(
          withSequence(
            withTiming(0.02, { ...ANIMATIONS.FLOAT_CONFIG, duration: 2000 }),
            withTiming(-0.02, { ...ANIMATIONS.FLOAT_CONFIG, duration: 2000 })
          ),
          -1, // Infinite repeats
          true // Reverse
        );
      } else {
        // Reset animations when not selected
        floatY.value = 0;
        rotation.value = 0;
      }

      return createAnimationCleanup([floatY, rotation]);
    }, [isSelected]); // Now depends on isSelected

    // Handle selection state changes
    useEffect(() => {
      if (isSelected !== prevSelectedRef.current) {
        prevSelectedRef.current = isSelected;

        if (isSelected) {
          // Start pulse animation
          pulseScale.value = 1;
          pulseOpacity.value = 0.7;

          pulseScale.value = withRepeat(
            withTiming(1.8, ANIMATIONS.PULSE_CONFIG),
            -1, // Infinite repeats
            false // Don't reverse
          );

          pulseOpacity.value = withRepeat(
            withTiming(0, ANIMATIONS.PULSE_CONFIG),
            -1, // Infinite repeats
            false // Don't reverse
          );

          // Scale up
          scale.value = withTiming(1.2, ANIMATIONS.SCALE_UP_CONFIG);
        } else {
          // Stop pulse animation
          pulseOpacity.value = withTiming(0, ANIMATIONS.FADE_CONFIG);

          // Scale down and reset other animations
          scale.value = withTiming(1, ANIMATIONS.SCALE_UP_CONFIG);
        }
      }

      // Return cleanup for selection changes
      return createAnimationCleanup([pulseScale, pulseOpacity]);
    }, [isSelected]); // Only depend on isSelected

    // Handle highlight state changes - but only when selected
    useEffect(() => {
      if (isSelected && isHighlighted !== prevHighlightedRef.current) {
        prevHighlightedRef.current = isHighlighted;

        // Highlight effect - only when selected and state changes
        if (isHighlighted) {
          scale.value = withSequence(
            withTiming(1.1, ANIMATIONS.HIGHLIGHT_CONFIG),
            withTiming(1.2, ANIMATIONS.HIGHLIGHT_CONFIG)
          );
        }
      }

      // No cleanup needed for highlight effect as it's self-contained
    }, [isHighlighted, isSelected]);

    // Handle press with haptic feedback - memoized
    const handlePress = useCallback(() => {
      // Only trigger haptics on real devices
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Silently handle haptic errors
        });
      }

      // Cancel any ongoing scale animations before starting new ones
      cancelAnimation(scale);

      // Scale animation for press feedback
      scale.value = withSequence(
        withTiming(0.9, ANIMATIONS.SCALE_PRESS),
        withTiming(isSelected ? 1.2 : 1, ANIMATIONS.SCALE_RELEASE)
      );

      // Call the parent's onPress handler
      onPress();
    }, [isSelected, onPress, scale]);

    // Global cleanup on unmount
    useEffect(() => {
      return createAnimationCleanup(animations);
    }, [animations]);

    // Animation styles - memoized with useAnimatedStyle
    const containerStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateY: floatY.value },
        { rotate: `${rotation.value}rad` },
      ],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    }));

    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.touchableArea}
        accessibilityRole="button"
        accessibilityLabel={`${event.title} marker`}
        accessibilityState={{ selected: isSelected }}
      >
        {/* Pulsating ring - Only render when selected */}
        {isSelected && <PulseRing style={[styles.pulseRing, pulseStyle]} />}

        {/* Main container */}
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={styles.outerCircle}>
            <EmojiContent emoji={event.emoji} />

            {/* Verified badge if applicable */}
            {event.isVerified && <VerifiedBadge />}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  },
  // Enhanced comparison function
  (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.emoji === nextProps.event.emoji &&
      prevProps.event.isVerified === nextProps.event.isVerified &&
      // Also check onPress identity if we're being extra careful
      prevProps.onPress === nextProps.onPress
    );
  }
);

// Create styles once and reuse them
const styles = StyleSheet.create({
  touchableArea: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerCircle: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.BASE,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACCENT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  innerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.BASE,
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.VERIFIED,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.VERIFIED,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pulseRing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_BG,
  },
  emojiText: {
    fontSize: 13,
    color: COLORS.TEXT,
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.5)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.7,
        shadowRadius: 1,
      },
    }),
  },
});
