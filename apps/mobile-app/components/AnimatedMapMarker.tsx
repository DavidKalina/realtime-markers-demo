import React from "react";
import { StyleSheet, View, TouchableWithoutFeedback, Text } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Svg, Polygon, Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface MarkerData {
  id: string;
  title: string;
  emoji: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface MorphingMarkerProps {
  marker: MarkerData;
  size?: number;
  borderColor?: string; // Color for the morphing border
  bgColor?: string; // Background color for the hexagon behind the emoji
  selected?: boolean;
  onPress?: () => void;
}

export const MorphingMarker = ({
  marker,
  size = 100,
  borderColor = "#32CD32",
  bgColor = "#ffffff",
  selected = false,
  onPress,
}: MorphingMarkerProps) => {
  // Animation values for morphing, rotation, and pulsing
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    // Continuous rotation (for the border only)
    rotation.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: 6000,
        easing: Easing.linear,
      }),
      -1
    );

    // Morphing animation: animate from 0 to 1 and back
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

    // Pulsing animation: scale up and then back down
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

  // Animate the morphing border with integrated rotation.
  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const s = scale.value;
    const r = rotation.value; // Rotation value added to each segment's angle
    const points: string[] = [];
    const segments = 6;
    const center = size / 2;
    const outerRadius = size * 0.45 * s;
    const variationAmplitude = size * 0.05;
    for (let i = 0; i <= segments; i++) {
      // Add the rotation value to the angle for a spinning effect.
      const angle = (i / segments) * 2 * Math.PI + r;
      const variation = Math.sin(angle * 2) * p * variationAmplitude;
      const currentRadius = outerRadius + variation;
      const x = center + Math.cos(angle) * currentRadius;
      const y = center + Math.sin(angle) * currentRadius;
      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }
    points.push("Z");
    return { d: points.join(" ") };
  });

  // Compute static hexagon background for the emoji (non-animated)
  const computeHexagonPoints = () => {
    const center = size / 2;
    const innerRadius = size * 0.25;
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = ((Math.PI * 2) / 6) * i - Math.PI / 6;
      const x = center + innerRadius * Math.cos(angle);
      const y = center + innerRadius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={[styles.wrapper, { width: size, height: size + 40 }]}>
        {selected && (
          <View style={styles.popup}>
            <Text style={styles.popupText}>{marker.title}</Text>
          </View>
        )}
        <View style={[styles.container, { width: size, height: size }]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Static hexagon background */}
            <Polygon points={computeHexagonPoints()} fill={bgColor} />
            {/* Rotating and morphing border */}
            <AnimatedPath
              animatedProps={animatedProps}
              fill="none"
              stroke={borderColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.emojiContainer}>
            {/* Centered emoji */}
            <Text style={[styles.emoji, { fontSize: size * 0.2 }]}>{marker.emoji}</Text>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  emojiContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    textAlign: "center",
  },
  popup: {
    position: "absolute",
    bottom: "100%",
    alignSelf: "center",
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 140,
    alignItems: "center",
  },
  popupText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MorphingMarker;
