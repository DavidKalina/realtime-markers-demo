import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  interpolateColor,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface CaptureButtonProps {
  onPress: () => void;
  isCapturing?: boolean;
  isReady?: boolean;
  size?: "normal" | "compact";
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onPress,
  isCapturing = false,
  isReady = false,
  size = "normal",
}) => {
  // Animation values
  const buttonScale = useSharedValue(1);
  const readyGlow = useSharedValue(0);
  const colorProgress = useSharedValue(0);
  const iconOpacity = useSharedValue(0);

  // Determine sizes based on the size prop
  const buttonSize = size === "compact" ? 48 : 56;
  const innerSize = size === "compact" ? 36 : 42;
  const glowSize = size === "compact" ? 64 : 72;

  // Setup animations based on state
  useEffect(() => {
    // Cancel any running animations first
    cancelAnimation(buttonScale);
    cancelAnimation(readyGlow);
    cancelAnimation(colorProgress);
    cancelAnimation(iconOpacity);

    if (isCapturing) {
      // Capturing animation - button scale down
      buttonScale.value = withTiming(0.92, { duration: 200 });
      colorProgress.value = withTiming(0.5, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
    } else if (isReady) {
      // Ready animation - gentle pulse effect
      buttonScale.value = withSequence(
        withTiming(1.05, { duration: 300, easing: Easing.out(Easing.ease) }),
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );

      // Add glow effect with smoother animation
      readyGlow.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
      colorProgress.value = withTiming(1, { duration: 400 });
      iconOpacity.value = withTiming(1, { duration: 300 });
    } else {
      // Default state
      buttonScale.value = withTiming(1, { duration: 200 });
      readyGlow.value = withTiming(0, { duration: 300 });
      colorProgress.value = withTiming(0, { duration: 300 });
      iconOpacity.value = withTiming(0, { duration: 200 });
    }

    return () => {
      cancelAnimation(buttonScale);
      cancelAnimation(readyGlow);
      cancelAnimation(colorProgress);
      cancelAnimation(iconOpacity);
    };
  }, [isCapturing, isReady]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const innerCircleStyle = useAnimatedStyle(() => {
    // Use interpolateColor for smooth color transitions
    const backgroundColor = interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      ["#f8f9fa", "#adb5bd", "#37D05C"]
    );

    return {
      backgroundColor,
      width: innerSize,
      height: innerSize,
      borderRadius: innerSize / 2,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      readyGlow.value,
      [0, 1],
      ["rgba(77, 171, 247, 0)", "rgba(55, 208, 92, 0.25)"]
    );

    return {
      opacity: readyGlow.value * 0.8,
      backgroundColor,
      width: glowSize,
      height: glowSize,
      borderRadius: glowSize / 2,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      opacity: iconOpacity.value,
      transform: [{ scale: 0.8 + iconOpacity.value * 0.2 }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Outer glow effect for "ready" state */}
      <Animated.View style={[styles.glowEffect, glowStyle]} />

      {/* Capture button */}
      <Animated.View style={[buttonAnimatedStyle]}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
            },
          ]}
          onPress={onPress}
          activeOpacity={0.7}
          disabled={isCapturing}
        >
          <Animated.View style={[styles.innerCircle, innerCircleStyle]}>
            {/* Camera icon that appears when ready */}
            <Animated.View style={[styles.iconContainer, iconStyle]}>
              <Feather name="camera" size={size === "compact" ? 18 : 20} color="#1a1a1a" />
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Platform.OS === "ios" ? 20 : 24,
    position: "relative",
  },
  glowEffect: {
    position: "absolute",
    opacity: 0,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  innerCircle: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    opacity: 0,
  },
});
