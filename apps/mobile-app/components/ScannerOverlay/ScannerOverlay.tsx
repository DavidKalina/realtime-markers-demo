import React, { useState, useEffect } from "react";
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

interface ScannerOverlayProps {
  guideText?: string;
  detectionStatus?: "none" | "detecting" | "aligned";
  isCapturing?: boolean;
  onFrameReady?: () => void;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = (props) => {
  const {
    guideText = "Position your document",
    detectionStatus = "none",
    isCapturing = false,
    onFrameReady,
  } = props;

  // Animated values
  const borderWidth = useSharedValue(2);
  const colorAnimation = useSharedValue(0);
  const cornerOpacity = useSharedValue(0.4);
  const scaleAnimation = useSharedValue(1);

  // Simple state
  const [message, setMessage] = useState(guideText);
  const [icon, setIcon] = useState<string | null>(null);
  const [scanColor, setScanColor] = useState("#4dabf7");

  // Update message and icon based on status
  useEffect(() => {
    // Cancel ongoing animations first to prevent conflicts
    cancelAnimation(colorAnimation);
    cancelAnimation(cornerOpacity);
    cancelAnimation(scaleAnimation);

    if (isCapturing) {
      setMessage("Capturing document...");
      setIcon("camera");
      colorAnimation.value = withTiming(1, { duration: 300 });
      cornerOpacity.value = withTiming(0.9, { duration: 300 });
      scaleAnimation.value = withTiming(1.05, { duration: 300 });
      setScanColor("#37D05C");
      return;
    }

    switch (detectionStatus) {
      case "none":
        setMessage(guideText);
        setIcon("move");
        colorAnimation.value = withTiming(0, { duration: 300 });
        cornerOpacity.value = withTiming(0.4, { duration: 300 });
        scaleAnimation.value = withTiming(1, { duration: 300 });
        setScanColor("#4dabf7");
        break;
      case "detecting":
        setMessage("Almost there...");
        setIcon("search");
        colorAnimation.value = withTiming(0.5, { duration: 300 });
        cornerOpacity.value = withTiming(0.6, { duration: 300 });
        scaleAnimation.value = withTiming(1.02, { duration: 300 });
        setScanColor("#4dabf7");
        break;
      case "aligned":
        setMessage("Ready to capture!");
        setIcon("check-circle");
        colorAnimation.value = withTiming(1, { duration: 300 });
        cornerOpacity.value = withTiming(0.8, { duration: 300 });
        // Pulse animation when aligned
        scaleAnimation.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.02, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          3,
          true
        );
        setScanColor("#37D05C");
        break;
    }

    // Return cleanup function for the animations in this effect
    return () => {
      cancelAnimation(colorAnimation);
      cancelAnimation(cornerOpacity);
      cancelAnimation(scaleAnimation);
    };
  }, [detectionStatus, guideText, isCapturing, colorAnimation, cornerOpacity, scaleAnimation]);

  // Animate border width
  useEffect(() => {
    // Cancel any existing animation first
    cancelAnimation(borderWidth);

    borderWidth.value = withRepeat(
      withSequence(
        withTiming(2.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Return cleanup function for this specific animation
    return () => {
      cancelAnimation(borderWidth);
    };
  }, [borderWidth]);

  // Handle callback
  useEffect(() => {
    if (detectionStatus === "aligned" && onFrameReady) {
      // Reduced the delay from 500ms to 300ms
      const timer = setTimeout(onFrameReady, 300);
      return () => clearTimeout(timer);
    }
  }, [detectionStatus, onFrameReady]);

  // Global cleanup effect to ensure all animations are canceled on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(borderWidth);
      cancelAnimation(colorAnimation);
      cancelAnimation(cornerOpacity);
      cancelAnimation(scaleAnimation);
    };
  }, [borderWidth, colorAnimation, cornerOpacity, scaleAnimation]);

  // Animated styles
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

  const cornerStyle = useAnimatedStyle(() => {
    return {
      opacity: cornerOpacity.value,
    };
  });

  // Show scanning animation when in detecting, aligned, or capturing modes
  const showScanning = detectionStatus !== "none" || isCapturing;

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
          <Feather
            name={icon as any}
            size={18}
            color={
              detectionStatus === "aligned" || isCapturing
                ? "#37D05C"
                : detectionStatus === "detecting"
                ? "#4dabf7"
                : "#f8f9fa"
            }
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={overlayStyles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
};

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
