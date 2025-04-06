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

// Pre-defined color schemes for different cluster sizes
const COLOR_SCHEMES = {
  small: {
    gradient: ["#4dabf7", "#3793dd"],
    accent: "rgba(77, 171, 247, 0.8)",
    pulse: "rgba(77, 171, 247, 0.3)",
  },
  medium: {
    gradient: ["#ff9f43", "#ee8130"],
    accent: "rgba(255, 159, 67, 0.8)",
    pulse: "rgba(255, 159, 67, 0.3)",
  },
  large: {
    gradient: ["#fd79a8", "#e84393"],
    accent: "rgba(253, 121, 168, 0.8)",
    pulse: "rgba(253, 121, 168, 0.3)",
  },
};

// Styled sub-components to reduce re-renders
const PulseRing = React.memo(({ style }: { style: any }) => <Animated.View style={style} />);

const ClusterText = React.memo(({ text, style }: { text: string; style: any }) => (
  <Text style={style}>{text}</Text>
));

export const ClusterMarker: React.FC<ClusterMarkerProps> = React.memo(
  ({ count, onPress, isSelected = false, isHighlighted = false }) => {
    // Animation values
    const scale = useSharedValue(1);
    const floatY = useSharedValue(0);
    const rotation = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);

    // Component state
    const [wasSelected, setWasSelected] = useState(false);
    const prevSelectedRef = useRef(isSelected);
    const prevHighlightedRef = useRef(isHighlighted);

    // Memoize size calculations
    const { baseSize, innerSize } = useMemo(() => {
      const base = count < 10 ? 40 : count < 50 ? 45 : 50;
      return {
        baseSize: base,
        innerSize: base * 0.7,
      };
    }, [count]);

    // Memoize color scheme based on count
    const colorScheme = useMemo(() => {
      if (count < 10) return COLOR_SCHEMES.small;
      if (count < 30) return COLOR_SCHEMES.medium;
      return COLOR_SCHEMES.large;
    }, [count]);

    // Memoize formatted count
    const formattedCount = useMemo(() => (count > 99 ? "99+" : count.toString()), [count]);

    // Initialize animations
    useEffect(() => {
      floatY.value = withRepeat(
        withSequence(
          withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );

      rotation.value = withRepeat(
        withSequence(
          withTiming(0.03, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(-0.03, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );

      return () => {
        cancelAnimation(floatY);
        cancelAnimation(rotation);
      };
    }, []);

    // Handle selected state and pulse animation
    useEffect(() => {
      if (isSelected !== prevSelectedRef.current) {
        prevSelectedRef.current = isSelected;

        if (isSelected) {
          scale.value = withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(1.2)) });

          pulseScale.value = withRepeat(
            withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            false
          );

          pulseOpacity.value = withRepeat(
            withTiming(0, { duration: 1500, easing: Easing.in(Easing.ease) }),
            -1,
            false
          );

          setWasSelected(true);
        } else {
          if (wasSelected) {
            scale.value = withTiming(1, { duration: 300 });
            setWasSelected(false);
          }
          pulseOpacity.value = withTiming(0, { duration: 300 });
        }
      }

      return () => {
        cancelAnimation(pulseScale);
        cancelAnimation(pulseOpacity);
      };
    }, [isSelected, wasSelected]);

    // Handle highlight effect
    useEffect(() => {
      if (isHighlighted !== prevHighlightedRef.current) {
        prevHighlightedRef.current = isHighlighted;

        if (isHighlighted) {
          scale.value = withSequence(
            withTiming(1.1, { duration: 150 }),
            withTiming(isSelected ? 1.2 : 1, { duration: 150 })
          );
        }
      }
    }, [isHighlighted, isSelected]);

    // Handle press with haptic feedback
    const handlePress = useCallback(() => {
      Haptics.impactAsync(
        isSelected ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );

      cancelAnimation(scale);

      scale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(isSelected ? 1 : 1.2, { duration: 200, easing: Easing.out(Easing.back(1.2)) })
      );

      onPress();
    }, [isSelected, onPress, scale]);

    // Memoize animation styles
    const containerStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateY: floatY.value },
        { rotate: `${rotation.value}rad` },
      ],
    }), []);

    const pulseStyle = useAnimatedStyle(() => ({
      opacity: pulseOpacity.value,
      transform: [{ scale: pulseScale.value }],
    }), []);

    // Memoize component styles
    const styles = useClusterStyles();
    const outerCircleStyle = useMemo(
      () => [
        styles.outerCircle,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          borderColor: colorScheme.accent,
        },
      ],
      [baseSize, colorScheme.accent, styles.outerCircle]
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
          borderColor: colorScheme.accent,
          backgroundColor: colorScheme.pulse,
        },
      ],
      [baseSize, colorScheme.accent, colorScheme.pulse, pulseStyle, styles.pulseRing]
    );

    // Memoize the main content
    const markerContent = useMemo(() => (
      <View style={outerCircleStyle}>
        <ClusterText text={formattedCount} style={textStyle} />
      </View>
    ), [outerCircleStyle, formattedCount, textStyle]);

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.touchableArea}>
        {isSelected && <PulseRing style={pulseRingStyle} />}
        <Animated.View style={[styles.container, containerStyle]}>
          {markerContent}
        </Animated.View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
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
