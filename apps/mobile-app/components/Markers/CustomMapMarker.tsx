import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Star, MessageCircleQuestion as QuestionMark } from "lucide-react-native";

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

interface MysteryBoxMarkerProps {
  event: EventType;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
}

export const MysteryBoxMarker: React.FC<MysteryBoxMarkerProps> = ({
  event,
  isSelected,
  isHighlighted = false,
  onPress,
}) => {
  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const revealProgress = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);
  const isFirstRender = useRef(true);
  const [isRevealed, setIsRevealed] = useState(false);

  // Colors based on your monospace/#333 aesthetic
  const baseColor = "#333333"; // Main color
  const accentColor = "#444444"; // Slightly lighter for accents
  const highlightColor = "#555555"; // For highlights
  const textColor = "#CCCCCC"; // Light gray for text/symbols

  // Handle initial animations
  useEffect(() => {
    if (isFirstRender.current) {
      // Initial mystery box scale in
      scale.value = 0.2;

      // Animate the box in
      scale.value = withTiming(1, {
        duration: 500,
        easing: Easing.elastic(1.1),
      });

      // Reset the flag
      isFirstRender.current = false;
    }
  }, []);

  // Start pulse animation only when selected
  useEffect(() => {
    if (isSelected) {
      startPulseAnimation();
    } else {
      // Reset pulse opacity when not selected
      pulseOpacity.value = 0;
    }
  }, [isSelected]);

  // Start a subtle pulse animation that repeats
  const startPulseAnimation = () => {
    if (!isSelected) return;

    pulseOpacity.value = 0;
    pulseOpacity.value = withSequence(
      withTiming(0.8, { duration: 1200 }),
      withTiming(0, { duration: 1200 })
    );

    // Repeat the pulse animation only if still selected
    setTimeout(() => {
      if (isSelected) {
        startPulseAnimation();
      }
    }, 2500);
  };

  // Handle selection/highlight changes
  useEffect(() => {
    if (isSelected && !isRevealed) {
      // Scale up when selected
      scale.value = withTiming(1.4, {
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

      // Reveal the contents with animation
      revealProgress.value = withTiming(1, {
        duration: 800,
        easing: Easing.bezier(0.16, 1, 0.3, 1), // Custom bezier for a nice reveal
      });

      setIsRevealed(true);

      // Celebration rotation
      rotation.value = withSequence(
        withTiming(Math.PI * 2, {
          duration: 800,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        withTiming(0, { duration: 200 })
      );
    } else if (!isSelected && isRevealed) {
      // Scale back down when deselected
      scale.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.quad),
      });

      // Conceal the contents again
      revealProgress.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.quad),
      });

      setIsRevealed(false);
    }

    // Highlight animation
    if (isHighlighted) {
      // Make box pulse
      scale.value = withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(0.95, { duration: 150 }),
        withSpring(1, {
          damping: 8,
          stiffness: 100,
        })
      );

      // Small shake
      rotation.value = withSequence(
        withTiming(0.1, { duration: 80 }),
        withTiming(-0.1, { duration: 80 }),
        withTiming(0.08, { duration: 80 }),
        withTiming(-0.08, { duration: 80 }),
        withTiming(0, { duration: 80 })
      );
    }
  }, [isSelected, isHighlighted]);

  // Handle press with haptic feedback
  const handlePress = () => {
    // Medium haptic for standard press
    if (!isRevealed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Scale animation on press
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withSpring(isSelected ? 1.4 : 1, {
        damping: 12,
        stiffness: 150,
      })
    );

    onPress();
  };

  // Box container animation
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { rotate: `${rotation.value}rad` }],
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

  // Pulse effect around the box
  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [{ scale: interpolate(pulseOpacity.value, [0, 0.8], [1, 1.3]) }],
    };
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
      {/* Pulse effect (only when selected) */}
      {isSelected && (
        <Animated.View style={[styles.pulseEffect, pulseStyle, { borderColor: baseColor }]} />
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
            <QuestionMark size={14} color={textColor} />
          </Animated.View>

          {/* Event content (shown when revealed) */}
          <Animated.View style={[styles.contentContainer, contentStyle]}>
            <Text style={styles.emojiText}>{event.emoji}</Text>
          </Animated.View>

          {/* Verified badge - only if event is verified */}
          {event.isVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: highlightColor }]}>
              <Star size={8} color={textColor} fill={textColor} />
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableArea: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mysteryBox: {
    width: 32,
    height: 32,
    backgroundColor: "#333333",
    borderWidth: 2,
    borderColor: "#444444",
    borderRadius: 16, // Changed to make it circular
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
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
    fontSize: 16,
    fontFamily: "monospace",
    // Enhanced text shadow for better visibility against dark background
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verifiedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#555555",
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#666666",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pulseEffect: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20, // Changed to make it circular
    borderWidth: 2,
    borderColor: "#333333",
  },
});
