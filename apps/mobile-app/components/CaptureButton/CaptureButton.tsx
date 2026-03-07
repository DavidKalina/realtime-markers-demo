import React, { useEffect, useMemo, useRef } from "react";
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
import { Camera } from "lucide-react-native";
import { useColors, spacing, type Colors } from "@/theme";

interface CaptureButtonProps {
  onPress: () => void;
  isCapturing?: boolean;
  isReady?: boolean;
  size?: "normal" | "compact" | "large";
  disabled?: boolean;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onPress,
  isCapturing = false,
  isReady = true,
  size = "normal",
  disabled = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Animation values
  const buttonScale = useSharedValue(1);
  const colorProgress = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const borderProgress = useSharedValue(0);

  // Track if component is mounted
  const isMounted = useRef(true);

  // Determine sizes based on the size prop
  const buttonSize = size === "large" ? 72 : size === "compact" ? 48 : 56;
  const innerSize = size === "large" ? 54 : size === "compact" ? 36 : 42;

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
  };

  // Setup animations based on state
  useEffect(() => {
    if (!isMounted.current) return;

    // Cancel any running animations first
    cleanupAnimations();

    if (disabled) {
      // Disabled state - no animations, dimmed appearance
      buttonScale.value = withTiming(0.8, { duration: 200 });
      colorProgress.value = withTiming(0.3, { duration: 200 });
      iconOpacity.value = withTiming(0.5, { duration: 200 });
      borderProgress.value = withTiming(0, { duration: 200 });
    } else if (isCapturing) {
      // Capturing animation - button scale down
      buttonScale.value = withTiming(0.92, { duration: 200 });
      colorProgress.value = withTiming(0.5, { duration: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
      borderProgress.value = withTiming(0, { duration: 150 });
    } else if (isReady) {
      // Ready animation - subtle pulse
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

      buttonScale.value = withSequence(initialScale, pulseAnimation);
      colorProgress.value = withTiming(1, { duration: 400 });
      iconOpacity.value = withTiming(1, { duration: 300 });
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
  }, [isCapturing, isReady, disabled]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const innerCircleStyle = useAnimatedStyle(() => {
    const backgroundColor = disabled
      ? colors.text.disabled
      : interpolateColor(
          colorProgress.value,
          [0, 0.5, 1],
          [colors.bg.elevated, colors.text.secondary, colors.accent.primary],
        );

    return {
      backgroundColor,
      width: innerSize,
      height: innerSize,
      borderRadius: innerSize / 2,
    };
  });

  const buttonOuterStyle = useAnimatedStyle(() => {
    const borderColor = disabled
      ? colors.border.default
      : interpolateColor(
          borderProgress.value,
          [0, 1],
          [colors.border.medium, colors.accent.border],
        );

    const shadowOpacity = disabled ? 0.05 : 0.1 + borderProgress.value * 0.15;
    const shadowRadius = disabled ? 1 : 2 + borderProgress.value * 3;

    return {
      borderColor,
      shadowColor: isReady ? colors.accent.primary : colors.fixed.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity,
      shadowRadius,
      elevation: disabled ? 1 : 2 + borderProgress.value * 3,
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
          disabled={isCapturing || disabled}
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
                <Camera
                  size={size === "large" ? 24 : size === "compact" ? 18 : 20}
                  color={colors.bg.primary}
                />
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
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
    backgroundColor: colors.bg.cardAlt,
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
