import { useEffect, useMemo, useRef } from "react";
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ANIMATIONS, calculateMarkerSize } from "./constants";
import { SHADOW_OFFSET } from "../MarkerSVGs";

// Static shadow style — shadow opacity was animating 0.3→0.3 (no-op)
export const staticShadowStyle = {
  opacity: 0.3,
  transform: [
    { translateX: SHADOW_OFFSET.x },
    { translateY: SHADOW_OFFSET.y },
  ],
};

export function useClusterAnimations(
  count: number,
  isSelected: boolean,
  clusterPulse?: SharedValue<number>,
) {
  const prevSelectedRef = useRef(isSelected);

  const baseScale = useMemo(() => calculateMarkerSize(count), [count]);

  // Per-instance animation values
  const scale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0.8);

  // Mount ripple — fire once
  useEffect(() => {
    rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
    rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

    return () => {
      cancelAnimation(scale);
      cancelAnimation(rippleScale);
      cancelAnimation(rippleOpacity);
    };
  }, []);

  // Handle selection state changes
  useEffect(() => {
    if (isSelected !== prevSelectedRef.current) {
      prevSelectedRef.current = isSelected;
      if (isSelected) {
        scale.value = withSpring(1.15, ANIMATIONS.SCALE_RELEASE);
      } else {
        scale.value = withSpring(1, ANIMATIONS.SCALE_RELEASE);
      }
    }
  }, [isSelected]);

  // Scale + shared pulse for large clusters (from parent)
  const markerStyle = useAnimatedStyle(() => {
    const pulse = count > 15 && clusterPulse ? clusterPulse.value : 1;
    return {
      transform: [{ scale: scale.value * baseScale * pulse }],
    };
  });

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  return {
    scale,
    markerStyle,
    rippleStyle,
    ANIMATIONS,
  };
}
