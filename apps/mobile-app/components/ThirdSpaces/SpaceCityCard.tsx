import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
} from "@/theme";
import type { ThirdSpaceSummary } from "@/services/api/modules/leaderboard";

interface SpaceCityCardProps {
  city: ThirdSpaceSummary;
  rank: number;
  onPress: (city: ThirdSpaceSummary) => void;
}

const MEDAL_COLORS: Record<number, string> = {
  1: "#fbbf24", // gold
  2: "#a3a3a3", // silver
  3: "#cd7f32", // bronze
};

const MOMENTUM_ARROWS: Record<string, { arrow: string; color: string }> = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#f87171" },
};

const CIRCLE_SIZE = 36;
const STROKE_WIDTH = 3;
const TOP3_STROKE_WIDTH = 3.5;

function getCircleMetrics(isTop3: boolean) {
  const sw = isTop3 ? TOP3_STROKE_WIDTH : STROKE_WIDTH;
  const r = (CIRCLE_SIZE - sw) / 2;
  return { strokeWidth: sw, radius: r, circumference: 2 * Math.PI * r };
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const GoldSheen: React.FC = () => {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withDelay(
      400,
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
    );
  }, [translateX]);

  const animatedProps = useAnimatedProps(() => ({
    x: `${translateX.value * 100}%` as unknown as number,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="goldSheen" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#d4d4d8" stopOpacity="0" />
            <Stop offset="0.4" stopColor="#d4d4d8" stopOpacity="0.08" />
            <Stop offset="0.5" stopColor="#fafafa" stopOpacity="0.16" />
            <Stop offset="0.6" stopColor="#d4d4d8" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#d4d4d8" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <AnimatedRect
          animatedProps={animatedProps}
          y="0"
          width="100%"
          height="100%"
          fill="url(#goldSheen)"
        />
      </Svg>
    </View>
  );
};

function getScoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

const SpaceCityCard: React.FC<SpaceCityCardProps> = ({
  city,
  rank,
  onPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const momentum = MOMENTUM_ARROWS[city.momentum];
  const scoreColor = getScoreColor(city.score);
  const progress = city.score / 100;
  const cityLabel = city.city.includes(",")
    ? city.city.split(",")[0].trim()
    : city.city;

  const isTop3 = rank <= 3;
  const medalColor = MEDAL_COLORS[rank];
  const { strokeWidth: sw, radius: r, circumference } = getCircleMetrics(isTop3);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        rank === 1 && styles.firstPlace,
      ]}
      onPress={() => onPress(city)}
    >
      {rank === 1 && <GoldSheen />}
      <Text
        style={[
          styles.rank,
          medalColor && { color: medalColor },
        ]}
      >
        {isTop3
          ? rank === 1
            ? "🥇"
            : rank === 2
              ? "🥈"
              : "🥉"
          : `#${rank}`}
      </Text>

      <View
        style={[
          styles.scoreCircle,
          isTop3 && medalColor && {
            shadowColor: medalColor,
            shadowOpacity: 0.45,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={r}
            stroke={colors.border.accent}
            strokeWidth={sw}
            fill="none"
          />
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={r}
            stroke={scoreColor}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.scoreLabel}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {city.score}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.cityName} numberOfLines={1}>
          {cityLabel}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.momentum, { color: momentum.color }]}>
            {momentum.arrow} {city.momentum}
          </Text>
          <Text style={styles.eventCount}>
            {city.eventCount} event{city.eventCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {city.distanceMiles !== undefined && (
        <Text style={styles.distance}>
          {city.distanceMiles < 1
            ? "<1 mi"
            : `${Math.round(city.distanceMiles)} mi`}
        </Text>
      )}

      <ChevronRight
        size={16}
        color={isTop3 && medalColor ? medalColor : colors.text.secondary}
      />
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    firstPlace: {
      overflow: "hidden",
    },
    pressed: {
      backgroundColor: colors.bg.card,
    },
    rank: {
      width: 28,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
    },
    scoreCircle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    scoreLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    scoreText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    cityName: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    meta: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    momentum: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      textTransform: "capitalize",
    },
    eventCount: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    distance: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
  });

export default SpaceCityCard;
