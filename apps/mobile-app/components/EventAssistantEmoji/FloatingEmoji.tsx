import React, { useEffect, useState, useRef, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./emoji";
import { getMessageEmoji } from "@/utils/messageUtils";

// Simple spring configuration
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 100,
  mass: 0.8,
  overshootClamping: false,
};

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  message: string;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({
  message,
  fallbackEmoji,
}) => {
  // Get marker selection state from location store
  const { selectedMarkerId } = useLocationStore();

  // Local state for position
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Get emoji based on message and marker
  const emoji = useMemo(
    () => getMessageEmoji(message, selectedMarkerId) || "",
    [message, selectedMarkerId, fallbackEmoji],
  );

  // Track emoji transitions
  const [displayEmoji, setDisplayEmoji] = useState(emoji);
  const previousEmojiRef = useRef(emoji);

  // Animation shared values
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1); // For fade transitions

  // Handle emoji transitions with fade
  useEffect(() => {
    if (emoji !== previousEmojiRef.current) {
      // Cancel any ongoing opacity animations first
      cancelAnimation(opacity);

      // Fade out current emoji
      opacity.value = withTiming(
        0,
        { duration: 150, easing: Easing.out(Easing.quad) },
        () => {
          // Once faded out, change the emoji
          runOnJS(setDisplayEmoji)(emoji);

          // Then fade back in
          opacity.value = withTiming(1, {
            duration: 200,
            easing: Easing.in(Easing.quad),
          });
        },
      );

      previousEmojiRef.current = emoji;
    }

    // Clean up animation when effect re-runs or component unmounts
    return () => {
      cancelAnimation(opacity);
    };
  }, [emoji, opacity]);

  // Setup random movement
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect to handle floating animation
  useEffect(() => {
    // Cancel any ongoing animations first
    cancelAnimation(bobY);

    // Apply simple floating animation
    bobY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, // Infinite repetitions
      true, // Reverse each cycle
    );

    // Setup random movement with organic patterns
    let t = 0;
    intervalRef.current = setInterval(() => {
      t += 0.05;

      // Create a natural, organic motion by combining cycles
      const cycle1 = Math.sin(t * 0.8) * 0.5;
      const cycle2 = Math.sin(t * 1.4 + 2.5) * 0.3;

      const movementRange = 0.06;

      // Calculate new position with multi-cycle random movement
      const randomX = (cycle1 + cycle2 * 0.5) * movementRange;
      const randomY = cycle2 * 0.7 * movementRange;

      setOffset({ x: randomX, y: randomY });
    }, 100);

    // Cleanup function
    return () => {
      // Cancel the floating animation
      cancelAnimation(bobY);

      // Clear the interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [bobY]);

  // Position animation
  useEffect(() => {
    // Cancel any ongoing animations first
    cancelAnimation(animatedX);
    cancelAnimation(animatedY);

    // Apply new animations
    animatedX.value = withSpring(offset.x * 20, SPRING_CONFIG);
    animatedY.value = withSpring(offset.y * 20, SPRING_CONFIG);

    // Cleanup function
    return () => {
      cancelAnimation(animatedX);
      cancelAnimation(animatedY);
    };
  }, [offset.x, offset.y, animatedX, animatedY]);

  // Global cleanup effect for safety
  useEffect(() => {
    // Return cleanup function that runs on unmount
    return () => {
      // Cancel all animations
      cancelAnimation(animatedX);
      cancelAnimation(animatedY);
      cancelAnimation(bobY);
      cancelAnimation(opacity);

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [animatedX, animatedY, bobY, opacity]);

  // Create animated style
  const animatedEmojiStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateX: animatedX.value },
        { translateY: animatedY.value + bobY.value },
      ],
    };
  });

  return (
    <View style={styles.emojiContainer}>
      <View style={styles.emojiCircle}>
        <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>
          {displayEmoji}
        </Animated.Text>
      </View>
    </View>
  );
};
