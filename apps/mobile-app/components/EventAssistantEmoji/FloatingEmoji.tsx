// FloatingEmoji.tsx
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import { styles } from "./emoji";

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  onTouchMove?: (dx: number, dy: number) => void;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({
  fallbackEmoji = "💬",
  onTouchMove,
}) => {
  // Local state for position instead of using a separate store
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Pull the current emoji directly from the text streaming store
  const { currentEmoji } = useTextStreamingStore();
  const [previousEmoji, setPreviousEmoji] = useState(currentEmoji || fallbackEmoji);

  // Use the emoji from the store or fall back if empty
  const emojiToDisplay = currentEmoji || fallbackEmoji;

  // Animation shared values
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Handle emoji changes
  useEffect(() => {
    if (emojiToDisplay !== previousEmoji) {
      // Fade out, update emoji, fade in
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setPreviousEmoji)(emojiToDisplay);
        scale.value = 0.8;
        opacity.value = withTiming(1, { duration: 250 });
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      });
    }
  }, [emojiToDisplay]);

  // Position animation
  useEffect(() => {
    animatedX.value = withSpring(offset.x, { damping: 15 });
    animatedY.value = withSpring(offset.y, { damping: 15 });
  }, [offset.x, offset.y]);

  // Bobbing animation and random movement
  useEffect(() => {
    // Create gentle bobbing effect
    bobY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1, // Infinite repetitions
      true // Reverse animation
    );

    // Simple random movement
    const updatePosition = () => {
      const randomX = (Math.random() - 0.5) * 0.8;
      const randomY = (Math.random() - 0.5) * 0.8;

      setOffset({ x: randomX, y: randomY });
      if (onTouchMove) onTouchMove(randomX, randomY);
    };

    const interval = setInterval(updatePosition, 3000);
    return () => clearInterval(interval);
  }, [onTouchMove]);

  // Combined animation style
  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedX.value },
      { translateY: animatedY.value + bobY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.emojiContainer}>
      <View
        style={[
          styles.emojiCircle,
          {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
        ]}
      >
        <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>
          {previousEmoji}
        </Animated.Text>
      </View>
    </View>
  );
};
