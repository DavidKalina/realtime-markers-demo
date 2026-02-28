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
  const showCities = availableCities.length > 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
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

      {showCities && (
        <>
          <View style={styles.divider} />
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
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing._6,
    alignItems: "center",
  },
  chip: {
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
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.accent.primary,
  },
  divider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border.accent,
    marginHorizontal: 2,
  },
});

export default LandingPageFilterBar;
