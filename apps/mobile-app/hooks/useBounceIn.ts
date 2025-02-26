// hooks/useBounceIn.ts
import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

const useBounceIn = () => {
  // Shared values for scale and opacity
  const scale = useSharedValue(0); // Start from 0 for BounceIn
  const opacity = useSharedValue(0); // Start from 0 for FadeIn

  // Start the BounceIn animation on mount
  useEffect(() => {
    // Animate scale from 0 to 1 with a spring effect for bounce
    scale.value = withSpring(1, {
      damping: 8,
      stiffness: 150,
    });

    // Animate opacity from 0 to 1 with a timing animation for fade-in
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease),
    });
  }, [scale, opacity]);

  // Animated style to be applied to the component
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return animatedStyle;
};

export default useBounceIn;
