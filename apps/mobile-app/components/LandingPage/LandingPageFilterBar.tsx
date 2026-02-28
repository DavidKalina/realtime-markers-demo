import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

const DISTANCE_OPTIONS = [5, 10, 15, 25, 50] as const;

interface LandingPageFilterBarProps {
  selectedDistance: number;
  onDistanceChange: (distance: number) => void;
  availableCities: string[];
  selectedCity: string | null;
  onCityChange: (city: string | null) => void;
}

const LandingPageFilterBar: React.FC<LandingPageFilterBarProps> = ({
  selectedDistance,
  onDistanceChange,
  availableCities,
  selectedCity,
  onCityChange,
}) => {
  const showCityRow = availableCities.length > 1;

  return (
    <View style={styles.container}>
      {/* Distance chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
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
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {distance} mi
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* City tabs */}
      {showCityRow && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.accent.primary,
  },
});

export default LandingPageFilterBar;
