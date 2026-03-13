import { useColors, type Colors } from "@/theme";
import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

export const LevelUpIllustration: React.FC<{ active: boolean }> = ({
  active,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const containerOpacity = useSharedValue(0);
  const barWidth = useSharedValue(0);
  const shimmerX = useSharedValue(-60);
  const badgeScale = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      containerOpacity.value = withTiming(1, { duration: 400 });
      barWidth.value = withDelay(400, withTiming(160, { duration: 1200 }));
      badgeScale.value = withDelay(
        1200,
        withSpring(1, { damping: 8, stiffness: 180, mass: 0.6 }),
      );
      badgeOpacity.value = withDelay(1200, withTiming(1, { duration: 300 }));
    } else {
      containerOpacity.value = withTiming(0, { duration: 300 });
      barWidth.value = 0;
      badgeScale.value = 0;
      badgeOpacity.value = 0;
    }
  }, [active, badgeOpacity, badgeScale, barWidth, containerOpacity, shimmerX]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fbbf24",
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* XP label */}
      <Animated.Text style={styles.xpLabel}>XP</Animated.Text>

      {/* Progress bar track */}
      <Animated.View style={styles.barTrack}>
        <Animated.View style={barStyle} />
      </Animated.View>

      <Animated.Text style={styles.xpText}>2,450 / 3,000</Animated.Text>

      {/* Badge */}
      <Animated.View style={[styles.badgeContainer, badgeStyle]}>
        <Svg width={80} height={80} viewBox="0 0 80 80">
          {/* Shield shape */}
          <Path
            d="M40 5 L70 20 L70 45 Q70 65 40 75 Q10 65 10 45 L10 20 Z"
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
          />
          <Path
            d="M40 12 L64 24 L64 44 Q64 60 40 69 Q16 60 16 44 L16 24 Z"
            fill="rgba(251, 191, 36, 0.15)"
          />
          {/* Star in center */}
          <Path
            d="M40 25 L44 35 L55 36 L47 44 L49 55 L40 50 L31 55 L33 44 L25 36 L36 35 Z"
            fill="#fbbf24"
          />
        </Svg>
      </Animated.View>

      <Animated.Text style={styles.tierText}>Explorer Tier</Animated.Text>
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: 260,
      height: 220,
      alignItems: "center",
      justifyContent: "center",
    },
    xpLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: "#fbbf24",
      marginBottom: 6,
      fontFamily: "SpaceMono",
    },
    barTrack: {
      width: 200,
      height: 16,
      borderRadius: 8,
      backgroundColor: "rgba(251, 191, 36, 0.15)",
      overflow: "hidden",
    },
    xpText: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 6,
      fontFamily: "SpaceMono",
    },
    badgeContainer: {
      marginTop: 16,
    },
    tierText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#fbbf24",
      marginTop: 4,
      fontFamily: "SpaceMono",
    },
  });
