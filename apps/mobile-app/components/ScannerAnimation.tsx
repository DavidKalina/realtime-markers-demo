import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

interface ScannerAnimationProps {
  isActive: boolean;
  color?: string;
  speed?: number;
}

export const ScannerAnimation: React.FC<ScannerAnimationProps> = ({
  isActive,
  color = "#4dabf7",
  speed = 1500,
}) => {
  // Animation value for the scanner bar position (0 to 1)
  const scanPosition = useSharedValue(0);

  // Start or stop the animation based on isActive prop
  useEffect(() => {
    if (isActive) {
      // Start the scanning animation - move from top to bottom and back
      scanPosition.value = withRepeat(
        withSequence(
          withTiming(1, { duration: speed, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: speed, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repetitions
        false // Don't reverse
      );
    } else {
      // Stop the animation
      cancelAnimation(scanPosition);
      scanPosition.value = withTiming(0, { duration: 300 });
    }

    // Clean up on unmount
    return () => {
      cancelAnimation(scanPosition);
    };
  }, [isActive, speed]);

  // Animated style for the scanner bar - using a numeric transform value
  const scanLineStyle = useAnimatedStyle(() => {
    // Get the container height to calculate the actual translation amount
    // This ensures the scan line moves from top to bottom
    return {
      transform: [{ translateY: scanPosition.value * 1000 - 2 }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.scanLine, scanLineStyle, { backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    zIndex: 5,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#4dabf7",
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
});
