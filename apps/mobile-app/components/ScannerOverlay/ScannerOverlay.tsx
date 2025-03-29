import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
    colorValue: 0,
    scaleValue: 1,
    scanColor: "#4dabf7",
    overlayOpacity: 0.3,
  },
  detecting: {
    colorValue: 0.5,
    scaleValue: 1.02,
    scanColor: "#4dabf7",
    overlayOpacity: 0.4,
  },
  aligned: {
    colorValue: 1,
    scaleValue: 1.02,
    scanColor: "#37D05C",
    overlayOpacity: 0.5,
  },
  capturing: {
    colorValue: 1,
    scaleValue: 1.05,
    scanColor: "#37D05C",
    overlayOpacity: 0.6,
  },
};

interface ScannerOverlayProps {
  detectionStatus?: "none" | "detecting" | "aligned";
  isCapturing?: boolean;
  onFrameReady?: () => void;
  showScannerAnimation?: boolean;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = React.memo((props) => {
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

  // Shared values for animations - created once
  const borderWidth = useSharedValue(2);
  const colorAnimation = useSharedValue(0);
  const scaleAnimation = useSharedValue(1);
  const overlayOpacity = useSharedValue(0.3);

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
    cancelAnimation(overlayOpacity);

    if (frameReadyTimeoutRef.current) {
      clearTimeout(frameReadyTimeoutRef.current);
      frameReadyTimeoutRef.current = null;
    }
  }, [borderWidth, colorAnimation, scaleAnimation, overlayOpacity]);

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
        colorAnimation.value = withTiming(config.colorValue, {
          duration: ANIMATIONS.STATUS_CHANGE.DURATION,
        });

        overlayOpacity.value = withTiming(config.overlayOpacity, {
          duration: ANIMATIONS.STATUS_CHANGE.DURATION,
        });

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
      isMounted.current = false;
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

  // Animated overlay style
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

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
            <ScannerAnimation
              isActive={showScanning}
              color={scanColor}
              speed={isCapturing ? 1000 : 1500}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
});

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
    borderRadius: 12,
  },
  boundary: {
    position: "absolute",
    top: "3%",
    left: "3%",
    right: "3%",
    bottom: "3%",
    borderWidth: 3,
    borderColor: "#00f2ff",
    borderRadius: 12,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  scannerContainer: {
    position: "absolute",
    top: "3%",
    left: "3%",
    right: "3%",
    bottom: "3%",
    overflow: "hidden",
  }
});
