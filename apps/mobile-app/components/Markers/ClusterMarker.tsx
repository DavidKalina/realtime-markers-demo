import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
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

// Styled sub-components to reduce re-renders
const PulseRing = React.memo(({ style }: { style: any }) => <Animated.View style={style} />);

const ClusterText = React.memo(({ text, style }: { text: string; style: any }) => (
  <Text style={style}>{text}</Text>
));

export const ClusterMarker: React.FC<ClusterMarkerProps> = React.memo(
  ({ count, onPress, isSelected = false, isHighlighted = false }, prevProps) => {
    // Animation values stored in a ref for better organization
    const animationsRef = useRef({
      scale: useSharedValue(1),
      floatY: useSharedValue(0),
      rotation: useSharedValue(0),
      pulseScale: useSharedValue(1),
      pulseOpacity: useSharedValue(0),
    });

    // Destructure for cleaner code
    const { scale, floatY, rotation, pulseScale, pulseOpacity } = animationsRef.current;

    const isFirstRender = useRef(true);
    const [wasSelected, setWasSelected] = useState(false);
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Format the count for display
    const formattedCount = useMemo(() => (count > 99 ? "99+" : count.toString()), [count]);

    // Determine size based on count for visual hierarchy - memoized
    const baseSize = useMemo(() => (count < 10 ? 40 : count < 50 ? 45 : 50), [count]);

    // Inner circle size
    const innerSize = useMemo(() => baseSize * 0.7, [baseSize]);

    // Generate colors based on count for visual differentiation - memoized
    const { gradientColors, accentColor, pulseColor } = useMemo(() => {
      // Color scheme based on count
      let gradient;
      let accent;
      let pulse;

      if (count < 10) {
        // Small clusters: blue theme
        gradient = ["#4dabf7", "#3793dd"];
        accent = "rgba(77, 171, 247, 0.8)";
        pulse = "rgba(77, 171, 247, 0.3)";
      } else if (count < 30) {
        // Medium clusters: orange theme
        gradient = ["#ff9f43", "#ee8130"];
        accent = "rgba(255, 159, 67, 0.8)";
        pulse = "rgba(255, 159, 67, 0.3)";
      } else {
        // Large clusters: pink theme
        gradient = ["#fd79a8", "#e84393"];
        accent = "rgba(253, 121, 168, 0.8)";
        pulse = "rgba(253, 121, 168, 0.3)";
      }

      return { gradientColors: gradient, accentColor: accent, pulseColor: pulse };
    }, [count]);

    // Initialize animations - only run once
    useEffect(() => {
      if (isFirstRender.current) {
        // Initial pop-in animation
        scale.value = 0.5;
        scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
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

      // Add subtle rotation animation
      rotation.value = withRepeat(
        withSequence(
          withTiming(0.03, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(-0.03, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1, // Infinite repeats
        true // Reverse
      );

      // Return cleanup function
      return () => {
        cancelAnimation(scale);
        cancelAnimation(floatY);
        cancelAnimation(rotation);
      };
    }, []);

    // Handle selected state and pulse animation - only run when selection state changes
    useEffect(() => {
      // Only run animation when selection state changes
      const selectionChanged = isSelected !== prevSelectedRef.current;
      if (!selectionChanged) return;

      // Update ref
      prevSelectedRef.current = isSelected;

      if (isSelected) {
        // Scale up slightly when selected
        scale.value = withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(1.2)) });

        // Pulsating ring animation
        pulseScale.value = 1;
        pulseOpacity.value = 0.7;

        pulseScale.value = withRepeat(
          withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
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

    // Handle highlight effect - only run when highlight state changes
    useEffect(() => {
      // Only run animation when highlight state changes
      const highlightChanged = isHighlighted !== prevHighlightedRef.current;
      if (!highlightChanged) return;

      // Update ref
      prevHighlightedRef.current = isHighlighted;

      if (isHighlighted) {
        scale.value = withSequence(
          withTiming(1.1, { duration: 150 }),
          withTiming(isSelected ? 1.2 : 1, { duration: 150 })
        );
      }
    }, [isHighlighted, isSelected]);

    // Handle press with haptic feedback - memoized
    const handlePress = useCallback(() => {
      Haptics.impactAsync(
        isSelected ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );

      // Cancel any ongoing scale animations before starting new ones
      cancelAnimation(scale);

      scale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(isSelected ? 1 : 1.2, { duration: 200, easing: Easing.out(Easing.back(1.2)) })
      );

      onPress();
    }, [isSelected, onPress, scale]);

    // Container animation style
    const containerStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { scale: scale.value },
          { translateY: floatY.value },
          { rotate: `${rotation.value}rad` },
        ],
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
        const { scale, floatY, rotation, pulseScale, pulseOpacity } = animationsRef.current;
        cancelAnimation(scale);
        cancelAnimation(floatY);
        cancelAnimation(rotation);
        cancelAnimation(pulseScale);
        cancelAnimation(pulseOpacity);
      };
    }, []);

    // Use memo to avoid recreating style objects on each render
    const styles = useClusterStyles();

    const outerCircleStyle = useMemo(
      () => [
        styles.outerCircle,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          borderColor: accentColor,
        },
      ],
      [baseSize, accentColor, styles.outerCircle]
    );

    const innerCircleStyle = useMemo(
      () => [
        styles.innerCircle,
        {
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
        },
      ],
      [innerSize, styles.innerCircle]
    );

    const textStyle = useMemo(
      () => [styles.text, isSelected && styles.selectedText],
      [isSelected, styles.text, styles.selectedText]
    );

    const pulseRingStyle = useMemo(
      () => [
        styles.pulseRing,
        pulseStyle,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          borderColor: accentColor,
          backgroundColor: pulseColor,
        },
      ],
      [baseSize, accentColor, pulseColor, pulseStyle, styles.pulseRing]
    );

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
        {/* Pulsating ring - Only render when selected */}
        {isSelected && <PulseRing style={pulseRingStyle} />}

        {/* Main container */}
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={outerCircleStyle}>
            <ClusterText text={formattedCount} style={textStyle} />
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.count === nextProps.count &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.coordinates[0] === nextProps.coordinates[0] &&
      prevProps.coordinates[1] === nextProps.coordinates[1]
    );
  }
);

// Extract styles to a hook for better organization
const useClusterStyles = () => {
  // Styles don't need to be recreated on each render
  return StyleSheet.create({
    touchableArea: {
      width: 60,
      height: 60,
      alignItems: "center",
      justifyContent: "center",
    },
    container: {
      alignItems: "center",
      justifyContent: "center",
    },
    outerCircle: {
      backgroundColor: "rgba(58, 58, 58, 0.85)",
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    innerCircle: {
      alignItems: "center",
      justifyContent: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
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
      fontSize: 16,
      textAlign: "center",
      ...Platform.select({
        ios: {
          shadowColor: "rgba(0, 0, 0, 0.5)",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.5,
          shadowRadius: 1,
        },
      }),
    },
    selectedText: {
      fontSize: 18,
    },
    pulseRing: {
      position: "absolute",
      borderWidth: 2,
    },
  });
};
