import React, { memo, useEffect, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { CategoryPieChart } from "../AreaScan/AreaScanComponents";
import { colors, spacing, fontSize, fontWeight, fontFamily } from "@/theme";

const CATEGORY_COLORS = [
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#fb923c",
] as const;

export interface DnaCategory {
  id?: string;
  name: string;
  pct?: number;
}

interface EventDnaChartProps {
  categories: DnaCategory[];
  variant?: "chart" | "bar";
  label?: string;
}

function AnimatedBarSegment({
  color,
  flex,
  index,
  isFirst,
  isLast,
}: {
  color: string;
  flex: number;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 80,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: flex * progress.value,
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[
        dnStyles.barSegment,
        { backgroundColor: color },
        isFirst && dnStyles.barSegmentFirst,
        isLast && dnStyles.barSegmentLast,
        animatedStyle,
      ]}
    />
  );
}

const EventDnaChart: React.FC<EventDnaChartProps> = memo(
  ({ categories, variant = "chart", label = "EVENT DNA" }) => {
    const router = useRouter();

    const breakdown = useMemo(
      () =>
        categories.map((cat) => ({
          name: cat.name,
          pct: cat.pct ?? Math.round(100 / categories.length),
        })),
      [categories],
    );

    const chartColors = useMemo(
      () =>
        categories.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
      [categories],
    );

    const renderLegendItem = (
      category: DnaCategory,
      index: number,
      showPct: boolean,
    ) => {
      const pct = breakdown[index].pct;
      const content = (
        <>
          <View
            style={[
              dnStyles.legendDot,
              { backgroundColor: chartColors[index] },
            ]}
          />
          <Text style={dnStyles.legendText}>
            {category.name}
            {showPct ? ` ${pct}%` : ""}
          </Text>
        </>
      );

      if (category.id) {
        return (
          <TouchableOpacity
            key={category.id ?? category.name}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/category/${category.id}`);
            }}
            style={dnStyles.legendItem}
            activeOpacity={0.7}
          >
            {content}
          </TouchableOpacity>
        );
      }

      return (
        <View key={category.name} style={dnStyles.legendItem}>
          {content}
        </View>
      );
    };

    return (
      <View style={dnStyles.container}>
        <Text style={dnStyles.label}>{label}</Text>
        {variant === "chart" ? (
          <View>
            <View style={dnStyles.pieRow}>
              <CategoryPieChart
                breakdown={breakdown}
                colors={[...chartColors]}
              />
            </View>
            <View style={dnStyles.legend}>
              {categories.map((cat, i) => renderLegendItem(cat, i, true))}
            </View>
          </View>
        ) : (
          <View>
            <View style={dnStyles.bar}>
              {categories.map((cat, index) => (
                <AnimatedBarSegment
                  key={cat.id ?? cat.name}
                  color={chartColors[index]}
                  flex={breakdown[index].pct}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === categories.length - 1}
                />
              ))}
            </View>
            <View style={dnStyles.legend}>
              {categories.map((cat, i) => renderLegendItem(cat, i, true))}
            </View>
          </View>
        )}
      </View>
    );
  },
);

EventDnaChart.displayName = "EventDnaChart";

export default EventDnaChart;

const dnStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  pieRow: {
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    gap: 2,
  },
  barSegment: {
    height: "100%",
  },
  barSegmentFirst: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  barSegmentLast: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: colors.text.detail,
  },
});
