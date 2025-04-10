import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  withSequence,
  interpolateColor,
  cancelAnimation,
} from "react-native-reanimated";
import { SimplifiedScannerAnimation } from "@/components/ScannerAnimation";

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

// Animation configurations - defined outside component to prevent recreation
const ANIMATIONS = {
  BORDER_PULSE: {
    DURATION: 1500,
    EASING: Easing.bezier(0.4, 0, 0.2, 1),
  },
  STATUS_CHANGE: {
    DURATION: 300,
    EASING: Easing.bezier(0.4, 0, 0.2, 1),
  },
  ALIGNED_PULSE: {
    DURATION: 400,
    EASING: Easing.bezier(0.4, 0, 0.2, 1),
  },
};

// Update status configurations
const STATUS_CONFIG = {
  none: {
    colorValue: 0,
    scaleValue: 1,
    scanColor: COLORS.accent,
    overlayOpacity: 0.3,
  },
  detecting: {
    colorValue: 0.5,
    scaleValue: 1.02,
    scanColor: COLORS.accent,
    overlayOpacity: 0.4,
  },
  aligned: {
    colorValue: 1,
    scaleValue: 1.02,
    scanColor: COLORS.accent,
    overlayOpacity: 0.5,
  },
  capturing: {
    colorValue: 1,
    scaleValue: 1.05,
    scanColor: COLORS.accent,
    overlayOpacity: 0.6,
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

    // Refs to store timeouts and track component mounted state
    const frameReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationsSet = useRef(false);
    const isMounted = useRef(true);
    const animationRefs = useRef<{
      border?: ReturnType<typeof withRepeat>;
      color?: ReturnType<typeof withTiming>;
      scale?: ReturnType<typeof withTiming | typeof withRepeat>;
      overlay?: ReturnType<typeof withTiming>;
    }>({});

    // Shared values for animations - created once
    const borderWidth = useSharedValue(2);
    const colorAnimation = useSharedValue(0);
    const scaleAnimation = useSharedValue(1);
    const overlayOpacity = useSharedValue(0.3);

    // Status-dependent state
    const [scanColor, setScanColor] = useState(COLORS.accent);

    // Create unified cleanup function to cancel all animations
    const cleanupAnimations = useCallback(() => {
      if (!isMounted.current) return;

      // Cancel all Reanimated animations
      cancelAnimation(borderWidth);
      cancelAnimation(colorAnimation);
      cancelAnimation(scaleAnimation);
      cancelAnimation(overlayOpacity);

      // Clear any pending timeouts
      if (frameReadyTimeoutRef.current) {
        clearTimeout(frameReadyTimeoutRef.current);
        frameReadyTimeoutRef.current = null;
      }

      // Reset all animation values to their initial states
      borderWidth.value = 2;
      colorAnimation.value = 0;
      scaleAnimation.value = 1;
      overlayOpacity.value = 0.3;

      // Reset scan color to initial state
      setScanColor(COLORS.accent);

      // Clear animation refs
      animationRefs.current = {};

      // Mark animations as not set
      animationsSet.current = false;
    }, [borderWidth, colorAnimation, scaleAnimation, overlayOpacity]);

    // Reset animations without cancelling them
    const resetAnimations = useCallback(() => {
      if (!isMounted.current) return;

      // Reset all animation values to their initial states
      borderWidth.value = 2;
      colorAnimation.value = 0;
      scaleAnimation.value = 1;
      overlayOpacity.value = 0.3;

      // Reset scan color to initial state
      setScanColor(COLORS.accent);

      // Clear animation refs
      animationRefs.current = {};

      // Mark animations as not set
      animationsSet.current = false;
    }, [borderWidth, colorAnimation, scaleAnimation, overlayOpacity]);

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

    // Unified status update function
    const updateStatusVisuals = useCallback(
      (status: "none" | "detecting" | "aligned" | "capturing") => {
        if (!isMounted.current) return;

        if (animationsSet.current) {
          cleanupAnimations();
        }

        const config =
          status === "capturing" ? STATUS_CONFIG.capturing : STATUS_CONFIG[detectionStatus];

        if (isMounted.current) {
          setScanColor(config.scanColor);
        }

        if (isMounted.current) {
          // Color animation
          animationRefs.current.color = withTiming(config.colorValue, {
            duration: ANIMATIONS.STATUS_CHANGE.DURATION,
            easing: ANIMATIONS.STATUS_CHANGE.EASING,
          });
          colorAnimation.value = animationRefs.current.color;

          // Overlay opacity animation
          animationRefs.current.overlay = withTiming(config.overlayOpacity, {
            duration: ANIMATIONS.STATUS_CHANGE.DURATION,
            easing: ANIMATIONS.STATUS_CHANGE.EASING,
          });
          overlayOpacity.value = animationRefs.current.overlay;

          // Scale animation
          if (status === "aligned") {
            animationRefs.current.scale = withRepeat(
              withSequence(
                withTiming(1.05, {
                  duration: ANIMATIONS.ALIGNED_PULSE.DURATION,
                  easing: ANIMATIONS.ALIGNED_PULSE.EASING,
                }),
                withTiming(config.scaleValue, {
                  duration: ANIMATIONS.ALIGNED_PULSE.DURATION,
                  easing: ANIMATIONS.ALIGNED_PULSE.EASING,
                })
              ),
              3,
              true
            );
          } else {
            animationRefs.current.scale = withTiming(config.scaleValue, {
              duration: ANIMATIONS.STATUS_CHANGE.DURATION,
              easing: ANIMATIONS.STATUS_CHANGE.EASING,
            });
          }
          scaleAnimation.value = animationRefs.current.scale;

          animationsSet.current = true;
        }
      },
      [cleanupAnimations, detectionStatus, colorAnimation, scaleAnimation, overlayOpacity]
    );

    // Update based on the component's props
    useEffect(() => {
      if (!isMounted.current) return;

      if (isCapturing) {
        updateStatusVisuals("capturing");
      } else {
        updateStatusVisuals(detectionStatus);
      }

      return cleanupAnimations;
    }, [detectionStatus, isCapturing, updateStatusVisuals, cleanupAnimations]);

    // Separate effect for the constant border pulse animation
    useEffect(() => {
      if (!isMounted.current) return;

      animationRefs.current.border = withRepeat(
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
      borderWidth.value = animationRefs.current.border;

      return () => {
        cancelAnimation(borderWidth);
        borderWidth.value = 2; // Reset to initial value
        animationRefs.current.border = undefined;
      };
    }, [borderWidth]);

    // Handle the frame ready callback
    useEffect(() => {
      if (!isMounted.current) return;

      if (frameReadyTimeoutRef.current) {
        clearTimeout(frameReadyTimeoutRef.current);
        frameReadyTimeoutRef.current = null;
      }

      if (detectionStatus === "aligned" && onFrameReady) {
        frameReadyTimeoutRef.current = setTimeout(() => {
          if (isMounted.current && onFrameReady) {
            onFrameReady();
          }
        }, 300);
      }

      return () => {
        if (frameReadyTimeoutRef.current) {
          clearTimeout(frameReadyTimeoutRef.current);
          frameReadyTimeoutRef.current = null;
        }
      };
    }, [detectionStatus, onFrameReady]);

    // Memoized animated styles
    const frameStyle = useAnimatedStyle(() => {
      const borderColor = interpolateColor(
        colorAnimation.value,
        [0, 0.5, 1],
        ["#868e96", "#4dabf7", "#37D05C"]
      );

      return {
        borderWidth: borderWidth.value,
        borderColor,
        transform: [{ scale: scaleAnimation.value }],
      };
    }, []);

    // Animated overlay style
    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }), []);

    // Determine if scanning animation should be shown - memoized
    const showScanning = useMemo(
      () => showScannerAnimation && (detectionStatus !== "none" || isCapturing),
      [detectionStatus, isCapturing, showScannerAnimation]
    );

    return (
      <View style={overlayStyles.container}>
        <Animated.View style={[overlayStyles.frame, frameStyle]}>
          <View style={overlayStyles.boundary} />
          <Animated.View style={[overlayStyles.overlay, overlayStyle]} />
          {showScannerAnimation && (
            <View style={overlayStyles.scannerContainer}>
              <SimplifiedScannerAnimation
                isActive={showScanning}
                color={scanColor}
                speed={isCapturing ? 1000 : 1500}
              />
            </View>
          )}
        </Animated.View>
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
  },
  frame: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
  },
  boundary: {
    position: "absolute",
    top: "3%",
    left: "3%",
    right: "3%",
    bottom: "3%",
    borderWidth: 2,
    borderColor: `${COLORS.accent}80`,
    borderRadius: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderRadius: 20,
  },
  scannerContainer: {
    position: "absolute",
    top: "3%",
    left: "3%",
    right: "3%",
    bottom: "3%",
    overflow: "hidden",
    borderRadius: 20,
  },
});
