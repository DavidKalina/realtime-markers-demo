import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
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

const MOMENTUM_ARROWS: Record<string, { arrow: string; color: string }> = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#f87171" },
};

const CIRCLE_SIZE = 36;
const STROKE_WIDTH = 3;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

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

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress(city)}
    >
      <Text style={styles.rank}>#{rank}</Text>

      <View style={styles.scoreCircle}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={CIRCLE_RADIUS}
            stroke={colors.border.accent}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={CIRCLE_RADIUS}
            stroke={scoreColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
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

      <ChevronRight size={16} color={colors.text.secondary} />
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
