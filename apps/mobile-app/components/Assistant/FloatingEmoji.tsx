// FloatingEmojiWithStore.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { create } from "zustand";
import { styles } from "./styles";

// Define the store interface
interface FloatingEmojiStore {
  offsetX: number;
  offsetY: number;
  setOffset: (dx: number, dy: number) => void;
}

// Create the Zustand store
const useFloatingEmojiStore = create<FloatingEmojiStore>((set) => ({
  offsetX: 0,
  offsetY: 0,
  setOffset: (dx: number, dy: number) => set({ offsetX: dx, offsetY: dy }),
}));

interface FloatingEmojiProps {
  emoji: string;
  onTouchMove?: (dx: number, dy: number) => void;
}

export const FloatingEmojiWithStore: React.FC<FloatingEmojiProps> = ({ emoji, onTouchMove }) => {
  // Get state from Zustand store
  const { offsetX, offsetY, setOffset } = useFloatingEmojiStore();

  // Create Reanimated shared values for animations
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);

  // Update animated values when store values change
  useEffect(() => {
    animatedX.value = withSpring(offsetX, { damping: 15 });
    animatedY.value = withSpring(offsetY, { damping: 15 });
  }, [offsetX, offsetY]);

  // Create animated style
  const animatedEmojiStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: animatedX.value }, { translateY: animatedY.value }],
    };
  });

  // Connect onTouchMove prop to store update
  useEffect(() => {
    if (onTouchMove) {
      const updatePosition = (dx: number, dy: number) => {
        setOffset(dx, dy);
        onTouchMove(dx, dy);
      };

      // Simulate some gentle floating movement on mount
      const interval = setInterval(() => {
        const randomX = (Math.random() - 0.5) * 0.5;
        const randomY = (Math.random() - 0.5) * 0.5;
        updatePosition(randomX, randomY);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [onTouchMove]);

  return (
    <View style={styles.emojiWrapper}>
      <View style={styles.emojiContainer}>
        {/* Add a subtle shadow to make the emoji stand out like the event details icon */}
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
          <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>{emoji}</Animated.Text>
        </View>
        <View style={styles.emojiOverlay} />
      </View>
    </View>
  );
};
