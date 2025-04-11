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
    DURATION: 1500,
    EASING: Easing.bezier(0.4, 0, 0.2, 1),
  },
};

// Memoized AnimatedBoundary component
const AnimatedBoundary = React.memo(() => {
  const borderWidth = useSharedValue(2);
  const animationRef = useRef<number>();

  useEffect(() => {
    const startAnimation = () => {
      animationRef.current = requestAnimationFrame(() => {
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
    };

    startAnimation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      cancelAnimation(borderWidth);
    };
  }, [borderWidth]);

  return (
    <Animated.View
      style={[
        overlayStyles.boundary,
        { borderWidth: borderWidth }
      ]}
    />
  );
});

// Memoized ScannerAnimationContainer component
const ScannerAnimationContainer = React.memo(({
  showScannerAnimation,
  detectionStatus,
  isCapturing
}: {
  showScannerAnimation: boolean;
  detectionStatus: "none" | "detecting" | "aligned";
  isCapturing: boolean;
}) => {
  const showScanning = useMemo(
    () => showScannerAnimation && (detectionStatus !== "none" || isCapturing),
    [detectionStatus, isCapturing, showScannerAnimation]
  );

  const scannerAnimationProps = useMemo(() => ({
    isActive: showScanning,
    color: COLORS.accent,
    speed: isCapturing ? 1000 : 1500,
  }), [showScanning, isCapturing]);

  if (!showScannerAnimation) return null;

  return (
    <View style={overlayStyles.scannerContainer}>
      <SimplifiedScannerAnimation {...scannerAnimationProps} />
    </View>
  );
});

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

// Custom hook for frame ready callback
const useFrameReadyCallback = (
  detectionStatus: "none" | "detecting" | "aligned",
  onFrameReady?: () => void
) => {
  const frameReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
};

export const ScannerOverlay = React.forwardRef<ScannerOverlayRef, ScannerOverlayProps>(
  (props, ref) => {
    const {
      detectionStatus = "none",
      isCapturing = false,
      onFrameReady,
      showScannerAnimation = true,
    } = props;

    const isMounted = useRef(true);

    // Create unified cleanup function to cancel all animations
    const cleanupAnimations = useCallback(() => {
      if (!isMounted.current) return;
    }, []);

    // Reset animations without cancelling them
    const resetAnimations = useCallback(() => {
      if (!isMounted.current) return;
    }, []);

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

    // Use the custom hook for frame ready callback
    useFrameReadyCallback(detectionStatus, onFrameReady);

    return (
      <View style={overlayStyles.container}>
        <View style={overlayStyles.frame}>
          <AnimatedBoundary />
          <ScannerAnimationContainer
            showScannerAnimation={showScannerAnimation}
            detectionStatus={detectionStatus}
            isCapturing={isCapturing}
          />
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
