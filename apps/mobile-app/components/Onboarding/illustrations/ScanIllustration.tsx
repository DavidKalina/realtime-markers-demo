import { colors } from "@/theme";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Rect } from "react-native-svg";

// Layout constants — viewfinder centered in a 280×220 container
const W = 280;
const H = 220;
const VF_LEFT = 60;
const VF_RIGHT = 180;
const VF_TOP = 20;
const VF_BOTTOM = 170;
const CORNER = 30; // corner bracket length
const DATA_LEFT = VF_RIGHT + 14;

interface DataFieldProps {
  y: number;
  width: number;
  delay: number;
  active: boolean;
}

const DataField: React.FC<DataFieldProps> = ({ y, width, delay, active }) => {
  const scaleX = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = withDelay(delay + 600, withTiming(1, { duration: 300 }));
      scaleX.value = withDelay(
        delay + 600,
        withSpring(1, { damping: 15, stiffness: 200 }),
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scaleX.value = 0;
    }
  }, [active, delay, opacity, scaleX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: DATA_LEFT,
          top: y,
          height: 10,
          width,
          borderRadius: 5,
          backgroundColor: "#a78bfa",
        },
        style,
      ]}
    />
  );
};

export const ScanIllustration: React.FC<{ active: boolean }> = ({ active }) => {
  const frameOpacity = useSharedValue(0);
  const scanLineY = useSharedValue(VF_TOP + 10);

  useEffect(() => {
    if (active) {
      frameOpacity.value = withTiming(1, { duration: 400 });
      scanLineY.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(VF_BOTTOM - 10, { duration: 1500 }),
            withTiming(VF_TOP + 10, { duration: 1500 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      frameOpacity.value = withTiming(0, { duration: 300 });
      scanLineY.value = VF_TOP + 10;
    }
  }, [active, frameOpacity, scanLineY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: frameOpacity.value,
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: VF_LEFT,
    top: scanLineY.value,
    width: VF_RIGHT - VF_LEFT,
    height: 2,
    backgroundColor: "#a78bfa",
    shadowColor: "#a78bfa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  }));

  const cx = (VF_LEFT + VF_RIGHT) / 2; // center x of viewfinder

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Top-left corner */}
        <Line
          x1={VF_LEFT}
          y1={VF_TOP}
          x2={VF_LEFT + CORNER}
          y2={VF_TOP}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        <Line
          x1={VF_LEFT}
          y1={VF_TOP}
          x2={VF_LEFT}
          y2={VF_TOP + CORNER}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        {/* Top-right corner */}
        <Line
          x1={VF_RIGHT}
          y1={VF_TOP}
          x2={VF_RIGHT - CORNER}
          y2={VF_TOP}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        <Line
          x1={VF_RIGHT}
          y1={VF_TOP}
          x2={VF_RIGHT}
          y2={VF_TOP + CORNER}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        {/* Bottom-left corner */}
        <Line
          x1={VF_LEFT}
          y1={VF_BOTTOM}
          x2={VF_LEFT + CORNER}
          y2={VF_BOTTOM}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        <Line
          x1={VF_LEFT}
          y1={VF_BOTTOM}
          x2={VF_LEFT}
          y2={VF_BOTTOM - CORNER}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        {/* Bottom-right corner */}
        <Line
          x1={VF_RIGHT}
          y1={VF_BOTTOM}
          x2={VF_RIGHT - CORNER}
          y2={VF_BOTTOM}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />
        <Line
          x1={VF_RIGHT}
          y1={VF_BOTTOM}
          x2={VF_RIGHT}
          y2={VF_BOTTOM - CORNER}
          stroke={colors.accent.primary}
          strokeWidth={2}
        />

        {/* Flyer content lines — centered in viewfinder */}
        <Rect
          x={cx - 40}
          y={55}
          width={80}
          height={8}
          rx={4}
          fill={colors.text.secondary}
          opacity={0.3}
        />
        <Rect
          x={cx - 45}
          y={73}
          width={90}
          height={6}
          rx={3}
          fill={colors.text.secondary}
          opacity={0.2}
        />
        <Rect
          x={cx - 35}
          y={89}
          width={70}
          height={6}
          rx={3}
          fill={colors.text.secondary}
          opacity={0.2}
        />
        <Rect
          x={cx - 42}
          y={105}
          width={84}
          height={6}
          rx={3}
          fill={colors.text.secondary}
          opacity={0.15}
        />
        <Rect
          x={cx - 30}
          y={125}
          width={60}
          height={20}
          rx={6}
          fill={colors.text.secondary}
          opacity={0.1}
        />
      </Svg>

      {/* Animated scan line */}
      <Animated.View style={scanLineStyle} />

      {/* Data fields popping out to the right */}
      <DataField y={55} width={50} delay={0} active={active} />
      <DataField y={78} width={65} delay={200} active={active} />
      <DataField y={101} width={40} delay={400} active={active} />
      <DataField y={124} width={55} delay={600} active={active} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: W,
    height: H,
  },
});
