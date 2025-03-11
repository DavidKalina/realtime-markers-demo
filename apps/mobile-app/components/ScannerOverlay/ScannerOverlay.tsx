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
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = React.memo((props) => {
  const {
    guideText = "Position your document",
    detectionStatus = "none",
    isCapturing = false,
    onFrameReady,
  } = props;

  // Refs to store timeouts
  const frameReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationsSet = useRef(false);

  // Shared values for animations - created once
  const borderWidth = useSharedValue(2);
  const colorAnimation = useSharedValue(0);
  const cornerOpacity = useSharedValue(0.4);
  const scaleAnimation = useSharedValue(1);

  // Status-dependent state
  const [message, setMessage] = useState(guideText);
  const [icon, setIcon] = useState<string | null>(null);
  const [scanColor, setScanColor] = useState("#4dabf7");

  // Create unified cleanup function to cancel all animations
  const cleanupAnimations = useCallback(() => {
    cancelAnimation(borderWidth);
    cancelAnimation(colorAnimation);
    cancelAnimation(cornerOpacity);
    cancelAnimation(scaleAnimation);
  }, [borderWidth, colorAnimation, cornerOpacity, scaleAnimation]);

  // Unified status update function
  const updateStatusVisuals = useCallback(
    (status: "none" | "detecting" | "aligned" | "capturing") => {
      if (animationsSet.current) {
        cleanupAnimations();
      }

      const config =
        status === "capturing" ? STATUS_CONFIG.capturing : STATUS_CONFIG[detectionStatus];

      // Update message
      setMessage(config.message || guideText);
      setIcon(config.icon);
      setScanColor(config.scanColor);

      // Apply animations with proper timing
      colorAnimation.value = withTiming(config.colorValue, {
        duration: ANIMATIONS.STATUS_CHANGE.DURATION,
      });

      cornerOpacity.value = withTiming(config.opacityValue, {
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
    },
    [cleanupAnimations, detectionStatus, guideText, colorAnimation, cornerOpacity, scaleAnimation]
  );

  // Update based on the component's props
  useEffect(() => {
    if (isCapturing) {
      updateStatusVisuals("capturing");
    } else {
      updateStatusVisuals(detectionStatus);
    }
  }, [detectionStatus, isCapturing, updateStatusVisuals]);

  // Separate effect for the constant border pulse animation
  useEffect(() => {
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
    if (frameReadyTimeoutRef.current) {
      clearTimeout(frameReadyTimeoutRef.current);
      frameReadyTimeoutRef.current = null;
    }

    if (detectionStatus === "aligned" && onFrameReady) {
      frameReadyTimeoutRef.current = setTimeout(onFrameReady, 300);
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
    return cleanupAnimations;
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

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: cornerOpacity.value,
  }));

  // Determine if scanning animation should be shown - memoized
  const showScanning = useMemo(
    () => detectionStatus !== "none" || isCapturing,
    [detectionStatus, isCapturing]
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
          <ScannerAnimation
            isActive={showScanning}
            color={scanColor}
            speed={isCapturing ? 1000 : 1500}
          />

          {/* Corners for additional visual guidance */}
          <Animated.View style={[overlayStyles.corner, overlayStyles.topLeft, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.topRight, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.bottomLeft, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.bottomRight, cornerStyle]} />
        </Animated.View>
      </View>

      {/* Message container with icon */}
      <Animated.View style={overlayStyles.messageContainer} entering={FadeIn.duration(400)}>
        {icon && (
          <Feather name={icon as any} size={18} color={iconColor} style={overlayStyles.icon} />
        )}
        <Text style={overlayStyles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
});

const overlayStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  frameContainer: {
    width: "85%",
    aspectRatio: 0.75,
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: 12,
    backgroundColor: "rgba(51, 51, 51, 0.1)",
    overflow: "hidden", // Important for the scanner animation
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#f8f9fa",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    color: "#f8f9fa",
    fontSize: 15,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
});
