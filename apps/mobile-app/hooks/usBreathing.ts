// hooks/useBreathing.ts

import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface UseBreathingReturn {
  animatedStyle: any;
  scale: any;
}

const useBreathing = (): UseBreathingReturn => {
  // Shared value for scaling
  const scale = useSharedValue(1);

  useEffect(() => {
    // Start the breathing animation: scale up to 1.2 and down to 1 continuously
    scale.value = withRepeat(
      withTiming(1.2, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite repetitions
      true // Reverse the animation (scale down)
    );
  }, [scale]);

  // Animated style to apply to the circular path
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, scale };
};

export default useBreathing;
