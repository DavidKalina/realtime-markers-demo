import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  interpolate,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";

const { width } = Dimensions.get("window");

interface ClockDialProps {
  size?: number;
  onValueChange: (value: number) => void;
}

const ClockDial = ({ size = width * 0.8, onValueChange }: ClockDialProps) => {
  const rotation = useSharedValue(0);
  const center = size / 2;
  const radius = center * 0.8;

  const onGestureEvent = useAnimatedGestureHandler({
    onStart: () => {},
    onActive: (event) => {
      const { absoluteX, absoluteY } = event;
      // Calculate the angle based on touch position
      const dx = absoluteX - center;
      const dy = absoluteY - center;
      let angle = Math.atan2(dy, dx);

      // Convert to degrees and adjust range
      angle = (angle * 180) / Math.PI;
      if (angle < 0) angle += 360;

      // Normalize to 0-360 range
      let normalizedAngle = angle - 90;
      if (normalizedAngle < 0) normalizedAngle += 360;

      // Restrict to 0-300 degrees (50 minutes)
      normalizedAngle = Math.max(0, Math.min(normalizedAngle, 300));

      rotation.value = normalizedAngle;

      // Convert angle to minutes (0-50)
      const minutes = (normalizedAngle / 300) * 50;

      if (onValueChange) {
        runOnJS(onValueChange)(Math.round(minutes));
      }
    },
    onEnd: () => {
      // Snap to the nearest 5-minute mark
      const minutes = (rotation.value / 300) * 50;
      const snappedMinutes = Math.round(minutes / 5) * 5;
      const snappedAngle = (snappedMinutes / 50) * 300;

      rotation.value = withSpring(snappedAngle, {
        damping: 15,
        stiffness: 150,
      });

      if (onValueChange) {
        runOnJS(onValueChange)(snappedMinutes);
      }
    },
  });

  const knobStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const renderMarks = () => {
    const marks = [];
    for (let i = 0; i <= 50; i += 5) {
      const angle = (i / 50) * 300 - 90;
      const angleRad = (angle * Math.PI) / 180;

      const isMajor = i % 10 === 0;
      const markLength = isMajor ? 15 : 8;
      const markWidth = isMajor ? 2 : 1;

      const x1 = center + (radius - markLength) * Math.cos(angleRad);
      const y1 = center + (radius - markLength) * Math.sin(angleRad);
      const x2 = center + radius * Math.cos(angleRad);
      const y2 = center + radius * Math.sin(angleRad);

      marks.push(
        <View
          key={i}
          style={[
            styles.mark,
            {
              position: "absolute",
              left: x1,
              top: y1,
              width: Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
              height: markWidth,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      );

      // Add numbers for major marks
      if (isMajor) {
        const textRadius = radius - 25;
        const textX = center + textRadius * Math.cos(angleRad);
        const textY = center + textRadius * Math.sin(angleRad);

        marks.push(
          <Text
            key={`text-${i}`}
            style={[
              styles.numberText,
              {
                position: "absolute",
                left: textX - 10,
                top: textY - 10,
              },
            ]}
          >
            {i}
          </Text>
        );
      }
    }
    return marks;
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background Circle */}
      <View style={[styles.background, { width: size, height: size }]} />

      {/* Hour marks */}
      {renderMarks()}

      {/* Knob */}
      <PanGestureHandler onGestureEvent={onGestureEvent}>
        <Animated.View style={[styles.knob, knobStyle, { width: size, height: size }]}>
          <View style={styles.knobIndicator} />
          <View style={styles.centerDot} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  background: {
    borderRadius: 999,
    backgroundColor: "#2a2a2a",
    position: "absolute",
  },
  knob: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  knobIndicator: {
    position: "absolute",
    top: "10%",
    width: 4,
    height: "15%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  centerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  mark: {
    backgroundColor: "#666",
  },
  numberText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    width: 20,
    height: 20,
  },
});

export default ClockDial;
