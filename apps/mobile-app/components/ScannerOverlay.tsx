import React, { useEffect } from "react";
import { StyleSheet, View, Text, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ScannerOverlayProps {
  guideText?: string;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  guideText = "Position your document within the frame",
}) => {
  // Animation values
  const pulseOpacity = useSharedValue(0.5);
  const arrowOffset = useSharedValue(0);
  const textOpacity = useSharedValue(1);

  // Setup animations
  useEffect(() => {
    // Pulsing effect for the frame opacity
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
  }, []);

  // Animated styles
  const frameAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  const arrowAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: arrowOffset.value }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
    };
  });

  return (
    <View style={styles.overlay}>
      {/* Container for the scan frame */}
      <View style={styles.frameContainer}>
        {/* Animated frame border */}
        <Animated.View style={[styles.frameBorder, frameAnimatedStyle]} />

        {/* Static corner elements */}
        <View style={styles.staticFrame}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>

        {/* Guide arrows - separate from frame to avoid transform conflicts */}
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
      <Animated.Text style={[styles.guideText, textAnimatedStyle]}>{guideText}</Animated.Text>
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
    borderColor: "rgba(105, 219, 124, 0.6)",
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
