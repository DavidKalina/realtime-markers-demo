import * as Haptics from "expo-haptics";
import { MessageCircleQuestion as QuestionMark, Star } from "lucide-react-native";
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

// Pre-defined animation configurations
const SCALE_PRESS = { duration: 100 };
const SCALE_RELEASE = { duration: 200 };
const REVEAL_CONFIG = { duration: 400 };
const HIDE_CONFIG = { duration: 300 };
const SCALE_UP_CONFIG = { duration: 300 };
const HIGHLIGHT_CONFIG = { duration: 150 };
const FLOAT_CONFIG = { duration: 1500, easing: Easing.inOut(Easing.sin) };
const PULSE_CONFIG = { duration: 1500, easing: Easing.out(Easing.ease) };
const FADE_CONFIG = { duration: 300 };

// Styled components to reduce re-renders and improve readability
const PulseRing = React.memo(({ style }: { style: any }) => <Animated.View style={style} />);

const QuestionMarkView = React.memo(({ style, textColor }: { style: any; textColor: string }) => (
  <Animated.View style={style}>
    <QuestionMark size={12} color={textColor} />
  </Animated.View>
));

const EmojiContent = React.memo(
  ({ style, emoji, emojiTextStyle }: { style: any; emoji: string; emojiTextStyle: any }) => (
    <Animated.View style={style}>
      <Text style={emojiTextStyle}>{emoji}</Text>
    </Animated.View>
  )
);

const VerifiedBadge = React.memo(({ textColor }: { textColor: string }) => (
  <View style={styles.verifiedBadge}>
    <Star size={7} color={textColor} fill={textColor} />
  </View>
));

export const MysteryEmojiMarker: React.FC<MysteryEmojiMarkerProps> = React.memo(
  ({ event, isSelected, isHighlighted = false, onPress }, prevProps) => {
    // Animation values - using refs to store animation objects
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const revealProgress = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);
    const floatY = useSharedValue(0);

    const isFirstRender = useRef(true);
    const [isRevealed, setIsRevealed] = useState(false);
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Colors for styling - memoized
    const styles = useMarkerStyles();

    // Handle initial animations - only run once
    useEffect(() => {
      if (isFirstRender.current) {
        scale.value = 0.5;
        scale.value = withTiming(1, { duration: 400 });
        isFirstRender.current = false;
      }

      // Start subtle floating animation
      floatY.value = withRepeat(
        withSequence(withTiming(2, FLOAT_CONFIG), withTiming(-2, FLOAT_CONFIG)),
        -1, // Infinite repeats
        true // Reverse
      );

      // Return cleanup function
      return () => {
        // Cancel all animations when component unmounts
        cancelAnimation(scale);
        cancelAnimation(rotation);
        cancelAnimation(floatY);
      };
    }, []);

    // Start pulse animation for selected state - only run when selection state changes
    useEffect(() => {
      if (isSelected !== prevSelectedRef.current) {
        prevSelectedRef.current = isSelected;

        if (isSelected) {
          // Pulsating ring wave
          pulseScale.value = 1;
          pulseOpacity.value = 0.7;

          pulseScale.value = withRepeat(
            withTiming(1.8, PULSE_CONFIG),
            -1, // Infinite repeats
            false // Don't reverse
          );

          pulseOpacity.value = withRepeat(
            withTiming(0, PULSE_CONFIG),
            -1, // Infinite repeats
            false // Don't reverse
          );

          // FIX: Also ensure the emoji is revealed when selected
          revealProgress.value = withTiming(1, REVEAL_CONFIG);
          setIsRevealed(true);
        } else {
          pulseOpacity.value = withTiming(0, FADE_CONFIG);

          // FIX: Hide emoji when deselected
          revealProgress.value = withTiming(0, HIDE_CONFIG);
          setIsRevealed(false);
        }
      }

      // Return cleanup function
      return () => {
        // Cancel pulse animations when effect dependencies change or component unmounts
        cancelAnimation(pulseScale);
        cancelAnimation(pulseOpacity);
      };
    }, [isSelected]);

    // Handle selection/highlight changes
    useEffect(() => {
      // Only run when selection or highlight states change
      const selectionChanged = isSelected !== prevSelectedRef.current;
      const highlightChanged = isHighlighted !== prevHighlightedRef.current;

      if (!selectionChanged && !highlightChanged) return;

      // Update refs
      prevSelectedRef.current = isSelected;
      prevHighlightedRef.current = isHighlighted;

      // KEY FIX: Only cancel ongoing animations if the state actually changes
      if (isSelected !== isRevealed) {
        if (isSelected) {
          // Scale up slightly when selected
          scale.value = withTiming(1.2, SCALE_UP_CONFIG);

          // Reveal the contents
          revealProgress.value = withTiming(1, REVEAL_CONFIG);

          setIsRevealed(true);
        } else {
          // Scale back down
          scale.value = withTiming(1, SCALE_UP_CONFIG);

          // Hide contents
          revealProgress.value = withTiming(0, HIDE_CONFIG);

          setIsRevealed(false);
        }
      }

      // Highlight effect - this should run regardless of revealed state
      if (isHighlighted) {
        scale.value = withSequence(
          withTiming(1.1, HIGHLIGHT_CONFIG),
          withTiming(isSelected ? 1.2 : 1, HIGHLIGHT_CONFIG)
        );
      }
    }, [isSelected, isHighlighted]);

    // Handle press with haptic feedback - memoized
    const handlePress = useCallback(() => {
      Haptics.impactAsync(
        isRevealed ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );

      // Cancel any ongoing scale animations before starting new ones
      cancelAnimation(scale);

      // FIX: Directly animate reveal on press for immediate feedback, before isSelected prop changes
      if (!isRevealed) {
        revealProgress.value = withTiming(1, REVEAL_CONFIG);
        setIsRevealed(true);
      }

      scale.value = withSequence(
        withTiming(0.9, SCALE_PRESS),
        withTiming(isSelected ? 1.2 : 1, SCALE_RELEASE)
      );

      // Call the parent's onPress handler
      onPress();
    }, [isRevealed, isSelected, onPress, scale, revealProgress]);

    // Memoize animation styles
    const containerStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }, { translateY: floatY.value }],
      };
    });

    const contentStyle = useAnimatedStyle(() => {
      return {
        opacity: revealProgress.value,
        transform: [{ scale: interpolate(revealProgress.value, [0, 1], [0.7, 1]) }],
      };
    });

    const questionMarkStyle = useAnimatedStyle(() => {
      return {
        opacity: 1 - revealProgress.value,
        transform: [{ scale: interpolate(revealProgress.value, [0, 1], [1, 0.7]) }],
      };
    });

    const pulseStyle = useAnimatedStyle(() => {
      return {
        opacity: pulseOpacity.value,
        transform: [{ scale: pulseScale.value }],
      };
    });

    // Colors for styling
    const baseColor = "#333333";
    const accentColor = "rgba(77, 171, 247, 0.6)";
    const textColor = "#FFFFFF";

    // Create an effect for global cleanup on unmount
    useEffect(() => {
      // Return a cleanup function that will run when the component unmounts
      return () => {
        // Cancel all animations to prevent memory leaks
        cancelAnimation(scale);
        cancelAnimation(rotation);
        cancelAnimation(revealProgress);
        cancelAnimation(pulseScale);
        cancelAnimation(pulseOpacity);
        cancelAnimation(floatY);
      };
    }, []);

    // Memoize styles to prevent recreations on every render
    const emojiTextStyle = useMemo(
      () => ({
        fontSize: 14,
        textShadowColor: "rgba(77, 171, 247, 0.6)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
      }),
      []
    );

    // Complete pulse ring style with animations and colors
    const fullPulseRingStyle = useMemo(
      () => [
        styles.pulseRing,
        pulseStyle,
        {
          borderColor: accentColor,
          backgroundColor: "rgba(77, 171, 247, 0.1)",
        },
      ],
      [pulseStyle]
    );

    // Complete mystery box style
    const mysteryBoxStyle = useMemo(
      () => [
        styles.mysteryBox,
        {
          backgroundColor: baseColor,
          borderColor: accentColor,
        },
      ],
      []
    );

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
        {/* Pulsating ring - Only render when selected */}
        {isSelected && <PulseRing style={fullPulseRingStyle} />}

        {/* Main container */}
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={mysteryBoxStyle}>
            {/* Question mark (hidden when revealed) */}
            <QuestionMarkView
              style={[styles.questionMarkContainer, questionMarkStyle]}
              textColor={textColor}
            />

            {/* Event emoji (shown when revealed) */}
            <EmojiContent
              style={[styles.contentContainer, contentStyle]}
              emoji={event.emoji}
              emojiTextStyle={emojiTextStyle}
            />

            {/* Verified badge if applicable */}
            {event.isVerified && <VerifiedBadge textColor={textColor} />}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.emoji === nextProps.event.emoji &&
      prevProps.event.isVerified === nextProps.event.isVerified
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
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  mysteryBox: {
    width: 28,
    height: 28,
    backgroundColor: "#333333",
    borderWidth: 1,
    borderColor: "rgba(77, 171, 247, 0.6)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(77, 171, 247, 0.6)",
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
    backgroundColor: "#333333",
    borderRadius: 5,
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(77, 171, 247, 0.6)",
  },
  pulseRing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
});

// Extract styles to a hook for better organization and performance
const useMarkerStyles = () => {
  return styles;
};
