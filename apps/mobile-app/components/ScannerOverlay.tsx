import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";

interface ScannerOverlayProps {
  guideText?: string;
  detectionStatus?: "none" | "detecting" | "aligned"; // Optional status from external detection
  onFrameReady?: () => void; // Callback when frame is ready for capture
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  guideText = "Position your document within the frame",
  detectionStatus = "none",
  onFrameReady,
}) => {
  // Local state for UI feedback
  const [statusMessage, setStatusMessage] = useState(guideText);

  // Animation values
  const pulseOpacity = useSharedValue(0.5);
  const arrowOpacity = useSharedValue(1);
  const arrowOffset = useSharedValue(0);
  const frameColor = useSharedValue(0); // 0 = default, 1 = success
  const successPulse = useSharedValue(0);

  // Update UI based on detection status
  useEffect(() => {
    switch (detectionStatus) {
      case "none":
        // Default state
        frameColor.value = withTiming(0, { duration: 300 });
        arrowOpacity.value = withTiming(1, { duration: 300 });
        setStatusMessage(guideText);
        break;

      case "detecting":
        // Document being detected but not aligned
        frameColor.value = withTiming(0.5, { duration: 300 });
        arrowOpacity.value = withTiming(0.7, { duration: 300 });
        setStatusMessage("Almost there, adjust slightly...");
        break;

      case "aligned":
        // Document properly aligned
        frameColor.value = withTiming(1, { duration: 300 });
        arrowOpacity.value = withTiming(0, { duration: 300 });

        // Success pulse animation
        successPulse.value = 0;
        successPulse.value = withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 })
        );

        setStatusMessage("Perfect! Tap to capture");

        // Call onFrameReady after short delay to avoid bouncing
        if (onFrameReady) {
          const timer = setTimeout(() => {
            onFrameReady();
          }, 500);
          return () => clearTimeout(timer);
        }
        break;
    }
  }, [detectionStatus]);

  // Setup animations
  useEffect(() => {
    // Pulsing effect for the frame
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repeat
      true // Reverse
    );

    // Arrow movement animation
    arrowOffset.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Cleanup animations on unmount
    return () => {
      cancelAnimation(pulseOpacity);
      cancelAnimation(arrowOffset);
      cancelAnimation(frameColor);
      cancelAnimation(successPulse);
      cancelAnimation(arrowOpacity);
    };
  }, []);

  // Animated styles
  const frameBorderStyle = useAnimatedStyle(() => {
    // Interpolate color from yellow to green based on detection status
    const r = 255 - frameColor.value * 150;
    const g = 219;
    const b = 105 + frameColor.value * 40;

    return {
      borderColor: `rgba(${r}, ${g}, ${b}, ${pulseOpacity.value})`,
    };
  });

  const arrowAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: arrowOpacity.value,
      transform: [{ translateY: arrowOffset.value }],
    };
  });

  const successOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: successPulse.value * 0.3,
    };
  });

  return (
    <View style={styles.overlay}>
      {/* Success flash */}
      <Animated.View style={[styles.successOverlay, successOverlayStyle]} />

      {/* Frame container */}
      <View style={styles.frameContainer}>
        {/* Animated frame border */}
        <Animated.View style={[styles.frameBorder, frameBorderStyle]} />

        {/* Static corner elements */}
        <View style={styles.staticFrame}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>

        {/* Guide arrows */}
        <View style={styles.guideArrowsContainer}>
          <Animated.View style={[styles.arrowTop, arrowAnimatedStyle]}>
            <Text style={styles.arrowIndicator}>↓</Text>
          </Animated.View>

          <View style={styles.horizontalArrowsContainer}>
            <Animated.View style={[styles.arrowLeft, arrowAnimatedStyle]}>
              <Text style={styles.arrowIndicator}>→</Text>
            </Animated.View>

            <Animated.View style={[styles.arrowRight, arrowAnimatedStyle]}>
              <Text style={styles.arrowIndicator}>←</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.arrowBottom, arrowAnimatedStyle]}>
            <Text style={styles.arrowIndicator}>↑</Text>
          </Animated.View>
        </View>
      </View>

      {/* Guide text */}
      <Animated.Text style={styles.guideText}>{statusMessage}</Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(51, 51, 51, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#69db7c",
    opacity: 0,
    zIndex: 45,
  },
  frameContainer: {
    width: "85%",
    aspectRatio: 0.8, // Rectangular frame for documents
    position: "relative",
    marginTop: -50, // Adjust vertical position
  },
  staticFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  frameBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "rgba(255, 219, 105, 0.6)", // Initial yellow color
    borderStyle: "dashed",
    zIndex: 1,
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  guideArrowsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  horizontalArrowsContainer: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -15, // Adjust for arrow height
  },
  arrowTop: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
  },
  arrowBottom: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
  },
  arrowLeft: {
    marginLeft: 10,
    transform: [{ rotate: "180deg" }],
  },
  arrowRight: {
    marginRight: 10,
  },
  arrowIndicator: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  guideText: {
    color: "#FFF",
    fontSize: 16,
    marginTop: 24,
    fontWeight: "500",
    textAlign: "center",
    fontFamily: "SpaceMono",
    padding: 10,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    zIndex: 100,
  },
});
