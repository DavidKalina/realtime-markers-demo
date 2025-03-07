import * as Haptics from "expo-haptics";
import { MessageCircleQuestion as QuestionMark, Star } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
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

export const MysteryEmojiMarker: React.FC<MysteryEmojiMarkerProps> = ({
  event,
  isSelected,
  isHighlighted = false,
  onPress,
}) => {
  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const revealProgress = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const floatY = useSharedValue(0);

  const isFirstRender = useRef(true);
  const [isRevealed, setIsRevealed] = useState(false);

  // Colors for styling
  const baseColor = "#333333";
  const accentColor = "rgba(77, 171, 247, 0.6)";
  const textColor = "#FFFFFF";

  // Handle initial animations
  useEffect(() => {
    if (isFirstRender.current) {
      scale.value = 0.5;
      scale.value = withTiming(1, { duration: 400 });
      isFirstRender.current = false;
    }

    // Start subtle floating animation
    floatY.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
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

  // Start pulse animation for selected state
  useEffect(() => {
    if (isSelected) {
      // Pulsating ring wave
      pulseScale.value = 1;
      pulseOpacity.value = 0.7;

      pulseScale.value = withRepeat(
        withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1, // Infinite repeats
        false // Don't reverse
      );

      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.in(Easing.ease) }),
        -1, // Infinite repeats
        false // Don't reverse
      );
    } else {
      pulseOpacity.value = withTiming(0, { duration: 300 });
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
    // KEY FIX: Only cancel ongoing animations if the state actually changes
    if (isSelected !== isRevealed) {
      if (isSelected) {
        // Scale up slightly when selected
        scale.value = withTiming(1.2, { duration: 300 });

        // Reveal the contents
        revealProgress.value = withTiming(1, { duration: 400 });

        setIsRevealed(true);
      } else {
        // Scale back down
        scale.value = withTiming(1, { duration: 300 });

        // Hide contents
        revealProgress.value = withTiming(0, { duration: 300 });

        setIsRevealed(false);
      }
    }

    // Highlight effect - this should run regardless of revealed state
    if (isHighlighted) {
      scale.value = withSequence(
        withTiming(1.1, { duration: 150 }),
        withTiming(isSelected ? 1.2 : 1, { duration: 150 })
      );
    }

    // No need to cancel animations in the cleanup function for this effect
    // as we only want to cancel when unmounting or when state actually changes
  }, [isSelected, isHighlighted, isRevealed]);

  // Handle press with haptic feedback
  const handlePress = () => {
    Haptics.impactAsync(
      isRevealed ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );

    // Cancel any ongoing scale animations before starting new ones
    cancelAnimation(scale);

    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(isSelected ? 1.2 : 1, { duration: 200 })
    );

    onPress();
  };

  // Container animation style
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { translateY: floatY.value }],
    };
  });

  // Content reveal animation
  const contentStyle = useAnimatedStyle(() => {
    return {
      opacity: revealProgress.value,
      transform: [{ scale: interpolate(revealProgress.value, [0, 1], [0.7, 1]) }],
    };
  });

  // Question mark fade out animation
  const questionMarkStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - revealProgress.value,
      transform: [{ scale: interpolate(revealProgress.value, [0, 1], [1, 0.7]) }],
    };
  });

  // Pulse effect animation
  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    };
  });

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

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
      {/* Pulsating ring */}
      {isSelected && (
        <Animated.View
          style={[
            styles.pulseRing,
            pulseStyle,
            {
              borderColor: accentColor,
              backgroundColor: "rgba(77, 171, 247, 0.1)",
            },
          ]}
        />
      )}

      {/* Main container */}
      <Animated.View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.mysteryBox,
            {
              backgroundColor: baseColor,
              borderColor: accentColor,
            },
          ]}
        >
          {/* Question mark (hidden when revealed) */}
          <Animated.View style={[styles.questionMarkContainer, questionMarkStyle]}>
            <QuestionMark size={12} color={textColor} />
          </Animated.View>

          {/* Event emoji (shown when revealed) */}
          <Animated.View style={[styles.contentContainer, contentStyle]}>
            <Text style={styles.emojiText}>{event.emoji}</Text>
          </Animated.View>

          {/* Verified badge if applicable */}
          {event.isVerified && (
            <View style={styles.verifiedBadge}>
              <Star size={7} color={textColor} fill={textColor} />
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

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
  emojiText: {
    fontSize: 14,
    textShadowColor: "rgba(77, 171, 247, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
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
