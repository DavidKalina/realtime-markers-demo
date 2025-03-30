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
  SCAN_LINE: {
    EASING: Easing.inOut(Easing.ease),
    RESET_DURATION: 300,
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
  ({ isActive, color = "#4dabf7", speed = 1500 }, ref) => {
    // Animation value for the scanner bar position (0 to 100%)
    const scanPosition = useSharedValue(0);
    const isMounted = useRef(true);

    // Create cleanup function
    const cleanup = useCallback(() => {
      if (!isMounted.current) return;
      cancelAnimation(scanPosition);
      scanPosition.value = 0;
    }, [scanPosition]);

    // Create reset function
    const resetAnimation = useCallback(() => {
      if (!isMounted.current) return;
      scanPosition.value = 0;
    }, [scanPosition]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      cleanup,
      resetAnimation,
    }), [cleanup, resetAnimation]);

    // Set isMounted to false on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;
      };
    }, []);

    // Start or stop the animation based on isActive prop
    useEffect(() => {
      if (!isMounted.current) return;

      // Cancel any existing animation
      cancelAnimation(scanPosition);

      let animation: any = null;

      if (isActive) {
        // Reset position on activation
        scanPosition.value = 0;

        // Create the animation in a more controlled way
        const upAnimation = withTiming(100, {
          duration: speed,
          easing: SCANNER_ANIMATIONS.SCAN_LINE.EASING,
        });

        const downAnimation = withTiming(0, {
          duration: speed,
          easing: SCANNER_ANIMATIONS.SCAN_LINE.EASING,
        });

        // Create the sequence and repetition explicitly
        animation = withRepeat(
          withSequence(upAnimation, downAnimation),
          -1, // Infinite repetitions
          false // Don't reverse
        );

        // Assign the animation to the shared value
        scanPosition.value = animation;
      } else {
        // Smoothly reset to zero when not active
        scanPosition.value = withTiming(0, {
          duration: SCANNER_ANIMATIONS.SCAN_LINE.RESET_DURATION,
        });
      }

      // Clean up on unmount or when props change
      return () => {
        if (animation) {
          cancelAnimation(scanPosition);
          scanPosition.value = 0; // Reset to initial value
        }
      };
    }, [isActive, speed, scanPosition]);

    // Animated style using top percentage - memoized with color dependency
    const scanLineStyle = useAnimatedStyle(
      () => ({
        top: `${scanPosition.value}%`,
        backgroundColor: color,
      }),
      [color]
    );

    return (
      <Animated.View style={styles.container}>
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
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
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
    width: "100%",
  },
});
