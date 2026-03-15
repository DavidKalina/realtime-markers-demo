import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * FAB slide-in entrance animations and job-in-flight pulse.
 * Pure presentational — no business logic.
 */
export function useFabAnimations(hasInFlight: boolean) {
  // Slide-up entrance animations (shared values, not layout animations,
  // to avoid ComponentDescriptorRegistry deadlock with MapView initialization).
  const fabSlide0 = useSharedValue(20);
  const fabOpacity0 = useSharedValue(0);
  const fabSlide1 = useSharedValue(20);
  const fabOpacity1 = useSharedValue(0);
  const fabSlide2 = useSharedValue(20);
  const fabOpacity2 = useSharedValue(0);
  const fabSlide3 = useSharedValue(20);
  const fabOpacity3 = useSharedValue(0);

  useEffect(() => {
    const springCfg = { damping: 14, stiffness: 160 };
    fabSlide0.value = withSpring(0, springCfg);
    fabOpacity0.value = withSpring(1, springCfg);
    fabSlide1.value = withDelay(50, withSpring(0, springCfg));
    fabOpacity1.value = withDelay(50, withSpring(1, springCfg));
    fabSlide2.value = withDelay(100, withSpring(0, springCfg));
    fabOpacity2.value = withDelay(100, withSpring(1, springCfg));
    fabSlide3.value = withDelay(150, withSpring(0, springCfg));
    fabOpacity3.value = withDelay(150, withSpring(1, springCfg));
  }, []);

  const fabStyle0 = useAnimatedStyle(() => ({
    opacity: fabOpacity0.value,
    transform: [{ translateY: fabSlide0.value }],
  }));
  const fabStyle1 = useAnimatedStyle(() => ({
    opacity: fabOpacity1.value,
    transform: [{ translateY: fabSlide1.value }],
  }));
  const fabStyle2 = useAnimatedStyle(() => ({
    opacity: fabOpacity2.value,
    transform: [{ translateY: fabSlide2.value }],
  }));
  const fabStyle3 = useAnimatedStyle(() => ({
    opacity: fabOpacity3.value,
    transform: [{ translateY: fabSlide3.value }],
  }));

  // Subtle pulse on jobs FAB when work is in-flight
  const jobPulse = useSharedValue(1);
  useEffect(() => {
    if (hasInFlight) {
      jobPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      jobPulse.value = withTiming(1, { duration: 300 });
    }
  }, [hasInFlight, jobPulse]);

  const jobPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: jobPulse.value }],
  }));

  return { fabStyle0, fabStyle1, fabStyle2, fabStyle3, jobPulseStyle };
}
