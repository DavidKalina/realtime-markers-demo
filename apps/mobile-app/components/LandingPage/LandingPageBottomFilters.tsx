import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SlidersHorizontal } from "lucide-react-native";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;

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
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const showCities = availableCities.length > 1;
  const hasCategories = categories && categories.length > 0;

  const openSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateY.setValue(SHEET_HEIGHT);
    setSheetOpen(true);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  const dismissSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSheetOpen(false));
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || gesture.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setSheetOpen(false));
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const handleCategoryPress = useCallback(
    (category: Category) => {
      Haptics.selectionAsync();
      if (sheetOpen) {
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setSheetOpen(false);
          router.push({
            pathname: "/category/[id]" as const,
            params: { id: category.id },
          });
        });
      } else {
        router.push({
          pathname: "/category/[id]" as const,
          params: { id: category.id },
        });
      }
    },
    [router, sheetOpen, translateY],
  );

  const handleDistanceChange = useCallback(
    (distance: number) => {
      Haptics.selectionAsync();
      onDistanceChange(distance);
    },
    [onDistanceChange],
  );

  const handleCityChange = useCallback(
    (city: string | null) => {
      Haptics.selectionAsync();
      onCityChange(city);
    },
    [onCityChange],
  );

  return (
    <>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <TouchableOpacity
          onPress={openSheet}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <SlidersHorizontal
            size={16}
            color={colors.text.secondary}
            strokeWidth={2}
          />
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryChips}
        >
          {/* Distance chip - taps open sheet */}
          <TouchableOpacity
            onPress={openSheet}
            style={[styles.chip, styles.chipSelected]}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, styles.chipTextSelected]}>
              {selectedDistance} mi
            </Text>
          </TouchableOpacity>

          {/* City chip - shown only when selected */}
          {selectedCity && (
            <TouchableOpacity
              onPress={openSheet}
              style={[styles.chip, styles.chipSelected]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, styles.chipTextSelected]}>
                {selectedCity}
              </Text>
            </TouchableOpacity>
          )}

          {/* Category chips */}
          {hasCategories &&
            categories.map((cat, index) => {
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
      </View>

      {/* Bottom sheet modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismissSheet}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <Pressable style={styles.backdrop} onPress={dismissSheet} />

          {/* Sheet */}
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY }] },
            ]}
          >
            {/* Handle */}
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollInner}
              showsVerticalScrollIndicator={false}
            >
              {/* Distance section */}
              <Text style={styles.sectionLabel}>Distance</Text>
              <View style={styles.chipWrap}>
                {DISTANCE_OPTIONS.map((distance) => {
                  const isSelected = selectedDistance === distance;
                  return (
                    <TouchableOpacity
                      key={distance}
                      onPress={() => handleDistanceChange(distance)}
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
              </View>

              {/* City section */}
              {showCities && (
                <>
                  <Text style={styles.sectionLabel}>City</Text>
                  <View style={styles.chipWrap}>
                    <TouchableOpacity
                      onPress={() => handleCityChange(null)}
                      style={[
                        styles.chip,
                        !selectedCity && styles.chipSelected,
                      ]}
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
                          onPress={() => handleCityChange(city)}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
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
                  </View>
                </>
              )}

              {/* Categories section */}
              {hasCategories && (
                <>
                  <Text style={styles.sectionLabel}>Categories</Text>
                  <View style={styles.chipWrap}>
                    {categories.map((cat, index) => {
                      const color =
                        CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.chip, { borderColor: color + "40" }]}
                          onPress={() => handleCategoryPress(cat)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[styles.dot, { backgroundColor: color }]}
                          />
                          <Text
                            style={[styles.chipText, { color }]}
                            numberOfLines={1}
                          >
                            {titleCase(cat.name)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Summary bar
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing._6,
  },
  iconButton: {
    paddingLeft: spacing.lg,
    paddingRight: spacing._6,
    paddingVertical: 4,
  },
  summaryChips: {
    paddingRight: spacing.lg,
    gap: spacing._6,
    alignItems: "center",
  },

  // Shared chip styles
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

  // Bottom sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.secondary,
  },
  sheetScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetScrollInner: {
    paddingBottom: 20,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing._6,
  },
});

export default LandingPageBottomFilters;
