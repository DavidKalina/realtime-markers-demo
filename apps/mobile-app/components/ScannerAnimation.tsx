import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
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

export const ScannerAnimation: React.FC<ScannerAnimationProps> = React.memo(
  ({ isActive, color = "#4dabf7", speed = 1500 }) => {
    // Animation value for the scanner bar position (0 to 1)
    const scanPosition = useSharedValue(0);

    // Start or stop the animation based on isActive prop
    useEffect(() => {
      if (isActive) {
        // Start the scanning animation with percentage-based positioning
        scanPosition.value = 0; // Reset to start
        scanPosition.value = withRepeat(
          withSequence(
            withTiming(100, { duration: speed, easing: Easing.inOut(Easing.ease) }),
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

    // Animated style using top percentage
    const scanLineStyle = useAnimatedStyle(() => {
      return {
        top: `${scanPosition.value}%`,
      };
    });

    // Memoize color-dependent styles
    const colorStyle = useMemo(
      () => ({
        backgroundColor: color,
        shadowColor: color,
      }),
      [color]
    );

    return (
      <View style={styles.container}>
        <Animated.View style={[styles.scanLine, scanLineStyle, colorStyle]} />
      </View>
    );
  }
);

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
