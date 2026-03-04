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

      {/* Map pin */}
      <Animated.View style={[styles.pinContainer, pinStyle]}>
        <Svg width={80} height={100} viewBox="0 0 80 100">
          <Path
            d="M40 5C22.3 5 8 19.3 8 37c0 25 32 58 32 58s32-33 32-58c0-17.7-14.3-32-32-32z"
            fill={colors.accent.primary}
          />
          <Circle cx={40} cy={37} r={14} fill={colors.bg.primary} />
        </Svg>

        {/* Checkmark inside pin */}
        <Animated.View style={[styles.checkContainer, checkStyle]}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Path
              d="M4 10 L8 14 L16 6"
              fill="none"
              stroke={colors.accent.primary}
              strokeWidth={2.5}
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
    alignItems: "center",
    justifyContent: "center",
  },
  checkContainer: {
    position: "absolute",
    top: 27,
  },
});
