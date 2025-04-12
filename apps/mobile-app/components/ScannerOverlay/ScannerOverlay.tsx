import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { SimplifiedScannerAnimation } from "@/components/ScannerAnimation";

// Add unified color theme at the top
const COLORS = {
  accent: "#93c5fd",
};

// Animation configurations - defined outside component to prevent recreation
const ANIMATIONS = {
  BORDER_PULSE: {
    DURATION: 2000,
    EASING: Easing.bezier(0.4, 0, 0.2, 1),
  },
};

interface ScannerOverlayProps {
  detectionStatus?: "none" | "detecting" | "aligned";
  isCapturing?: boolean;
  onFrameReady?: () => void;
  showScannerAnimation?: boolean;
}

export interface ScannerOverlayRef {
  cleanup: () => void;
  resetAnimations: () => void;
}

export const ScannerOverlay = React.forwardRef<ScannerOverlayRef, ScannerOverlayProps>(
  (props, ref) => {
    const {
      detectionStatus = "none",
      isCapturing = false,
      onFrameReady,
      showScannerAnimation = true,
    } = props;

    const isMounted = useRef(true);

    // Animation registry for tracking all animations
    const animationRegistry = useRef(new Set<Animated.SharedValue<number>>()).current;
    const timeoutRegistry = useRef(new Set<NodeJS.Timeout>()).current;
    const animFrameRegistry = useRef(new Set<number>()).current;

    // Register animation with the registry
    const registerAnimation = useCallback((animation: Animated.SharedValue<number>) => {
      if (isMounted.current) {
        animationRegistry.add(animation);
      }
      return animation;
    }, [animationRegistry]);

    // Register timeout with the registry
    const registerTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
      if (isMounted.current) {
        timeoutRegistry.add(timeoutId);
      }
      return timeoutId;
    }, [timeoutRegistry]);

    // Register animation frame with the registry
    const registerAnimFrame = useCallback((animFrameId: number) => {
      if (isMounted.current) {
        animFrameRegistry.add(animFrameId);
      }
      return animFrameId;
    }, [animFrameRegistry]);

    // Create functional cleanup function to cancel all animations
    const cleanupAnimations = useCallback(() => {
      if (!isMounted.current) return;

      // Cancel all animations
      animationRegistry.forEach(animation => {
        cancelAnimation(animation);
      });
      animationRegistry.clear();

      // Clear all timeouts
      timeoutRegistry.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRegistry.clear();

      // Cancel all animation frames
      animFrameRegistry.forEach(animFrameId => {
        cancelAnimationFrame(animFrameId);
      });
      animFrameRegistry.clear();
    }, [animationRegistry, timeoutRegistry, animFrameRegistry]);

    // Reset animations without cancelling them
    const resetAnimations = useCallback(() => {
      if (!isMounted.current) return;

      // Clear registries without cancelling animations
      animationRegistry.clear();
      timeoutRegistry.clear();
      animFrameRegistry.clear();
    }, [animationRegistry, timeoutRegistry, animFrameRegistry]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      cleanup: cleanupAnimations,
      resetAnimations,
    }), [cleanupAnimations, resetAnimations]);

    // Set isMounted to false when component unmounts
    useEffect(() => {
      return () => {
        isMounted.current = false;
        cleanupAnimations();
      };
    }, [cleanupAnimations]);

    // Handle frame ready callback with proper timeout tracking
    useEffect(() => {
      if (!isMounted.current) return;

      // Clear any existing timeouts
      timeoutRegistry.forEach(id => {
        clearTimeout(id);
        timeoutRegistry.delete(id);
      });

      if (detectionStatus === "aligned" && onFrameReady) {
        const timeoutId = setTimeout(() => {
          if (isMounted.current && onFrameReady) {
            onFrameReady();
          }
          timeoutRegistry.delete(timeoutId);
        }, 300);

        registerTimeout(timeoutId);
      }

      return () => {
        timeoutRegistry.forEach(id => {
          clearTimeout(id);
        });
        timeoutRegistry.clear();
      };
    }, [detectionStatus, onFrameReady, timeoutRegistry, registerTimeout]);

    // AnimatedBoundary component with proper animation tracking
    const AnimatedBoundary = useCallback(() => {
      const borderWidth = useSharedValue(2);
      const isMounted = useRef(true);

      useEffect(() => {
        if (!isMounted.current) return;

        // Start animation with registered value
        const animFrameId = requestAnimationFrame(() => {
          registerAnimation(borderWidth);

          borderWidth.value = withRepeat(
            withSequence(
              withTiming(2.5, {
                duration: ANIMATIONS.BORDER_PULSE.DURATION,
                easing: ANIMATIONS.BORDER_PULSE.EASING,
              }),
              withTiming(2, {
                duration: ANIMATIONS.BORDER_PULSE.DURATION,
                easing: ANIMATIONS.BORDER_PULSE.EASING,
              })
            ),
            -1,
            true
          );
        });

        registerAnimFrame(animFrameId);

        return () => {
          isMounted.current = false;
          cancelAnimationFrame(animFrameId);
          cancelAnimation(borderWidth);
        };
      }, [registerAnimation, registerAnimFrame]);

      const animatedStyle = useAnimatedStyle(() => ({
        borderWidth: borderWidth.value
      }));

      return (
        <Animated.View
          style={[
            overlayStyles.boundary,
            animatedStyle
          ]}
        />
      );
    }, [registerAnimation, registerAnimFrame]);

    // ScannerAnimationContainer with proper memoization
    const ScannerAnimationContainer = useMemo(() => {
      if (!showScannerAnimation) return null;

      // Always show scanning animation when capturing
      const showScanning = isCapturing;

      const scannerAnimationProps = {
        isActive: showScanning,
        color: COLORS.accent,
        speed: 2000, // Fixed 2 second duration
      };

      return (
        <View style={overlayStyles.scannerContainer}>
          <SimplifiedScannerAnimation {...scannerAnimationProps} />
        </View>
      );
    }, [isCapturing, showScannerAnimation]);

    return (
      <View style={overlayStyles.container}>
        <View style={overlayStyles.frame}>
          <AnimatedBoundary />
          {ScannerAnimationContainer}
        </View>
      </View>
    );
  }
);

const overlayStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    margin: 0,
    padding: 0,
  },
  frame: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    margin: 0,
    padding: 0,
  },
  boundary: {
    position: "absolute",
    top: "2%",
    left: "2%",
    right: "2%",
    bottom: "2%",
    borderColor: `${COLORS.accent}90`,
    borderRadius: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    margin: 0,
    padding: 0,
  },
  scannerContainer: {
    position: "absolute",
    top: "2%",
    left: "2%",
    right: "2%",
    bottom: "2%",
    overflow: "hidden",
    borderRadius: 20,
    margin: 0,
    padding: 0,
  },
});