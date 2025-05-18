import React, { useEffect, useRef } from "react";
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
import { FlashMode } from "expo-camera";

interface CaptureButtonProps {
  onPress: () => void;
  isCapturing?: boolean;
  isReady?: boolean;
  size?: "normal" | "compact";
  flashMode?: FlashMode;
  onFlashToggle?: () => void;
  flashButtonPosition?: "left" | "right";
}

// Add unified color theme at the top
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
};

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onPress,
  isCapturing = false,
  isReady = true,
  size = "normal",
  flashMode = "off",
  onFlashToggle,
  flashButtonPosition = "left",
}) => {
  // Animation values
  const buttonScale = useSharedValue(1);
  const colorProgress = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const borderProgress = useSharedValue(0);
  const flashButtonOpacity = useSharedValue(0);

  // Track if component is mounted
  const isMounted = useRef(true);

  // Determine sizes based on the size prop
  const buttonSize = size === "compact" ? 48 : 56;
  const innerSize = size === "compact" ? 36 : 42;

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Cleanup function to cancel all animations
  const cleanupAnimations = () => {
    cancelAnimation(buttonScale);
    cancelAnimation(colorProgress);
    cancelAnimation(iconOpacity);
    cancelAnimation(borderProgress);
    cancelAnimation(flashButtonOpacity);
  };

  // Show flash button when onFlashToggle is provided and not capturing
  useEffect(() => {
    if (onFlashToggle && !isCapturing) {
      flashButtonOpacity.value = withTiming(1, { duration: 300 });
    } else {
      flashButtonOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isCapturing, flashButtonOpacity, onFlashToggle]);

  // Setup animations based on state
  useEffect(() => {
    if (!isMounted.current) return;

    // Cancel any running animations first
    cleanupAnimations();

    if (isCapturing) {
      // Capturing animation - button scale down
      buttonScale.value = withTiming(0.92, { duration: 200 });
      colorProgress.value = withTiming(0.5, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
      borderProgress.value = withTiming(0, { duration: 150 });
    } else if (isReady) {
      // Ready animation - subtle pulse without the oversized glow
      const initialScale = withTiming(1.05, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });

      const pulseAnimation = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.05, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );

      // Apply sequence animation with safeguards
      buttonScale.value = withSequence(initialScale, pulseAnimation);

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

    // Clean up on unmount or when props change
    return cleanupAnimations;
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
      ["#f8f9fa", "#adb5bd", "#37D05C"],
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
      ["rgba(255, 255, 255, 0.3)", "rgba(55, 208, 92, 0.8)"],
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

  const flashButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: flashButtonOpacity.value,
      transform: [{ scale: 0.8 + flashButtonOpacity.value * 0.2 }],
    };
  });

  // Get flash icon based on current mode
  const getFlashIcon = () => {
    switch (flashMode) {
      case "on":
        return "zap";
      case "auto":
        return "zap-off";
      case "off":
      default:
        return "zap-off";
    }
  };

  // Get flash button color based on current mode
  const getFlashColor = () => {
    switch (flashMode) {
      case "on":
        return "#ffce00"; // Yellow for on
      case "auto":
        return "#5cafff"; // Blue for auto
      case "off":
      default:
        return "#ffffff"; // White for off
    }
  };

  // Render flash button
  const renderFlashButton = () => {
    if (!onFlashToggle) return null;

    return (
      <Animated.View style={[styles.flashButtonWrapper, flashButtonStyle]}>
        <TouchableOpacity
          style={[styles.flashButton, { borderColor: getFlashColor() }]}
          onPress={onFlashToggle}
          activeOpacity={0.7}
          disabled={isCapturing}
        >
          <Feather name={getFlashIcon()} size={20} color={getFlashColor()} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        {/* Left side - flash button if positioned left */}
        <View style={styles.sideContainer}>
          {flashButtonPosition === "left" && renderFlashButton()}
        </View>

        {/* Center - capture button */}
        <View style={styles.centerContainer}>
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
                  <Animated.View style={[styles.iconContainer, iconStyle]}>
                    <Feather
                      name="camera"
                      size={size === "compact" ? 18 : 20}
                      color="#1a1a1a"
                    />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Right side - flash button if positioned right */}
        <View style={styles.sideContainer}>
          {flashButtonPosition === "right" && renderFlashButton()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Platform.OS === "ios" ? 20 : 24,
    width: "100%",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 40,
  },
  sideContainer: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
  outerBorder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  innerCircle: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    opacity: 0,
  },
  flashButtonWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.buttonBorder,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
