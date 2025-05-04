import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";

interface MapRippleEffectProps {
  isVisible: boolean;
  position: {
    x: number;
    y: number;
  };
  onAnimationComplete?: () => void;
}

export const MapRippleEffect: React.FC<MapRippleEffectProps> = ({
  isVisible,
  position,
  onAnimationComplete,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  const handleAnimationComplete = () => {
    "worklet";
    if (onAnimationComplete) {
      runOnJS(onAnimationComplete)();
    }
  };

  useEffect(() => {
    console.log("MapRippleEffect mounted/updated:", { isVisible, position });

    if (isVisible) {
      // Reset values
      scale.value = 0;
      opacity.value = 1;

      // Start animation sequence
      scale.value = withSequence(
        withTiming(1, {
          duration: 1000,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
        withTiming(0, {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        })
      );

      opacity.value = withSequence(
        withTiming(0.8, { duration: 300 }),
        withDelay(700, withTiming(0, { duration: 300 }, handleAnimationComplete))
      );
    }

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [isVisible, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      position: "absolute",
      left: position.x,
      top: position.y,
      transform: [{ translateX: -50 }, { translateY: -50 }, { scale: scale.value }],
      opacity: opacity.value,
    };
  });

  if (!isVisible) return null;

  return (
    <AnimatedReanimated.View style={[styles.ripple, animatedStyle]}>
      <AnimatedReanimated.View style={styles.rippleInner} />
    </AnimatedReanimated.View>
  );
};

const styles = StyleSheet.create({
  ripple: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  rippleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
});
