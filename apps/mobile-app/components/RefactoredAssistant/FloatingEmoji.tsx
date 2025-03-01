// FloatingEmojiWithStore.tsx
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
import { create } from "zustand";
import { styles } from "./styles";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";

// Define the store interface for the floating emoji position
interface FloatingEmojiStore {
  offsetX: number;
  offsetY: number;
  setOffset: (dx: number, dy: number) => void;
}

// Create the Zustand store for emoji position
const useFloatingEmojiStore = create<FloatingEmojiStore>((set) => ({
  offsetX: 0,
  offsetY: 0,
  setOffset: (dx: number, dy: number) => set({ offsetX: dx, offsetY: dy }),
}));

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  onTouchMove?: (dx: number, dy: number) => void;
}

export const FloatingEmojiWithStore: React.FC<FloatingEmojiProps> = ({
  fallbackEmoji = "💬",
  onTouchMove,
}) => {
  // Get the floating emoji position from the local store.
  const { offsetX, offsetY, setOffset } = useFloatingEmojiStore();
  // Pull the current emoji directly from the text streaming store.
  const { currentEmoji } = useTextStreamingStore();
  const [previousEmoji, setPreviousEmoji] = useState(currentEmoji || fallbackEmoji);

  // Use the emoji from the store or fall back if empty.
  const emojiToDisplay = currentEmoji || fallbackEmoji;

  // Create Reanimated shared values for just the emoji animation
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Handle emoji changes
  useEffect(() => {
    if (emojiToDisplay !== previousEmoji) {
      // Fade and scale transition
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setPreviousEmoji)(emojiToDisplay);
        scale.value = 0.8;

        opacity.value = withTiming(1, { duration: 250 });
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      });
    }
  }, [emojiToDisplay]);

  // Main position animation (from store)
  useEffect(() => {
    animatedX.value = withSpring(offsetX, { damping: 15 });
    animatedY.value = withSpring(offsetY, { damping: 15 });
  }, [offsetX, offsetY]);

  // Start bobbing animation
  useEffect(() => {
    // Create gentle bobbing effect just for the emoji
    bobY.value = withRepeat(
      withSequence(
        withTiming(-2, {
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(2, {
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1, // Infinite repetitions
      true // Reverse animation
    );

    // Simple random movement
    const updatePosition = () => {
      if (onTouchMove) {
        const randomX = (Math.random() - 0.5) * 0.8;
        const randomY = (Math.random() - 0.5) * 0.8;
        setOffset(randomX, randomY);
        onTouchMove(randomX, randomY);
      }
    };

    const interval = setInterval(updatePosition, 3000);
    return () => clearInterval(interval);
  }, [onTouchMove, setOffset]);

  // Combined animation styles just for the emoji text
  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedX.value },
      { translateY: animatedY.value + bobY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.emojiWrapper}>
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
        <View style={styles.emojiOverlay} />
      </View>
    </View>
  );
};
