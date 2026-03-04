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
import Svg, { Circle, Path } from "react-native-svg";

// Scaled-up version of the actual marker shape from MarkerSVGs.tsx
// Original viewBox is 48x64, we render at ~2.2x
const PIN_W = 105;
const PIN_H = 140;

export const LetsGoIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
  const pinScale = useSharedValue(0);
  const pinOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pinScale.value = withSpring(1, {
        damping: 8,
        stiffness: 180,
        mass: 0.6,
      });
      pinOpacity.value = withTiming(1, { duration: 400 });

      checkScale.value = withDelay(
        400,
        withSpring(1, { damping: 10, stiffness: 200, mass: 0.8 }),
      );

      pulseScale.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1.8, { duration: 1200 }),
            withTiming(1, { duration: 0 }),
          ),
          -1,
          false,
        ),
      );
      pulseOpacity.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 1200 }),
            withTiming(0.6, { duration: 0 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      pinScale.value = 0;
      pinOpacity.value = withTiming(0, { duration: 300 });
      checkScale.value = 0;
      pulseScale.value = 1;
      pulseOpacity.value = 0.6;
    }
  }, [active, checkScale, pinOpacity, pinScale, pulseOpacity, pulseScale]);

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinScale.value }],
    opacity: pinOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View style={[styles.pulseRing, pulseStyle]}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Circle
            cx={80}
            cy={80}
            r={75}
            fill="none"
            stroke={colors.accent.primary}
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>

      {/* Map marker — exact shape from MarkerSVGs.tsx */}
      <Animated.View style={[styles.pinContainer, pinStyle]}>
        <Svg width={PIN_W} height={PIN_H} viewBox="0 0 48 64">
          {/* Teardrop marker body */}
          <Path
            d="M24 4C13.5 4 6 12.1 6 22C6 28.5 9 34.4 13.5 39.6C17.5 44.2 24 52 24 52C24 52 30.5 44.2 34.5 39.6C39 34.4 42 28.5 42 22C42 12.1 34.5 4 24 4Z"
            fill={colors.accent.primary}
            stroke={colors.accent.dark}
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
            stroke={colors.accent.dark}
            strokeWidth={1}
          />
        </Svg>

        {/* Checkmark inside the circle */}
        <Animated.View style={[styles.checkContainer, checkStyle]}>
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Path
              d="M7 14 L12 19 L21 9"
              fill="none"
              stroke={colors.accent.primary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>
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
  pulseRing: {
    position: "absolute",
  },
  pinContainer: {
    width: PIN_W,
    height: PIN_H,
    alignItems: "center",
  },
  checkContainer: {
    position: "absolute",
    // Positioned at the inner circle center: cy=22 out of 64 viewBox height
    // Scaled: (22/64) * PIN_H ≈ 48, minus half the check icon size
    top: (22 / 64) * PIN_H - 14,
  },
});
