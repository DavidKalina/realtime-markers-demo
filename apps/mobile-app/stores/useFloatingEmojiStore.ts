// hooks/useFloatingEmojiStore.ts
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { create } from "zustand";

interface FloatingEmojiState {
  offsetX: Reanimated.SharedValue<number>;
  offsetY: Reanimated.SharedValue<number>;
  updateManualPosition: (dx: number, dy: number) => void;
  animatedEmojiStyle: any;
}

// This is a custom hook that creates a Zustand store with Reanimated shared values
// Since Reanimated shared values need to be created in the context of a component,
// we'll create a function that returns a Zustand store
export const createFloatingEmojiStore = () => {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  // Create the animated style using the shared values
  const animatedEmojiStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
    };
  });

  // Create and return the Zustand store
  return create<FloatingEmojiState>((set) => ({
    offsetX,
    offsetY,
    animatedEmojiStyle,

    updateManualPosition: (dx: number, dy: number) => {
      offsetX.value = withSpring(dx, { damping: 15 });
      offsetY.value = withSpring(dy, { damping: 15 });
    },
  }));
};

// We'll need to use this in a component rather than directly,
// since Reanimated requires hooks to be used within React function components
