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
import { COLORS } from "@/components/Layout/ScreenLayout";

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

      // Start animation sequence with adjusted timing and opacity
      scale.value = withSequence(
        withTiming(1.2, {
          // Slightly larger scale for more impact
          duration: 1200, // Longer duration for better visibility
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
        withTiming(0, {
          duration: 400, // Slightly longer fade out
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
      );

      opacity.value = withSequence(
        withTiming(0.9, { duration: 400 }), // Higher initial opacity
        withDelay(
          800, // Slightly longer delay
          withTiming(0, { duration: 400 }, handleAnimationComplete), // Longer fade out
        ),
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
      transform: [
        { translateX: -50 },
        { translateY: -50 },
        { scale: scale.value },
      ],
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
    backgroundColor: `${COLORS.accent}40`, // 25% opacity accent color
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: `${COLORS.accent}80`, // 50% opacity accent color
  },
  rippleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.accent}60`, // 37.5% opacity accent color
    borderWidth: 1,
    borderColor: `${COLORS.accent}90`, // 56.25% opacity accent color
  },
});
