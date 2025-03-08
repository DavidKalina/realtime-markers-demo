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
  const colorProgress = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const borderProgress = useSharedValue(0);

  // Determine sizes based on the size prop
  const buttonSize = size === "compact" ? 48 : 56;
  const innerSize = size === "compact" ? 36 : 42;

  // Setup animations based on state
  useEffect(() => {
    // Cancel any running animations first
    cancelAnimation(buttonScale);
    cancelAnimation(colorProgress);
    cancelAnimation(iconOpacity);
    cancelAnimation(borderProgress);

    if (isCapturing) {
      // Capturing animation - button scale down
      buttonScale.value = withTiming(0.92, { duration: 200 });
      colorProgress.value = withTiming(0.5, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
      borderProgress.value = withTiming(0, { duration: 150 });
    } else if (isReady) {
      // Ready animation - subtle pulse without the oversized glow
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

      // Animate color and icon without the large glow
      colorProgress.value = withTiming(1, { duration: 400 });
      iconOpacity.value = withTiming(1, { duration: 300 });
      // Animate border instead of using a separate glow element
      borderProgress.value = withTiming(1, { duration: 400 });
    } else {
      // Default state
      buttonScale.value = withTiming(1, { duration: 200 });
      colorProgress.value = withTiming(0, { duration: 300 });
      iconOpacity.value = withTiming(0, { duration: 200 });
      borderProgress.value = withTiming(0, { duration: 300 });
    }

    return () => {
      cancelAnimation(buttonScale);
      cancelAnimation(colorProgress);
      cancelAnimation(iconOpacity);
      cancelAnimation(borderProgress);
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

  const buttonOuterStyle = useAnimatedStyle(() => {
    // Transition border color for ready state instead of using a separate glow
    const borderColor = interpolateColor(
      borderProgress.value,
      [0, 1],
      ["rgba(255, 255, 255, 0.3)", "rgba(55, 208, 92, 0.8)"]
    );

    const shadowOpacity = 0.2 + borderProgress.value * 0.3;
    const shadowRadius = 2 + borderProgress.value * 3;

    return {
      borderColor,
      shadowColor: isReady ? "#37D05C" : "#000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity,
      shadowRadius,
      elevation: 2 + borderProgress.value * 3,
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
      {/* Capture button with integrated ready indication */}
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
          <Animated.View
            style={[
              styles.outerBorder,
              {
                width: buttonSize,
                height: buttonSize,
                borderRadius: buttonSize / 2,
              },
              buttonOuterStyle,
            ]}
          >
            <Animated.View style={[styles.innerCircle, innerCircleStyle]}>
              {/* Camera icon that appears when ready */}
              <Animated.View style={[styles.iconContainer, iconStyle]}>
                <Feather name="camera" size={size === "compact" ? 18 : 20} color="#1a1a1a" />
              </Animated.View>
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
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
  outerBorder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
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
