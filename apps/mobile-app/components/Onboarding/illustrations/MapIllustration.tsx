import { colors } from "@/theme";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

interface PinDropProps {
  x: number;
  y: number;
  delay: number;
  color: string;
  active: boolean;
}

const PinDrop: React.FC<PinDropProps> = ({ x, y, delay, color, active }) => {
  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    if (active) {
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
      translateY.value = withDelay(
        delay,
        withSpring(0, { damping: 8, stiffness: 180, mass: 0.6 }),
      );
      scale.value = withDelay(
        delay,
        withSpring(1, { damping: 8, stiffness: 180, mass: 0.6 }),
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = -40;
      scale.value = 0.5;
    }
  }, [active, delay, opacity, scale, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ position: "absolute", left: x - 10, top: y - 24 }, style]}
    >
      <Svg width={20} height={28} viewBox="0 0 20 28">
        <Path
          d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
          fill={color}
        />
        <Circle cx={10} cy={10} r={4} fill={colors.bg.primary} />
      </Svg>
    </Animated.View>
  );
};

const PINS = [
  { x: 80, y: 60, delay: 400, color: "#38bdf8" },
  { x: 150, y: 45, delay: 600, color: "#93c5fd" },
  { x: 120, y: 90, delay: 800, color: "#38bdf8" },
  { x: 180, y: 80, delay: 1000, color: "#a78bfa" },
  { x: 100, y: 130, delay: 1200, color: "#34d399" },
];

export const MapIllustration: React.FC<{ active: boolean }> = ({ active }) => {
  const phoneScale = useSharedValue(0.9);
  const phoneOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      phoneScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      phoneOpacity.value = withTiming(1, { duration: 500 });
    } else {
      phoneScale.value = withTiming(0.9, { duration: 300 });
      phoneOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, phoneOpacity, phoneScale]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: phoneScale.value }],
    opacity: phoneOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, phoneStyle]}>
      <Svg width={260} height={200} viewBox="0 0 260 200">
        {/* Phone frame */}
        <Rect
          x={55}
          y={5}
          width={150}
          height={190}
          rx={16}
          fill={colors.bg.card}
          stroke={colors.accent.primary}
          strokeWidth={1.5}
          opacity={0.8}
        />
        {/* Screen area */}
        <Rect
          x={63}
          y={20}
          width={134}
          height={160}
          rx={4}
          fill={colors.bg.primary}
          opacity={0.9}
        />
        {/* Map grid lines */}
        <Line
          x1={63}
          y1={60}
          x2={197}
          y2={60}
          stroke={colors.border.accent}
          strokeWidth={0.5}
          opacity={0.3}
        />
        <Line
          x1={63}
          y1={100}
          x2={197}
          y2={100}
          stroke={colors.border.accent}
          strokeWidth={0.5}
          opacity={0.3}
        />
        <Line
          x1={63}
          y1={140}
          x2={197}
          y2={140}
          stroke={colors.border.accent}
          strokeWidth={0.5}
          opacity={0.3}
        />
        <Line
          x1={110}
          y1={20}
          x2={110}
          y2={180}
          stroke={colors.border.accent}
          strokeWidth={0.5}
          opacity={0.3}
        />
        <Line
          x1={155}
          y1={20}
          x2={155}
          y2={180}
          stroke={colors.border.accent}
          strokeWidth={0.5}
          opacity={0.3}
        />
        {/* Roads */}
        <Path
          d="M63 80 Q130 70 197 85"
          stroke={colors.text.secondary}
          strokeWidth={1}
          opacity={0.2}
          fill="none"
        />
        <Path
          d="M130 20 Q125 100 135 180"
          stroke={colors.text.secondary}
          strokeWidth={1}
          opacity={0.2}
          fill="none"
        />
      </Svg>
      {PINS.map((pin, i) => (
        <PinDrop
          key={i}
          x={pin.x}
          y={pin.y}
          delay={pin.delay}
          color={pin.color}
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
});
