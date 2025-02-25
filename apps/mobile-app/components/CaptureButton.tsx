import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

interface CaptureButtonProps {
  onPress: () => void;
  isCapturing?: boolean;
  isReady?: boolean; // New prop for document alignment feedback
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onPress,
  isCapturing = false,
  isReady = false,
}) => {
  // Animation values
  const buttonScale = useSharedValue(1);
  const readyGlow = useSharedValue(0);

  // Setup animations based on state
  useEffect(() => {
    // Cancel any running animations first
    cancelAnimation(buttonScale);
    cancelAnimation(readyGlow);

    if (isCapturing) {
      // Capturing animation - button scale down
      buttonScale.value = withTiming(0.9, { duration: 200 });
    } else if (isReady) {
      // Ready animation - gentle pulse effect
      buttonScale.value = 1;
      buttonScale.value = withRepeat(
        withTiming(1.05, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );

      // Add glow effect
      readyGlow.value = withTiming(1, { duration: 300 });
    } else {
      // Default state
      buttonScale.value = withTiming(1, { duration: 200 });
      readyGlow.value = withTiming(0, { duration: 300 });
    }

    return () => {
      cancelAnimation(buttonScale);
      cancelAnimation(readyGlow);
    };
  }, [isCapturing, isReady]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const innerCircleStyle = useAnimatedStyle(() => {
    // Change color based on state
    const backgroundColor = isCapturing
      ? "rgba(255, 255, 255, 0.7)"
      : isReady
      ? "#69db7c" // Green when ready
      : "#fff";

    return {
      backgroundColor,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: readyGlow.value * 0.5,
      transform: [{ scale: 1 + readyGlow.value * 0.2 }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Outer glow effect for "ready" state */}
      <Animated.View style={[styles.glowEffect, glowStyle]} />

      {/* Capture button */}
      <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.button}
          onPress={onPress}
          activeOpacity={0.7}
          disabled={isCapturing}
        >
          <Animated.View style={[styles.innerCircle, innerCircleStyle]} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    position: "relative",
  },
  glowEffect: {
    position: "absolute",
    width: 76, // Reduced size
    height: 76, // Reduced size
    borderRadius: 38, // Half of width/height
    backgroundColor: "#69db7c",
    opacity: 0,
  },
  button: {
    width: 60, // Reduced size
    height: 60, // Reduced size
    borderRadius: 30, // Half of width/height
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 46, // Reduced size
    height: 46, // Reduced size
    borderRadius: 23, // Half of width/height
    backgroundColor: "white",
  },
  buttonContainer: {
    // This wrapper allows for scale animation
  },
});
