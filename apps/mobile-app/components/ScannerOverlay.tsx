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
        break;
      case "detecting":
        setMessage("Almost there...");
        setIcon("search");
        colorAnimation.value = withTiming(0.5, { duration: 300 });
        cornerOpacity.value = withTiming(0.6, { duration: 300 });
        break;
      case "aligned":
        setMessage("Perfect!");
        setIcon("check-circle");
        colorAnimation.value = withTiming(1, { duration: 300 });
        cornerOpacity.value = withTiming(0.8, { duration: 300 });
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
    };
  });

  const cornerStyle = useAnimatedStyle(() => {
    return {
      opacity: cornerOpacity.value,
    };
  });

  return (
    <View style={styles.overlay}>
      {/* Frame container */}
      <View style={styles.frameContainer}>
        {/* Animated frame */}
        <Animated.View style={[styles.frame, frameStyle]}>
          {/* Corners for additional visual guidance */}
          <Animated.View style={[styles.corner, styles.topLeft, cornerStyle]} />
          <Animated.View style={[styles.corner, styles.topRight, cornerStyle]} />
          <Animated.View style={[styles.corner, styles.bottomLeft, cornerStyle]} />
          <Animated.View style={[styles.corner, styles.bottomRight, cornerStyle]} />
        </Animated.View>
      </View>

      {/* Message container with icon */}
      <Animated.View style={styles.messageContainer} entering={FadeIn.duration(400)}>
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
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: 8,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#f8f9fa",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 24,
  },
  message: {
    color: "#f8f9fa",
    fontSize: 15,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  icon: {
    marginRight: 8,
  },
});
