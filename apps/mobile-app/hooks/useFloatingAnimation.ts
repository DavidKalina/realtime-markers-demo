import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export const useFloatingAnimation = () => {
  const floatingAnimation = useSharedValue(0);

  useEffect(() => {
    floatingAnimation.value = withRepeat(
      withSequence(withTiming(-3, { duration: 2000 }), withTiming(3, { duration: 2000 })),
      -1,
      true
    );
  }, []);

  const floatingStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatingAnimation.value }],
    };
  });

  return { floatingStyle };
};
