// components/Markers/ClusterMarker.tsx
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface ClusterMarkerProps {
  count: number;
  coordinates: [number, number];
  onPress: () => void;
  isSelected?: boolean;
  isHighlighted?: boolean;
}

export const ClusterMarker: React.FC<ClusterMarkerProps> = ({
  count,
  onPress,
  isSelected = false,
  isHighlighted = false,
}) => {
  // Animation values
  const scale = useSharedValue(1);
  const floatY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const isFirstRender = useRef(true);
  const [wasSelected, setWasSelected] = useState(false);

  // Format the count for display
  const formattedCount = count > 99 ? "99+" : count.toString();

  // Determine size based on count for visual hierarchy
  const baseSize = count < 10 ? 32 : count < 50 ? 36 : 40;

  // Generate a color based on count for visual differentiation
  const getBackgroundColor = () => {
    if (count < 10) return "#333333"; // Small clusters: dark background
    if (count < 30) return "#333333"; // Medium clusters: dark background
    return "#333333"; // Large clusters: dark background
  };

  // Get accent color based on count
  const getAccentColor = () => {
    if (count < 10) return "rgba(77, 171, 247, 0.6)"; // Small clusters: blue
    if (count < 30) return "rgba(230, 119, 0, 0.6)"; // Medium clusters: orange
    return "rgba(214, 51, 132, 0.6)"; // Large clusters: pink
  };

  // Initialize animations
  useEffect(() => {
    if (isFirstRender.current) {
      scale.value = 0.5;
      scale.value = withTiming(1, { duration: 400 });
      isFirstRender.current = false;
    }

    // Start subtle floating animation
    floatY.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1, // Infinite repeats
      true // Reverse
    );

    // Return cleanup function
    return () => {
      cancelAnimation(scale);
      cancelAnimation(floatY);
    };
  }, []);

  // Handle selected state and pulse animation
  useEffect(() => {
    if (isSelected) {
      // Scale up slightly when selected
      scale.value = withTiming(1.2, { duration: 300 });

      // Pulsating ring animation
      pulseScale.value = 1;
      pulseOpacity.value = 0.7;

      pulseScale.value = withRepeat(
        withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1, // Infinite repeats
        false // Don't reverse
      );

      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.in(Easing.ease) }),
        -1, // Infinite repeats
        false // Don't reverse
      );

      setWasSelected(true);
    } else {
      // Scale back down if previously selected
      if (wasSelected) {
        scale.value = withTiming(1, { duration: 300 });
        setWasSelected(false);
      }

      pulseOpacity.value = withTiming(0, { duration: 300 });
    }

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, [isSelected]);

  // Handle highlight effect
  useEffect(() => {
    if (isHighlighted) {
      scale.value = withSequence(
        withTiming(1.1, { duration: 150 }),
        withTiming(isSelected ? 1.2 : 1, { duration: 150 })
      );
    }
  }, [isHighlighted, isSelected]);

  // Handle press with haptic feedback
  const handlePress = () => {
    Haptics.impactAsync(
      isSelected ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );

    // Cancel any ongoing scale animations before starting new ones
    cancelAnimation(scale);

    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(isSelected ? 1 : 1.2, { duration: 200 })
    );

    onPress();
  };

  // Container animation style
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { translateY: floatY.value }],
    };
  });

  // Pulse effect animation
  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    };
  });

  // Create an effect for global cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
      cancelAnimation(floatY);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, []);

  const accentColor = getAccentColor();

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
      {/* Pulsating ring */}
      {isSelected && (
        <Animated.View
          style={[
            styles.pulseRing,
            pulseStyle,
            {
              width: baseSize,
              height: baseSize,
              borderRadius: baseSize / 2,
              borderColor: accentColor,
              backgroundColor: accentColor.replace("0.6", "0.1"),
            },
          ]}
        />
      )}

      {/* Main container */}
      <Animated.View style={[styles.container, containerStyle]}>
        <View
          style={[
            styles.clusterBox,
            {
              width: baseSize,
              height: baseSize,
              borderRadius: baseSize / 2,
              backgroundColor: getBackgroundColor(),
              borderColor: accentColor,
            },
          ]}
        >
          <Text
            style={[
              styles.text,
              {
                textShadowColor: accentColor,
              },
            ]}
          >
            {formattedCount}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableArea: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  clusterBox: {
    backgroundColor: "#333333",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(77, 171, 247, 0.6)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontFamily: "SpaceMono",
    fontSize: 14,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
});
