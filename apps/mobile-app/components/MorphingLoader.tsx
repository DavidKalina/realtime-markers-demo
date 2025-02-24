import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const MorphingLoader = ({ size = 100, color = "#000000" }) => {
  // Animation values for morphing and rotation
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    // Continuous rotation
    rotation.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 3000,
        easing: Easing.linear,
      }),
      -1
    );

    // Morphing animation
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }),
        withTiming(0, {
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        })
      ),
      -1
    );

    // Pulsing animation
    scale.value = withRepeat(
      withSequence(
        withDelay(
          750,
          withTiming(1.1, {
            duration: 750,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          })
        ),
        withTiming(1, {
          duration: 750,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        })
      ),
      -1
    );
  }, []);

  // Animate the path
  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const r = rotation.value;
    const s = scale.value;

    // Create a morphing circle with varying radii
    const points = [];
    const segments = 8;
    const radius = size * 0.4 * s;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI + r;
      const variation = Math.sin(angle * 2) * p * 15;
      const currentRadius = radius + variation;

      const x = size / 2 + Math.cos(angle) * currentRadius;
      const y = size / 2 + Math.sin(angle) * currentRadius;

      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }
    points.push("Z");

    return {
      d: points.join(" "),
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <AnimatedPath
          animatedProps={animatedProps}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

// Usage example:
// <MorphingLoader size={80} color="#000000" />
