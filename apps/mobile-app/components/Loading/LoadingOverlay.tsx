import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  type Colors,
} from "@/theme";

const DOT_COUNT = 8;
const RADIUS = 20;
const DOT_RADIUS = 3.5;

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
}

function SpinnerDots({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dots = useMemo(() => {
    const items = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2;
      const cx = 32 + RADIUS * Math.cos(angle);
      const cy = 32 + RADIUS * Math.sin(angle);
      const opacity = 0.15 + (i / DOT_COUNT) * 0.85;
      items.push(
        <Circle
          key={i}
          cx={cx}
          cy={cy}
          r={DOT_RADIUS * (0.6 + (i / DOT_COUNT) * 0.4)}
          fill={color}
          opacity={opacity}
        />,
      );
    }
    return items;
  }, [color]);

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        {dots}
      </Svg>
    </Animated.View>
  );
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = React.memo(
  ({
    message = "Finding your location...",
    subMessage = "We'll show you events nearby",
  }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(8);

    useEffect(() => {
      const fadeIn = { duration: 500, easing: Easing.out(Easing.quad) };
      textOpacity.value = withDelay(300, withTiming(1, fadeIn));
      textTranslateY.value = withDelay(300, withTiming(0, fadeIn));
    }, []);

    const textAnim = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    }));

    const pulseOpacity = useSharedValue(1);
    useEffect(() => {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }, []);

    const pulseAnim = useAnimatedStyle(() => ({
      opacity: pulseOpacity.value,
    }));

    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingContainer}>
          <SpinnerDots color={colors.accent.primary} />
          <View style={styles.textSlot}>
            <Animated.View style={textAnim}>
              <Text style={styles.loadingText}>{message}</Text>
              <Animated.Text style={[styles.loadingSubtext, pulseAnim]}>
                {subMessage}
              </Animated.Text>
            </Animated.View>
          </View>
        </View>
      </View>
    );
  },
);

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.bg.primary,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    },
    loadingContainer: {
      alignItems: "center",
      gap: spacing.xl,
    },
    textSlot: {
      height: 48,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    loadingText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    loadingSubtext: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      textAlign: "center",
    },
  });
