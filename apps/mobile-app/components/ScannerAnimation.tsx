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
    // Create three scanning segments
    const segments = Array(3).fill(0).map(() => useSharedValue(0));
    const isMounted = useRef(true);

    // Create cleanup function
    const cleanup = useCallback(() => {
      if (!isMounted.current) return;
      segments.forEach(animation => {
        cancelAnimation(animation);
        animation.value = 0;
      });
    }, [segments]);

    // Create reset function
    const resetAnimation = useCallback(() => {
      if (!isMounted.current) return;
      segments.forEach(animation => {
        animation.value = 0;
      });
    }, [segments]);

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

      // Cancel any existing animations
      segments.forEach(animation => cancelAnimation(animation));

      if (isActive) {
        // Create smooth scanning animations for each segment
        segments.forEach((animation, index) => {
          const delay = index * (speed / 3);

          animation.value = withRepeat(
            withSequence(
              withTiming(1, {
                duration: speed,
                easing: SCANNER_ANIMATIONS.SCAN.EASING,
              }),
              withTiming(0, {
                duration: speed,
                easing: SCANNER_ANIMATIONS.SCAN.EASING,
              })
            ),
            -1,
            false
          );
        });
      } else {
        // Smoothly reset all segments when not active
        segments.forEach(animation => {
          animation.value = withTiming(0, {
            duration: SCANNER_ANIMATIONS.SCAN.RESET_DURATION,
          });
        });
      }

      return cleanup;
    }, [isActive, speed, segments, cleanup]);

    return (
      <Animated.View style={styles.container}>
        {segments.map((animation, index) => {
          const animatedStyle = useAnimatedStyle(() => ({
            opacity: animation.value * 0.2,
            backgroundColor: color,
          }));

          return (
            <Animated.View
              key={index}
              style={[
                styles.scanSegment,
                {
                  top: `${(index * 33.33)}%`,
                },
                animatedStyle,
              ]}
            />
          );
        })}
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
  scanSegment: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "33.33%",
    opacity: 0,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});
