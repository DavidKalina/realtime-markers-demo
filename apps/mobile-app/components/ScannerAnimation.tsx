import React, { useEffect, useRef } from "react";
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

export const ScannerAnimation: React.FC<ScannerAnimationProps> = React.memo(
  ({ isActive, color = "#4dabf7", speed = 1500 }) => {
    // Animation value for the scanner bar position (0 to 100%)
    const scanPosition = useSharedValue(0);
    const isMounted = useRef(true);

    // Set isMounted to false on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;
      };
    }, []);

    // Start or stop the animation based on isActive prop
    useEffect(() => {
      // Always cancel any existing animation first to prevent conflicts
      if (!isMounted.current) return;

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
        }
      };
    }, [isActive, speed, scanPosition]);

    // Animated style using top percentage - memoized with color dependency
    const scanLineStyle = useAnimatedStyle(
      () => ({
        top: `${scanPosition.value}%`,
        backgroundColor: color,
        shadowColor: color,
      }),
      [color]
    );

    return (
      <Animated.View style={styles.container}>
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
      </Animated.View>
    );
  },
  // Custom equality function for React.memo to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.color === nextProps.color &&
      prevProps.speed === nextProps.speed
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
    zIndex: 5,
    backgroundColor: "transparent",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
});
