import { useColors } from "@/theme";
import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

const W = 280;
const H = 220;
const CX = W / 2;
const CY = H / 2;

// Viewfinder bounds
const VF_SIZE = 120;
const VF_LEFT = CX - VF_SIZE / 2;
const VF_RIGHT = CX + VF_SIZE / 2;
const VF_TOP = CY - VF_SIZE / 2 - 10;
const VF_BOTTOM = CY + VF_SIZE / 2 - 10;
const CORNER = 25;

// Swirl particles — positioned around center, will converge to pin
const PARTICLES = [
  { angle: 0, radius: 70, delay: 0 },
  { angle: 45, radius: 65, delay: 50 },
  { angle: 90, radius: 72, delay: 100 },
  { angle: 135, radius: 60, delay: 150 },
  { angle: 180, radius: 68, delay: 200 },
  { angle: 225, radius: 75, delay: 250 },
  { angle: 270, radius: 62, delay: 300 },
  { angle: 315, radius: 70, delay: 350 },
];

// Phase timing
const SCAN_PHASE = 2400; // scan line sweeps for this long
const SWIRL_START = SCAN_PHASE;
const SWIRL_DURATION = 800;
const PIN_APPEAR = SWIRL_START + SWIRL_DURATION - 200;

interface SwirlParticleProps {
  angle: number;
  radius: number;
  delay: number;
  active: boolean;
}

const SwirlParticle: React.FC<SwirlParticleProps> = ({
  angle,
  radius,
  delay,
  active,
}) => {
  const rad = (angle * Math.PI) / 180;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      // Appear at swirl start, converge to center, then fade
      opacity.value = withDelay(
        SWIRL_START + delay,
        withSequence(
          withTiming(1, { duration: 100 }),
          withDelay(SWIRL_DURATION - 300, withTiming(0, { duration: 200 })),
        ),
      );
      progress.value = withDelay(
        SWIRL_START + delay,
        withTiming(1, {
          duration: SWIRL_DURATION,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }),
      );
    } else {
      opacity.value = 0;
      progress.value = 0;
    }
  }, [active, delay, opacity, progress]);

  const style = useAnimatedStyle(() => {
    // Spiral inward: interpolate from start position to center
    const t = progress.value;
    // Add a rotation component for the swirl effect
    const swirlAngle = t * Math.PI * 1.5;
    const currentRadius = (1 - t) * radius;
    const x = CX + Math.cos(rad + swirlAngle) * currentRadius - 4;
    const y = CY - 10 + Math.sin(rad + swirlAngle) * currentRadius - 4;

    return {
      position: "absolute" as const,
      left: x,
      top: y,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#a78bfa",
      opacity: opacity.value,
    };
  });

  return <Animated.View style={style} />;
};

export const ScanIllustration: React.FC<{ active: boolean }> = ({ active }) => {
  const colors = useColors();
  const containerOpacity = useSharedValue(0);

  // Phase 1: Viewfinder + scan line
  const scanLineY = useSharedValue(VF_TOP + 5);
  const viewfinderOpacity = useSharedValue(0);
  const scanLineOpacity = useSharedValue(0);

  // Phase 2: Viewfinder fades, pin appears
  const pinScale = useSharedValue(0);
  const pinOpacity = useSharedValue(0);

  // Phase 3: Pulse ring after pin lands
  const pulseRingScale = useSharedValue(0.5);
  const pulseRingOpacity = useSharedValue(0);

  // Discovery indicator
  const discoveryTranslateY = useSharedValue(-15);
  const discoveryOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      containerOpacity.value = withTiming(1, { duration: 400 });

      // Phase 1: Show viewfinder, then fade out before swirl
      viewfinderOpacity.value = withSequence(
        withTiming(1, { duration: 400 }),
        withDelay(SWIRL_START - 600, withTiming(0, { duration: 400 })),
      );
      scanLineOpacity.value = withSequence(
        withDelay(200, withTiming(1, { duration: 300 })),
        withDelay(SWIRL_START - 700, withTiming(0, { duration: 300 })),
      );
      scanLineY.value = withDelay(
        200,
        withRepeat(
          withSequence(
            withTiming(VF_BOTTOM - 5, { duration: 1100 }),
            withTiming(VF_TOP + 5, { duration: 1100 }),
          ),
          2,
          false,
        ),
      );

      // Pin bounces in after swirl converges
      pinScale.value = withDelay(
        PIN_APPEAR,
        withSpring(1, { damping: 8, stiffness: 180, mass: 0.6 }),
      );
      pinOpacity.value = withDelay(
        PIN_APPEAR,
        withTiming(1, { duration: 200 }),
      );

      // Pulse ring expands and fades after pin lands
      const PULSE_START = PIN_APPEAR + 400;
      pulseRingScale.value = withDelay(
        PULSE_START,
        withRepeat(
          withSequence(
            withTiming(0.5, { duration: 0 }),
            withTiming(2, { duration: 1000 }),
          ),
          -1,
          false,
        ),
      );
      pulseRingOpacity.value = withDelay(
        PULSE_START,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 0 }),
            withTiming(0, { duration: 1000 }),
          ),
          -1,
          false,
        ),
      );
      // Discovery indicator slides in after pin
      discoveryOpacity.value = withDelay(
        PULSE_START + 200,
        withTiming(1, { duration: 400 }),
      );
      discoveryTranslateY.value = withDelay(
        PULSE_START + 200,
        withSpring(0, { damping: 14, stiffness: 180 }),
      );
    } else {
      containerOpacity.value = withTiming(0, { duration: 300 });
      viewfinderOpacity.value = 0;
      scanLineOpacity.value = 0;
      scanLineY.value = VF_TOP + 5;
      pinScale.value = 0;
      pinOpacity.value = 0;
      pulseRingScale.value = 0.5;
      pulseRingOpacity.value = 0;
      discoveryOpacity.value = 0;
      discoveryTranslateY.value = -15;
    }
  }, [
    active,
    containerOpacity,
    pinOpacity,
    pinScale,
    discoveryOpacity,
    discoveryTranslateY,
    pulseRingOpacity,
    pulseRingScale,
    scanLineOpacity,
    scanLineY,
    viewfinderOpacity,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const viewfinderStyle = useAnimatedStyle(() => ({
    opacity: viewfinderOpacity.value,
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: VF_LEFT,
    top: scanLineY.value,
    width: VF_RIGHT - VF_LEFT,
    height: 2,
    backgroundColor: "#a78bfa",
    opacity: scanLineOpacity.value,
    shadowColor: "#a78bfa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  }));

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinScale.value }],
    opacity: pinOpacity.value,
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseRingScale.value }],
    opacity: pulseRingOpacity.value,
  }));

  const discoveryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: discoveryTranslateY.value }],
    opacity: discoveryOpacity.value,
  }));

  const cx = (VF_LEFT + VF_RIGHT) / 2;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Phase 1: Viewfinder with scan line */}
      <Animated.View style={[StyleSheet.absoluteFill, viewfinderStyle]}>
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

          {/* Flyer content lines */}
          <Rect
            x={cx - 40}
            y={VF_TOP + 30}
            width={80}
            height={8}
            rx={4}
            fill={colors.text.secondary}
            opacity={0.3}
          />
          <Rect
            x={cx - 45}
            y={VF_TOP + 48}
            width={90}
            height={6}
            rx={3}
            fill={colors.text.secondary}
            opacity={0.2}
          />
          <Rect
            x={cx - 35}
            y={VF_TOP + 64}
            width={70}
            height={6}
            rx={3}
            fill={colors.text.secondary}
            opacity={0.2}
          />
          <Rect
            x={cx - 42}
            y={VF_TOP + 80}
            width={84}
            height={6}
            rx={3}
            fill={colors.text.secondary}
            opacity={0.15}
          />
        </Svg>
      </Animated.View>

      {/* Scan line */}
      <Animated.View style={scanLineStyle} />

      {/* Phase 2: Swirl particles */}
      {PARTICLES.map((p, i) => (
        <SwirlParticle
          key={i}
          angle={p.angle}
          radius={p.radius}
          delay={p.delay}
          active={active}
        />
      ))}

      {/* Map background behind pin */}
      <Animated.View style={[styles.mapBg, pinStyle]}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          {/* Grid lines */}
          <Line
            x1={0}
            y1={40}
            x2={160}
            y2={40}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          <Line
            x1={0}
            y1={80}
            x2={160}
            y2={80}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          <Line
            x1={0}
            y1={120}
            x2={160}
            y2={120}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          <Line
            x1={40}
            y1={0}
            x2={40}
            y2={160}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          <Line
            x1={80}
            y1={0}
            x2={80}
            y2={160}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          <Line
            x1={120}
            y1={0}
            x2={120}
            y2={160}
            stroke={colors.text.secondary}
            strokeWidth={0.5}
            opacity={0.12}
          />
          {/* Roads */}
          <Path
            d="M0 65 Q60 55 110 70 Q140 78 160 60"
            stroke={colors.text.secondary}
            strokeWidth={1}
            opacity={0.15}
            fill="none"
          />
          <Path
            d="M70 0 Q65 50 80 100 Q90 130 75 160"
            stroke={colors.text.secondary}
            strokeWidth={1}
            opacity={0.15}
            fill="none"
          />
          <Path
            d="M20 130 Q60 110 100 120 Q130 128 160 115"
            stroke={colors.text.secondary}
            strokeWidth={0.7}
            opacity={0.1}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Pulse ring after pin lands */}
      <Animated.View style={[styles.pulseRing, pulseRingStyle]}>
        <Svg width={100} height={100} viewBox="0 0 100 100">
          <Circle
            cx={50}
            cy={50}
            r={45}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>

      {/* Phase 3: Map pin result — uses MarkerSVG teardrop shape */}
      <Animated.View style={[styles.pinContainer, pinStyle]}>
        <Svg width={56} height={75} viewBox="0 0 48 64">
          {/* Teardrop body */}
          <Path
            d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
            fill="#a78bfa"
            stroke="#7c3aed"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Highlight arc */}
          <Path
            d="M16 12C16 12 19 9 24 9C29 9 32 12 32 12"
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Inner circle */}
          <Circle
            cx={24}
            cy={22}
            r={12}
            fill={colors.bg.card}
            stroke="#7c3aed"
            strokeWidth={1}
          />
        </Svg>
        <Text style={styles.pinEmoji}>🎸</Text>
      </Animated.View>

      {/* Discovery indicator pill */}
      <Animated.View style={[styles.discoveryPill, discoveryStyle]}>
        <Svg width={160} height={36} viewBox="0 0 160 36">
          {/* Pill background */}
          <Rect
            x={0}
            y={0}
            width={160}
            height={36}
            rx={10}
            fill={colors.bg.card}
            stroke={colors.border.medium}
            strokeWidth={1}
          />
          {/* Emoji box */}
          <Rect
            x={6}
            y={6}
            width={24}
            height={24}
            rx={6}
            fill={colors.border.subtle}
            stroke={colors.border.medium}
            strokeWidth={1}
          />
          {/* "Nearby Discovery" text placeholder */}
          <Rect
            x={38}
            y={10}
            width={80}
            height={6}
            rx={3}
            fill={colors.text.primary}
            opacity={0.6}
          />
          <Rect
            x={38}
            y={21}
            width={50}
            height={5}
            rx={2.5}
            fill={colors.text.secondary}
            opacity={0.3}
          />
          {/* Chevron */}
          <Path
            d="M145 14 L149 18 L145 22"
            fill="none"
            stroke={colors.text.secondary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
        </Svg>
        <Text style={styles.discoveryEmoji}>🎸</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: W,
    height: H,
  },
  pulseRing: {
    position: "absolute",
    left: CX - 50,
    top: CY - 60,
    width: 100,
    height: 100,
  },
  mapBg: {
    position: "absolute",
    left: CX - 80,
    top: CY - 90,
    width: 160,
    height: 160,
  },
  pinContainer: {
    position: "absolute",
    left: CX - 28,
    top: CY - 47,
    width: 56,
    height: 75,
    alignItems: "center",
  },
  pinEmoji: {
    position: "absolute",
    fontSize: 16,
    // Vertically centered on inner circle: cy=22 of 64 viewBox, scaled to 75px height
    top: (22 / 64) * 75 - 10,
  },
  discoveryPill: {
    position: "absolute",
    left: CX - 80,
    top: CY + 35,
    width: 160,
    height: 36,
  },
  discoveryEmoji: {
    position: "absolute",
    fontSize: 12,
    top: 9,
    left: 12,
  },
});
