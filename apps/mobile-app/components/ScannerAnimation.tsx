import React, { useEffect, useRef, useCallback, useImperativeHandle } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

// Performance-optimized animation configuration
const ANIMATION_CONFIG = {
  DURATION: 2000,      // Time for one complete scan
  RESET_DURATION: 0,   // Instant reset (invisible to user)
  DELAY: 200,          // Brief pause at bottom before restarting
  EASING: Easing.inOut(Easing.ease),
  LINE_HEIGHT: 3,      // Slightly thicker line for better visibility
  LINE_OPACITY: 0.8,
  GLOW_HEIGHT: 24,     // Height of the glow effect
  GLOW_OPACITY: 0.2,   // Subtle glow
};

interface SimplifiedScannerAnimationProps {
  isActive: boolean;
  color?: string;
  speed?: number;
}

export interface SimplifiedScannerAnimationRef {
  cleanup: () => void;
  resetAnimation: () => void;
}

export const SimplifiedScannerAnimation = React.forwardRef<
  SimplifiedScannerAnimationRef,
  SimplifiedScannerAnimationProps
>((props, ref) => {
  const { isActive, color = "#4dabf7", speed = 2000 } = props;
  const { height: windowHeight } = useWindowDimensions();

  // Track position of the scanning line
  const scanPosition = useSharedValue(0);
  const isMounted = useRef(true);
  const animationActive = useRef(false);
  const containerHeight = useRef(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (!isMounted.current) return;

    cancelAnimation(scanPosition);
    animationActive.current = false;

    // Reset to starting position
    scanPosition.value = 0;
  }, [scanPosition]);

  // Reset animation function
  const resetAnimation = useCallback(() => {
    cleanup();

    // Restart if still active
    if (isActive && isMounted.current) {
      startScanAnimation();
    }
  }, [cleanup, isActive]);

  // Start the scanning animation
  const startScanAnimation = useCallback(() => {
    if (!isMounted.current || animationActive.current) return;

    animationActive.current = true;

    // Calculate actual duration based on speed prop
    const duration = typeof speed === 'number' ? speed : ANIMATION_CONFIG.DURATION;

    // Function to create one complete scan cycle (down and up)
    const createScanCycle = () => {
      // Move from top to bottom and back
      scanPosition.value = withSequence(
        // Move down
        withTiming(1, {
          duration: duration / 2,
          easing: ANIMATION_CONFIG.EASING
        }),
        // Brief pause at the bottom
        withDelay(
          ANIMATION_CONFIG.DELAY,
          // Move up
          withTiming(0, {
            duration: duration / 2,
            easing: ANIMATION_CONFIG.EASING
          })
        ),
        // Brief pause at the top
        withDelay(
          ANIMATION_CONFIG.DELAY,
          withTiming(0, {
            duration: 0,
            easing: ANIMATION_CONFIG.EASING,
            reduceMotion: undefined
          })
        )
      );

      // Setup the next cycle when this one completes
      setTimeout(() => {
        if (isMounted.current && isActive && animationActive.current) {
          createScanCycle();
        }
      }, duration + (ANIMATION_CONFIG.DELAY * 2));
    };

    // Start the first cycle
    createScanCycle();

  }, [scanPosition, speed, isActive]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      cleanup,
      resetAnimation,
    }),
    [cleanup, resetAnimation]
  );

  // Handle component unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Control animation based on isActive prop
  useEffect(() => {
    if (!isMounted.current) return;

    cleanup();

    if (isActive) {
      startScanAnimation();
    } else {
      // When not active, fade out
      scanPosition.value = withTiming(-0.1, { duration: 300 });
    }

    return cleanup;
  }, [isActive, cleanup, startScanAnimation]);

  // Animated style for the scanning line
  const scanLineStyle = useAnimatedStyle(() => {
    // Calculate position based on container height
    return {
      transform: [{ translateY: scanPosition.value * containerHeight.current }],
    };
  });

  // Animated style for the glow effect
  const glowStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: scanPosition.value * containerHeight.current - ANIMATION_CONFIG.GLOW_HEIGHT / 2 + ANIMATION_CONFIG.LINE_HEIGHT / 2 }
      ],
    };
  });

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        containerHeight.current = event.nativeEvent.layout.height;
      }}
    >
      {/* The glow effect (slightly larger, positioned behind the line) */}
      <Animated.View
        style={[
          styles.scanGlow,
          glowStyle,
          {
            backgroundColor: color,
            height: ANIMATION_CONFIG.GLOW_HEIGHT,
            opacity: ANIMATION_CONFIG.GLOW_OPACITY
          }
        ]}
      />

      {/* The main scanning line */}
      <Animated.View
        style={[
          styles.scanLine,
          scanLineStyle,
          {
            backgroundColor: color,
            height: ANIMATION_CONFIG.LINE_HEIGHT,
            opacity: ANIMATION_CONFIG.LINE_OPACITY
          }
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
    margin: 0,
    padding: 0,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    opacity: 0.8,
    margin: 0,
    padding: 0,
  },
  scanGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 12,
    margin: 0,
    padding: 0,
  }
});