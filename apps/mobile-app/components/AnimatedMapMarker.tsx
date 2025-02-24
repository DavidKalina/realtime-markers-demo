import React, { useEffect } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AnimatedMarkerProps {
  emoji?: string;
  isSelected?: boolean;
  onPress?: () => void;
}

const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({
  emoji = "📍",
  isSelected = true,
  onPress,
}) => {
  const popupScale = useSharedValue(1);
  const popupTranslateY = useSharedValue(0);
  const popupTranslateX = useSharedValue(0);
  const circleScale = useSharedValue(1);
  const stringTension = useSharedValue(0);

  // Initial mount animation
  useEffect(() => {
    popupScale.value = withSequence(withSpring(1.1), withDelay(100, withSpring(1)));
  }, []);

  // Selection animations
  useEffect(() => {
    if (isSelected) {
      // Scale up both elements
      popupScale.value = withSpring(1.15, { damping: 12 });
      circleScale.value = withSpring(1.3, { damping: 12 });
      stringTension.value = withSpring(1);

      // Start continuous floating motion
      const floatDuration = 3000;
      popupTranslateY.value = withRepeat(
        withSequence(
          withTiming(-15, {
            duration: floatDuration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-12, {
            duration: floatDuration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      // Add slight horizontal drift
      popupTranslateX.value = withRepeat(
        withSequence(
          withTiming(3, {
            duration: floatDuration * 0.6,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-3, {
            duration: floatDuration * 0.6,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    } else {
      // Reset all animations
      popupScale.value = withSpring(1);
      circleScale.value = withSpring(1);
      popupTranslateY.value = withSpring(0);
      popupTranslateX.value = withSpring(0);
      stringTension.value = withSpring(0);
    }
  }, [isSelected]);

  const popupAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: popupScale.value },
      { translateY: popupTranslateY.value },
      { translateX: popupTranslateX.value },
    ],
  }));

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  // Animated string path
  const animatedStringProps = useAnimatedProps(() => {
    const startX = popupTranslateX.value;
    const startY = popupTranslateY.value + 40; // Adjust based on your popup height
    const endX = 0;
    const endY = 0;

    // Calculate control points for curved string
    const controlX1 = startX * 0.8;
    const controlY1 = startY * 0.3;
    const controlX2 = endX;
    const controlY2 = endY + 20;

    const opacity = interpolate(stringTension.value, [0, 1], [0, 0.3]);

    return {
      d: `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`,
      stroke: "#374151",
      strokeWidth: 1,
      strokeOpacity: opacity,
      fill: "none",
    };
  });

  return (
    <Pressable onPress={onPress}>
      <View style={styles.markerContainer}>
        {/* Animated popup */}
        <Animated.View style={[styles.popupContainer, popupAnimatedStyle]}>
          <View style={styles.emojiWindow}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
        </Animated.View>

        {/* Animated string */}
        <View style={StyleSheet.absoluteFill}>
          <Svg style={StyleSheet.absoluteFill}>
            <AnimatedPath animatedProps={animatedStringProps} />
          </Svg>
        </View>

        {/* Animated circle anchor point */}
        <Animated.View style={[styles.anchorPoint, circleAnimatedStyle]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    width: 60, // Ensure enough space for horizontal drift
    height: 80, // Ensure enough space for vertical movement
  },
  popupContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  emojiWindow: {
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 8,
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emoji: {
    fontSize: 18,
  },
  anchorPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#374151",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
});

export default AnimatedMarker;
