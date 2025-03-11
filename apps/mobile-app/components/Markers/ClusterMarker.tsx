// components/Markers/ClusterMarker.tsx
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
      pulseScale: useSharedValue(1),
      pulseOpacity: useSharedValue(0),
    });

    // Destructure for cleaner code
    const { scale, floatY, pulseScale, pulseOpacity } = animationsRef.current;

    const isFirstRender = useRef(true);
    const [wasSelected, setWasSelected] = useState(false);
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Format the count for display
    const formattedCount = useMemo(() => (count > 99 ? "99+" : count.toString()), [count]);

    // Determine size based on count for visual hierarchy - memoized
    const baseSize = useMemo(() => (count < 10 ? 32 : count < 50 ? 36 : 40), [count]);

    // Generate colors based on count for visual differentiation - memoized
    const { backgroundColor, accentColor } = useMemo(() => {
      // Small, medium, and large clusters
      let bg = "#333333"; // All use dark background for consistency

      let accent;
      if (count < 10) {
        accent = "rgba(77, 171, 247, 0.6)"; // Small clusters: blue
      } else if (count < 30) {
        accent = "rgba(230, 119, 0, 0.6)"; // Medium clusters: orange
      } else {
        accent = "rgba(214, 51, 132, 0.6)"; // Large clusters: pink
      }

      return { backgroundColor: bg, accentColor: accent };
    }, [count]);

    // Initialize animations - only run once
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

    // Handle selected state and pulse animation - only run when selection state changes
    useEffect(() => {
      // Only run animation when selection state changes
      const selectionChanged = isSelected !== prevSelectedRef.current;
      if (!selectionChanged) return;

      // Update ref
      prevSelectedRef.current = isSelected;

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
        withTiming(isSelected ? 1 : 1.2, { duration: 200 })
      );

      onPress();
    }, [isSelected, onPress, scale]);

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
        const { scale, floatY, pulseScale, pulseOpacity } = animationsRef.current;
        cancelAnimation(scale);
        cancelAnimation(floatY);
        cancelAnimation(pulseScale);
        cancelAnimation(pulseOpacity);
      };
    }, []);

    // Use memo to avoid recreating style objects on each render
    const styles = useClusterStyles();

    const clusterBoxStyle = useMemo(
      () => [
        styles.clusterBox,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          backgroundColor,
          borderColor: accentColor,
        },
      ],
      [baseSize, backgroundColor, accentColor, styles.clusterBox]
    );

    const textStyle = useMemo(
      () => [
        styles.text,
        {
          textShadowColor: accentColor,
        },
      ],
      [accentColor, styles.text]
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
          backgroundColor: accentColor.replace("0.6", "0.1"),
        },
      ],
      [baseSize, accentColor, pulseStyle, styles.pulseRing]
    );

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
        {/* Pulsating ring - Only render when selected */}
        {isSelected && <PulseRing style={pulseRingStyle} />}

        {/* Main container */}
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={clusterBoxStyle}>
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
};
