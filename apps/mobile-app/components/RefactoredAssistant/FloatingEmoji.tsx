// FloatingEmojiWithStore.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
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

  // Use the emoji from the store or fall back if empty.
  const emojiToDisplay = currentEmoji || fallbackEmoji;

  // Create Reanimated shared values for the floating animation.
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);

  useEffect(() => {
    animatedX.value = withSpring(offsetX, { damping: 15 });
    animatedY.value = withSpring(offsetY, { damping: 15 });
  }, [offsetX, offsetY]);

  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedX.value }, { translateY: animatedY.value }],
  }));

  useEffect(() => {
    if (onTouchMove) {
      const updatePosition = (dx: number, dy: number) => {
        setOffset(dx, dy);
        onTouchMove(dx, dy);
      };

      const interval = setInterval(() => {
        const randomX = (Math.random() - 0.5) * 0.5;
        const randomY = (Math.random() - 0.5) * 0.5;
        updatePosition(randomX, randomY);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [onTouchMove, setOffset]);

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
            {emojiToDisplay}
          </Animated.Text>
        </View>
        <View style={styles.emojiOverlay} />
      </View>
    </View>
  );
};
