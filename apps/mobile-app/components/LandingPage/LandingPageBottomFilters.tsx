import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

const DISTANCE_OPTIONS = [5, 10, 15, 25, 50] as const;

const CATEGORY_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#fda4af"];

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

interface LandingPageBottomFiltersProps {
  selectedDistance: number;
  onDistanceChange: (distance: number) => void;
  availableCities: string[];
  selectedCity: string | null;
  onCityChange: (city: string | null) => void;
  categories: Category[];
}

const LandingPageBottomFilters: React.FC<LandingPageBottomFiltersProps> = ({
  selectedDistance,
  onDistanceChange,
  availableCities,
  selectedCity,
  onCityChange,
  categories,
}) => {
  const router = useRouter();

  const showCities = availableCities.length > 1;
  const hasCategories = categories && categories.length > 0;

  const handleCategoryPress = useCallback(
    (category: Category) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/category/[id]" as const,
        params: { id: category.id },
      });
    },
    [router],
  );

  return (
    <View style={styles.container}>
      {/* Distance row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {DISTANCE_OPTIONS.map((distance) => {
          const isSelected = selectedDistance === distance;
          return (
            <TouchableOpacity
              key={distance}
              onPress={() => onDistanceChange(distance)}
              style={[styles.chip, isSelected && styles.chipSelected]}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {distance} mi
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* City row */}
      {showCities && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <TouchableOpacity
            onPress={() => onCityChange(null)}
            style={[styles.chip, !selectedCity && styles.chipSelected]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                !selectedCity && styles.chipTextSelected,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {availableCities.map((city) => {
            const isSelected = selectedCity === city;
            return (
              <TouchableOpacity
                key={city}
                onPress={() => onCityChange(city)}
                style={[styles.chip, isSelected && styles.chipSelected]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {city}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Categories row */}
      {hasCategories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {categories.map((cat, index) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { borderColor: color + "40" }]}
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.7}
              >
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.chipText, { color }]} numberOfLines={1}>
                  {titleCase(cat.name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing._6,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing._6,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing._6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chipSelected: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.border,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
  },
  chipTextSelected: {
    color: colors.accent.primary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default LandingPageBottomFilters;
