import React, { useEffect, useRef, useCallback, useImperativeHandle } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// Animation configurations - defined outside component
const SCANNER_ANIMATIONS = {
  SCAN: {
    EASING: Easing.bezier(0.4, 0, 0.2, 1), // More stable easing curve
    RESET_DURATION: 300,
    LINE_WIDTH: 2,
    LINE_OPACITY: 0.8,
    GLOW_RADIUS: 16,
    GLOW_OPACITY: 0.5,
    SCAN_EXTENSION: 50, // Percentage to extend beyond screen bounds
    SWEEP_DURATION: 2000, // Duration for one complete sweep
    MOVEMENT_RANGE: 1.0, // Reduced range for more stable animation
  },
};


interface ScannerAnimationProps {
  isActive: boolean;
  color?: string;
  speed?: number;
}

export interface ScannerAnimationRef {
  cleanup: () => void;
  resetAnimation: () => void;
}

export const ScannerAnimation = React.forwardRef<ScannerAnimationRef, ScannerAnimationProps>(
  ({ isActive, color = "#4dabf7", speed = 2000 }, ref) => {
    const horizontalProgress = useSharedValue(0);
    const verticalProgress = useSharedValue(0);
    const isMounted = useRef(true);
    const animationRefs = useRef<{
      horizontal?: ReturnType<typeof withRepeat>;
      vertical?: ReturnType<typeof withRepeat>;
    }>({});

    // Create cleanup function
    const cleanup = useCallback(() => {
      if (!isMounted.current) return;

      // Cancel all animations
      cancelAnimation(horizontalProgress);
      cancelAnimation(verticalProgress);

      // Reset values
      horizontalProgress.value = 0;
      verticalProgress.value = 0;

      // Clear animation refs
      animationRefs.current = {};
    }, [horizontalProgress, verticalProgress]);

    // Create reset function
    const resetAnimation = useCallback(() => {
      if (!isMounted.current) return;

      // Cancel existing animations
      cleanup();

      // Reset values
      horizontalProgress.value = 0;
      verticalProgress.value = 0;
    }, [cleanup]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      cleanup,
      resetAnimation,
    }), [cleanup, resetAnimation]);

    // Set isMounted to false on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;
        cleanup();
      };
    }, [cleanup]);

    // Start or stop the animation based on isActive prop
    useEffect(() => {
      if (!isMounted.current) return;

      // Cancel any existing animations
      cleanup();

      if (isActive) {
        // Create a systematic scanning pattern that hits all corners
        animationRefs.current.horizontal = withRepeat(
          withSequence(
            withTiming(1, {
              duration: speed,
              easing: SCANNER_ANIMATIONS.SCAN.EASING,
            }),
            withTiming(-1, {
              duration: speed,
              easing: SCANNER_ANIMATIONS.SCAN.EASING,
            })
          ),
          -1,
          false
        );

        // Vertical line moves in opposite direction for better coverage
        animationRefs.current.vertical = withRepeat(
          withSequence(
            withTiming(1, {
              duration: speed * 0.8,
              easing: SCANNER_ANIMATIONS.SCAN.EASING,
            }),
            withTiming(-1, {
              duration: speed * 0.8,
              easing: SCANNER_ANIMATIONS.SCAN.EASING,
            })
          ),
          -1,
          false
        );

        // Apply animations
        horizontalProgress.value = animationRefs.current.horizontal;
        verticalProgress.value = animationRefs.current.vertical;
      } else {
        // Smoothly reset lines when not active
        horizontalProgress.value = withTiming(0, {
          duration: SCANNER_ANIMATIONS.SCAN.RESET_DURATION,
        });
        verticalProgress.value = withTiming(0, {
          duration: SCANNER_ANIMATIONS.SCAN.RESET_DURATION,
        });
      }

      return cleanup;
    }, [isActive, speed, horizontalProgress, verticalProgress, cleanup]);

    // Create animated styles for the scan lines
    const horizontalStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: horizontalProgress.value * 100 }],
    }), []);

    const verticalStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: verticalProgress.value * 100 }],
    }), []);

    return (
      <Animated.View style={styles.container}>
        {/* Horizontal scan line */}
        <Animated.View
          style={[
            styles.scanLine,
            styles.horizontalLine,
            horizontalStyle,
            { backgroundColor: color },
          ]}
        />

        {/* Vertical scan line */}
        <Animated.View
          style={[
            styles.scanLine,
            styles.verticalLine,
            verticalStyle,
            { backgroundColor: color },
          ]}
        />
      </Animated.View>
    );
  }
);

// Styles defined once outside the component
const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "visible", // Allow lines to extend beyond bounds
    backgroundColor: "transparent",
  },
  scanLine: {
    position: "absolute",
    backgroundColor: "#4dabf7",
    opacity: SCANNER_ANIMATIONS.SCAN.LINE_OPACITY,
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: SCANNER_ANIMATIONS.SCAN.GLOW_OPACITY,
    shadowRadius: SCANNER_ANIMATIONS.SCAN.GLOW_RADIUS,
    elevation: 8,
  },
  horizontalLine: {
    left: -SCANNER_ANIMATIONS.SCAN.SCAN_EXTENSION,
    right: -SCANNER_ANIMATIONS.SCAN.SCAN_EXTENSION,
    height: SCANNER_ANIMATIONS.SCAN.LINE_WIDTH,
    top: "50%",
  },
  verticalLine: {
    top: -SCANNER_ANIMATIONS.SCAN.SCAN_EXTENSION,
    bottom: -SCANNER_ANIMATIONS.SCAN.SCAN_EXTENSION,
    width: SCANNER_ANIMATIONS.SCAN.LINE_WIDTH,
    left: "50%",
  },
});
