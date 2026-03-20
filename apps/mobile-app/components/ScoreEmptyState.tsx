import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";

const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreEmptyStateProps {
  title: string;
  body: string;
}

const ScoreEmptyState: React.FC<ScoreEmptyStateProps> = ({ title, body }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const circleProgress = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    circleProgress.value = 0;
    circleProgress.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
    textOpacity.value = 0;
    textOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [circleProgress, textOpacity]);

  const circleAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - circleProgress.value),
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 10 }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.circleWrapper}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <AnimatedCircle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={CIRCLE_RADIUS}
            stroke={colors.border.accent}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray="6 4"
            animatedProps={circleAnimatedProps}
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.circleLabel}>
          <Text style={styles.circleIcon}>?</Text>
        </View>
      </View>
      <Animated.View style={[styles.textColumn, textAnimStyle]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Animated.View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    circleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
      opacity: 0.5,
    },
    circleLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    circleIcon: {
      fontSize: 32,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    textColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    body: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 20,
    },
  });

export default ScoreEmptyState;
