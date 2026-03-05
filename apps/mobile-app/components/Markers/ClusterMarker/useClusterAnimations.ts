import { useEffect, useMemo, useRef } from "react";
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ANIMATIONS, calculateMarkerSize } from "./constants";
import { SHADOW_OFFSET } from "../MarkerSVGs";

export function useClusterAnimations(count: number, isSelected: boolean) {
  const prevSelectedRef = useRef(isSelected);

  const baseScale = useMemo(() => calculateMarkerSize(count), [count]);

  // Animation values
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.3);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0.8);

  // Set up initial animations on mount
  useEffect(() => {
    shadowOpacity.value = withTiming(0.3, ANIMATIONS.SHADOW);
    rippleScale.value = withTiming(5, ANIMATIONS.RIPPLE);
    rippleOpacity.value = withTiming(0, ANIMATIONS.RIPPLE);

    return () => {
      cancelAnimation(scale);
      cancelAnimation(shadowOpacity);
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

  // Subtle pulse for large clusters only — single gentle loop
  useEffect(() => {
    if (count > 15) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1500 }),
          withTiming(1, { duration: 1500 }),
        ),
        -1,
        true,
      );

      return () => {
        cancelAnimation(scale);
      };
    }
  }, [count]);

  // Animated styles
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * baseScale }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value,
    transform: [
      { translateX: SHADOW_OFFSET.x },
      { translateY: SHADOW_OFFSET.y },
    ],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  return {
    scale,
    markerStyle,
    shadowStyle,
    rippleStyle,
    ANIMATIONS,
  };
}
