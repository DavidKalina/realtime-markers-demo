import React, { memo, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  radius,
  type Colors,
} from "@/theme";
import { getCategoryColor } from "@/utils/categoryColors";

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

const EventDnaChart: React.FC<EventDnaChartProps> = memo(
  ({ categories, label = "EVENT DNA" }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.chipRow}>
          {categories.map((cat, i) => {
            const color = getCategoryColor(cat.name);
            const chip = (
              <Animated.View
                key={cat.id ?? cat.name}
                entering={FadeInRight.delay(i * 60).duration(350)}
                style={[
                  styles.chip,
                  {
                    borderColor: `${color}33`,
                    backgroundColor: `${color}14`,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color }]}>{cat.name}</Text>
              </Animated.View>
            );

            if (cat.id) {
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/category/${cat.id}`);
                  }}
                  activeOpacity={0.7}
                >
                  {chip}
                </TouchableOpacity>
              );
            }

            return chip;
          })}
        </View>
      </View>
    );
  },
);

EventDnaChart.displayName = "EventDnaChart";

export default EventDnaChart;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      textTransform: "lowercase",
      letterSpacing: 0.5,
    },
  });
