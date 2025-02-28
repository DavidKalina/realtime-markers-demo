// hooks/useFloatingEmoji.ts
import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

export const useFloatingEmoji = () => {
  const progress = useSharedValue(0);
  const manualX = useSharedValue(0);
  const manualY = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 5000,
        easing: Easing.linear,
      }),
      -1,
      true
    );
  }, []);

  const updateManualPosition = (dx: number, dy: number) => {
    const limitedX = Math.max(-6, Math.min(6, dx));
    const limitedY = Math.max(-6, Math.min(6, dy));
    manualX.value = limitedX * 1.2;
    manualY.value = limitedY * 1.2;
  };

  const animatedEmojiStyle = useAnimatedStyle(() => {
    const dynamicX = Math.sin(progress.value / 2) * 6;
    const dynamicY = Math.cos(progress.value / 3) * 6;
    const baseX = manualX.value + dynamicX;
    const baseY = manualY.value + dynamicY;
    const rotation = Math.sin(progress.value / 5) * 5;
    const baseScale = 0.9 + Math.sin(progress.value / 1.8) * 0.1;
    return {
      transform: [
        { translateX: baseX },
        { translateY: baseY },
        { scale: baseScale },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return {
    animatedEmojiStyle,
    updateManualPosition,
  };
};
