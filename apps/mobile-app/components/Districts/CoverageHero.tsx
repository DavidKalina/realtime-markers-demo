import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import {
  useColors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  type Colors,
} from "@/theme";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

interface CoverageHeroProps {
  total: number;
  explored: number;
  districts: DistrictBrowseResponse[];
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CIRCLE_SIZE = 120;
const STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const STAT_ITEMS = [
  { label: "Districts", derive: "total" },
  { label: "Adventures", derive: "adventures" },
  { label: "Avg Rating", derive: "avgRating" },
  { label: "Adopted", derive: "adopted" },
] as const;

const CoverageHero: React.FC<CoverageHeroProps> = ({
  total,
  explored,
  districts,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress = useSharedValue(0);

  useEffect(() => {
    const target = total > 0 ? explored / total : 0;
    progress.value = withDelay(
      300,
      withTiming(target, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [total, explored, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const coverageColor = useMemo(() => {
    if (total === 0) return colors.text.secondary;
    const ratio = explored / total;
    if (ratio >= 0.7) return "#4ade80";
    if (ratio >= 0.3) return "#facc15";
    return colors.accent.primary;
  }, [total, explored, colors]);

  const stats = useMemo(() => {
    const totalAdventures = districts.reduce(
      (sum, d) => sum + d.itineraryCount,
      0,
    );
    const rated = districts.filter((d) => d.avgRating && d.avgRating > 0);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, d) => sum + (d.avgRating ?? 0), 0) / rated.length
        : 0;
    const totalAdopted = districts.reduce(
      (sum, d) => sum + d.totalAdoptions,
      0,
    );

    return {
      total,
      adventures: totalAdventures,
      avgRating,
      adopted: totalAdopted,
    };
  }, [districts, total]);

  const statColors = ["#86efac", "#60a5fa", "#fbbf24", "#a78bfa"];

  const coverageLabel = useMemo(() => {
    if (total === 0) return "No districts nearby";
    if (explored === total) return "All explored!";
    return `${total - explored} to discover`;
  }, [total, explored]);

  return (
    <Animated.View
      entering={FadeIn.duration(duration.normal)}
      style={styles.container}
    >
      <Text style={styles.label}>DISTRICT COVERAGE</Text>

      <View style={styles.topRow}>
        {/* Ring */}
        <View style={styles.circleWrapper}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={colors.border.accent}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={coverageColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.circleLabel}>
            <Text style={[styles.circleCount, { color: coverageColor }]}>
              {explored}
            </Text>
            <Text style={styles.circleDivider}>of {total}</Text>
          </View>
        </View>

        {/* Stats column */}
        <View style={styles.statsColumn}>
          {STAT_ITEMS.map((item, index) => {
            const value = stats[item.derive];
            const display =
              item.derive === "avgRating" && value > 0
                ? `\u2605 ${value.toFixed(1)}`
                : item.derive === "avgRating"
                  ? "\u2014"
                  : String(value);

            return (
              <View key={item.label} style={styles.statRow}>
                <View style={styles.statLabelRow}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: statColors[index] },
                    ]}
                  />
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
                <Text
                  style={[styles.statValue, { color: statColors[index] }]}
                >
                  {display}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Bottom summary */}
      <Text style={styles.coverageSubtitle}>{coverageLabel}</Text>
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing["3xl"],
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    circleWrapper: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    circleLabel: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    circleCount: {
      fontFamily: fontFamily.mono,
      fontSize: 32,
      fontWeight: fontWeight.bold,
    },
    circleDivider: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
      color: colors.text.secondary,
    },
    statsColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    statValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    coverageSubtitle: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      textAlign: "center",
    },
  });

export default React.memo(CoverageHero);
