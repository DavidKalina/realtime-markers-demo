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
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { styles } from "./RefactoredAssistant/styles";

interface ScannerOverlayProps {
  guideText?: string;
  detectionStatus?: "none" | "detecting" | "aligned";
  onFrameReady?: () => void;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = (props) => {
  const { guideText = "Position your document", detectionStatus = "none", onFrameReady } = props;

  // Animated values
  const borderWidth = useSharedValue(2);
  const colorAnimation = useSharedValue(0);
  const cornerOpacity = useSharedValue(0.4);
  const scaleAnimation = useSharedValue(1);

  // Simple state
  const [message, setMessage] = useState(guideText);
  const [icon, setIcon] = useState<string | null>(null);

  // Update message and icon based on status
  useEffect(() => {
    switch (detectionStatus) {
      case "none":
        setMessage(guideText);
        setIcon("move");
        colorAnimation.value = withTiming(0, { duration: 300 });
        cornerOpacity.value = withTiming(0.4, { duration: 300 });
        scaleAnimation.value = withTiming(1, { duration: 300 });
        break;
      case "detecting":
        setMessage("Almost there...");
        setIcon("search");
        colorAnimation.value = withTiming(0.5, { duration: 300 });
        cornerOpacity.value = withTiming(0.6, { duration: 300 });
        scaleAnimation.value = withTiming(1.02, { duration: 300 });
        break;
      case "aligned":
        setMessage("Perfect!");
        setIcon("check-circle");
        colorAnimation.value = withTiming(1, { duration: 300 });
        cornerOpacity.value = withTiming(0.8, { duration: 300 });
        scaleAnimation.value = withTiming(1.05, { duration: 300 });
        // Pulse animation when aligned
        scaleAnimation.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.02, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          3,
          true
        );
        break;
    }
  }, [detectionStatus, guideText]);

  // Animate border width
  useEffect(() => {
    borderWidth.value = withRepeat(
      withSequence(
        withTiming(2.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  // Handle callback
  useEffect(() => {
    if (detectionStatus === "aligned" && onFrameReady) {
      const timer = setTimeout(onFrameReady, 500);
      return () => clearTimeout(timer);
    }
  }, [detectionStatus, onFrameReady]);

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

  return (
    <View style={overlayStyles.overlay}>
      {/* Frame container */}
      <View style={overlayStyles.frameContainer}>
        {/* Animated frame */}
        <Animated.View style={[overlayStyles.frame, frameStyle]}>
          {/* Corners for additional visual guidance */}
          <Animated.View style={[overlayStyles.corner, overlayStyles.topLeft, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.topRight, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.bottomLeft, cornerStyle]} />
          <Animated.View style={[overlayStyles.corner, overlayStyles.bottomRight, cornerStyle]} />
        </Animated.View>
      </View>

      {/* Message container with icon - updated to match app styles */}
      <Animated.View style={overlayStyles.messageContainer} entering={FadeIn.duration(400)}>
        {icon && (
          <Feather
            name={icon as any}
            size={18}
            color={
              detectionStatus === "aligned"
                ? "#37D05C"
                : detectionStatus === "detecting"
                ? "#4dabf7"
                : "#f8f9fa"
            }
            style={styles.icon}
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
    borderRadius: 12, // Updated to match app's rounded corners (16px in cards, 12px in details)
    backgroundColor: "rgba(51, 51, 51, 0.1)", // Slight background tint that matches #333
  },
  corner: {
    position: "absolute",
    width: 24, // Slightly larger for better visibility
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
    backgroundColor: "#333", // Matches the card background color in the app
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12, // Match app's border radius
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#3a3a3a", // Subtle border like in other components
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  message: {
    color: "#f8f9fa",
    fontSize: 15,
    fontFamily: "SpaceMono", // Using your app's font
    fontWeight: "500",
  },
});
