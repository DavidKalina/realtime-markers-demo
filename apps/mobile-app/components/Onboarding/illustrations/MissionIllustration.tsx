import { colors } from "@/theme";
import React, { useEffect } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

interface FloatingPinProps {
  cx: number;
  cy: number;
  delay: number;
  active: boolean;
}

const FloatingPin: React.FC<FloatingPinProps> = ({ cx, cy, delay, active }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withDelay(delay, withTiming(0.4, { duration: 600 }));
      translateY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 2000 }),
            withTiming(8, { duration: 2000 }),
          ),
          -1,
          true,
        ),
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, delay, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: cx - 6,
          top: cy - 6,
          width: 12,
          height: 12,
        },
        animStyle,
      ]}
    >
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Circle
          cx={6}
          cy={6}
          r={5}
          fill={colors.accent.primary}
          opacity={0.6}
        />
      </Svg>
    </Animated.View>
  );
};

const PINS = [
  { cx: 40, cy: 50, delay: 0 },
  { cx: 180, cy: 30, delay: 400 },
  { cx: 120, cy: 120, delay: 200 },
  { cx: 60, cy: 160, delay: 600 },
  { cx: 200, cy: 140, delay: 300 },
  { cx: 150, cy: 80, delay: 500 },
  { cx: 90, cy: 40, delay: 100 },
  { cx: 220, cy: 90, delay: 700 },
];

const LOGO_SIZE = 120;

export const MissionIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 600 });
    } else {
      scale.value = withTiming(0.8, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, opacity, scale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Image
        source={require("@/assets/images/app-icon.png")}
        style={styles.logo}
      />
      {PINS.map((pin, i) => (
        <FloatingPin
          key={i}
          cx={pin.cx}
          cy={pin.cy}
          delay={pin.delay}
          active={active}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
  },
});
