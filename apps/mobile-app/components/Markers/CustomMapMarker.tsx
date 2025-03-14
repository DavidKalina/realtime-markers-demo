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
  SCALE_RELEASE: { duration: 200 },
  REVEAL_CONFIG: { duration: 400 },
  HIDE_CONFIG: { duration: 300 },
  SCALE_UP_CONFIG: { duration: 300 },
  HIGHLIGHT_CONFIG: { duration: 150 },
  PULSE_CONFIG: { duration: 1500, easing: Easing.out(Easing.ease) },
  FADE_CONFIG: { duration: 300 },
  INITIAL_MOUNT: { duration: 400 },
};

// Constant colors
const COLORS = {
  BASE: "#333333",
  ACCENT: "rgba(77, 171, 247, 0.6)",
  ACCENT_BG: "rgba(77, 171, 247, 0.1)",
  TEXT: "#FFFFFF",
};

// Create styles once and reuse them
const styles = StyleSheet.create({
  touchableArea: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mysteryBox: {
    width: 22,
    height: 22,
    backgroundColor: COLORS.BASE,
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  questionMarkContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  verifiedBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: COLORS.BASE,
    borderRadius: 5,
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.ACCENT,
  },
  pulseRing: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_BG,
  },
  emojiText: {
    fontSize: 12,
    textShadowColor: COLORS.ACCENT,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});

// Styled components to reduce re-renders and improve readability
const PulseRing = React.memo(({ style }: { style: any }) => <Animated.View style={style} />);

// Question mark component removed

const EmojiContent = React.memo(({ emoji }: { emoji: string }) => (
  <Text style={styles.emojiText}>{emoji}</Text>
));

const VerifiedBadge = React.memo(() => (
  <View style={styles.verifiedBadge}>
    <Star size={7} color={COLORS.TEXT} fill={COLORS.TEXT} />
  </View>
));

// Create a factory for animation cleanup
const createAnimationCleanup = (animations: Animated.SharedValue<number>[]) => {
  return () => {
    animations.forEach((anim) => cancelAnimation(anim));
  };
};

export const MysteryEmojiMarker: React.FC<MysteryEmojiMarkerProps> = React.memo(
  ({ event, isSelected, isHighlighted = false, onPress }) => {
    // Animation values
    const scale = useSharedValue(1);
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);

    // Collected animations for cleanup
    const animations = useMemo(() => [scale, pulseScale, pulseOpacity], []);

    // Component state
    const isFirstRender = useRef(true);
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Initial mount animations - simplified
    useEffect(() => {
      if (isFirstRender.current) {
        scale.value = 0.5;
        scale.value = withTiming(1, ANIMATIONS.INITIAL_MOUNT);
        isFirstRender.current = false;
      }

      // No floating animation for non-selected markers

      return createAnimationCleanup([scale]);
    }, []); // Empty deps array - only run on mount

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

          // Scale down
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

      // Scale animation for press feedback (simpler feedback for non-selected)
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
      transform: [{ scale: scale.value }],
      // No translateY animation for non-selected markers
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
          <View style={styles.mysteryBox}>
            {/* Event emoji always visible now */}
            <View style={styles.contentContainer}>
              <EmojiContent emoji={event.emoji} />
            </View>

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
