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
  const fanRotation = useSharedValue(0);
  const fanScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const burstScale = useSharedValue(1);

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
      cancelAnimation(fanRotation);
      cancelAnimation(fanScale);
      cancelAnimation(pulseScale);
      cancelAnimation(burstScale);
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

  // Fanning animation effect (UI thread only — no setInterval)
  useEffect(() => {
    fanRotation.value = withRepeat(
      withSequence(
        withTiming(0.2, ANIMATIONS.FAN_OUT),
        withTiming(-0.2, ANIMATIONS.FAN_OUT),
        withTiming(0, ANIMATIONS.FAN_IN),
        withTiming(0, { duration: 4000 }), // pause
      ),
      -1,
      false,
    );
    fanScale.value = withRepeat(
      withSequence(
        withTiming(1.1, ANIMATIONS.FAN_OUT),
        withTiming(1.1, { duration: 200 }),
        withTiming(1, ANIMATIONS.FAN_IN),
        withTiming(1, { duration: 4000 }), // pause
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(fanRotation);
      cancelAnimation(fanScale);
    };
  }, []);

  // Pulsing animation for larger clusters
  useEffect(() => {
    if (count > 15) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 300 }),
          withTiming(0.95, { duration: 300 }),
          withTiming(1.1, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        ),
        -1,
        true,
      );
    } else if (count > 5) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        true,
      );
    }

    return () => {
      cancelAnimation(pulseScale);
    };
  }, [count]);

  // Burst effect for very large clusters
  useEffect(() => {
    if (count > 15) {
      burstScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        -1,
        true,
      );
    }

    return () => {
      cancelAnimation(burstScale);
    };
  }, [count]);

  // Animated styles
  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          scale.value *
          fanScale.value *
          baseScale *
          pulseScale.value *
          burstScale.value,
      },
      { rotate: `${fanRotation.value}rad` },
    ],
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
