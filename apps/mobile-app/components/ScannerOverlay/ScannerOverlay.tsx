import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  withSequence,
  interpolateColor,
  FadeIn,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ScannerAnimation } from "@/components/ScannerAnimation";

// Animation configurations - defined outside component to prevent recreation
const ANIMATIONS: any = {
  BORDER_PULSE: {
    DURATION: 1500,
    EASING: Easing.inOut(Easing.ease),
  },
  STATUS_CHANGE: {
    DURATION: 300,
  },
  ALIGNED_PULSE: {
    DURATION: 400,
    EASING: Easing.inOut(Easing.ease),
  },
};

// Status configurations for cleaner code
const STATUS_CONFIG = {
  none: {
    message: null, // Use default message
    icon: "move",
    colorValue: 0,
    opacityValue: 0.4,
    scaleValue: 1,
    scanColor: "#4dabf7",
  },
  detecting: {
    message: "Almost there...",
    icon: "search",
    colorValue: 0.5,
    opacityValue: 0.6,
    scaleValue: 1.02,
    scanColor: "#4dabf7",
  },
  aligned: {
    message: "Ready to capture!",
    icon: "check-circle",
    colorValue: 1,
    opacityValue: 0.8,
    scaleValue: 1.02, // Base scale before pulse
    scanColor: "#37D05C",
  },
  capturing: {
    message: "Capturing document...",
    icon: "camera",
    colorValue: 1,
    opacityValue: 0.9,
    scaleValue: 1.05,
    scanColor: "#37D05C",
  },
};

interface ScannerOverlayProps {
  guideText?: string;
  detectionStatus?: "none" | "detecting" | "aligned";
  isCapturing?: boolean;
  onFrameReady?: () => void;
  showScannerAnimation?: boolean; // New prop to control the visibility of scanner animation
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = React.memo((props) => {
  const {
    guideText = "Position your document",
    detectionStatus = "none",
    isCapturing = false,
    onFrameReady,
    showScannerAnimation = true, // Default to true for backward compatibility
  } = props;

  // Refs to store timeouts and track component mounted state
  const frameReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationsSet = useRef(false);
  const isMounted = useRef(true); // Track if component is mounted

  // Shared values for animations - created once
  const borderWidth = useSharedValue(2);
  const colorAnimation = useSharedValue(0);
  const scaleAnimation = useSharedValue(1);

  // Status-dependent state
  const [scanColor, setScanColor] = useState("#4dabf7");

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Create unified cleanup function to cancel all animations
  const cleanupAnimations = useCallback(() => {
    if (!isMounted.current) return;

    cancelAnimation(borderWidth);
    cancelAnimation(colorAnimation);
    cancelAnimation(scaleAnimation);

    // Clear any pending timeouts
    if (frameReadyTimeoutRef.current) {
      clearTimeout(frameReadyTimeoutRef.current);
      frameReadyTimeoutRef.current = null;
    }
  }, [borderWidth, colorAnimation, scaleAnimation]);

  // Unified status update function
  const updateStatusVisuals = useCallback(
    (status: "none" | "detecting" | "aligned" | "capturing") => {
      if (!isMounted.current) return;

      if (animationsSet.current) {
        cleanupAnimations();
      }

      const config =
        status === "capturing" ? STATUS_CONFIG.capturing : STATUS_CONFIG[detectionStatus];

      // Update scan color if component is still mounted
      if (isMounted.current) {
        setScanColor(config.scanColor);
      }

      // Apply animations with proper timing - ensure component is mounted
      if (isMounted.current) {
        colorAnimation.value = withTiming(config.colorValue, {
          duration: ANIMATIONS.STATUS_CHANGE.DURATION,
        });

        // Special pulse animation for aligned state
        if (status === "aligned") {
          scaleAnimation.value = withRepeat(
            withSequence(
              withTiming(1.05, ANIMATIONS.ALIGNED_PULSE),
              withTiming(config.scaleValue, ANIMATIONS.ALIGNED_PULSE)
            ),
            3,
            true
          );
        } else {
          scaleAnimation.value = withTiming(config.scaleValue, {
            duration: ANIMATIONS.STATUS_CHANGE.DURATION,
          });
        }

        animationsSet.current = true;
      }
    },
    [cleanupAnimations, detectionStatus, colorAnimation, scaleAnimation]
  );

  // Update based on the component's props
  useEffect(() => {
    if (!isMounted.current) return;

    if (isCapturing) {
      updateStatusVisuals("capturing");
    } else {
      updateStatusVisuals(detectionStatus);
    }

    // Cleanup on unmount or props change
    return cleanupAnimations;
  }, [detectionStatus, isCapturing, updateStatusVisuals, cleanupAnimations]);

  // Separate effect for the constant border pulse animation
  useEffect(() => {
    if (!isMounted.current) return;

    borderWidth.value = withRepeat(
      withSequence(
        withTiming(2.5, ANIMATIONS.BORDER_PULSE),
        withTiming(2, ANIMATIONS.BORDER_PULSE)
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(borderWidth);
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

  // Master cleanup effect
  useEffect(() => {
    return () => {
      // Set mounted flag to false first
      isMounted.current = false;

      // Then run cleanup
      cleanupAnimations();
    };
  }, [cleanupAnimations]);

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
  });

  // Determine if scanning animation should be shown - memoized
  // Now respects the showScannerAnimation prop
  const showScanning = useMemo(
    () => showScannerAnimation && (detectionStatus !== "none" || isCapturing),
    [detectionStatus, isCapturing, showScannerAnimation]
  );

  // Compute icon color - memoized
  const iconColor = useMemo(() => {
    if (detectionStatus === "aligned" || isCapturing) return "#37D05C";
    if (detectionStatus === "detecting") return "#4dabf7";
    return "#f8f9fa";
  }, [detectionStatus, isCapturing]);

  return (
    <View style={overlayStyles.overlay}>
      {/* Frame container */}
      <View style={overlayStyles.frameContainer}>
        {/* Animated frame */}
        <Animated.View style={[overlayStyles.frame, frameStyle]}>
          {/* Scanner animation component */}
          {showScannerAnimation && (
            <ScannerAnimation
              isActive={showScanning}
              color={scanColor}
              speed={isCapturing ? 1000 : 1500}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
});

const overlayStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  frameContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: "100%",
    height: "100%",
    position: "relative",
    backgroundColor: "rgba(51, 51, 51, 0.1)",
    overflow: "hidden",
    borderRadius: 12,
  },
});
