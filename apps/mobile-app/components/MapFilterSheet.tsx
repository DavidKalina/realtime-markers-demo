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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SlidersHorizontal } from "lucide-react-native";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
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

interface MapFilterSheetProps {
  categories: Category[];
  includedCategoryIds: string[];
  excludedCategoryIds: string[];
  onCategoryFilterChange: (
    categoryId: string,
    mode: "include" | "exclude" | "none",
  ) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

const CATEGORY_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#fda4af"];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

const MapFilterSheet: React.FC<MapFilterSheetProps> = ({
  categories,
  includedCategoryIds,
  excludedCategoryIds,
  onCategoryFilterChange,
  onClearAll,
  hasActiveFilters,
}) => {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

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

  const getCategoryFilterState = useCallback(
    (categoryId: string): "include" | "exclude" | "none" => {
      if (includedCategoryIds.includes(categoryId)) return "include";
      if (excludedCategoryIds.includes(categoryId)) return "exclude";
      return "none";
    },
    [includedCategoryIds, excludedCategoryIds],
  );

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      const current = getCategoryFilterState(categoryId);
      onCategoryFilterChange(
        categoryId,
        current === "include" ? "none" : "include",
      );
    },
    [getCategoryFilterState, onCategoryFilterChange],
  );

  const handleCategoryLongPress = useCallback(
    (categoryId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const current = getCategoryFilterState(categoryId);
      onCategoryFilterChange(
        categoryId,
        current === "exclude" ? "none" : "exclude",
      );
    },
    [getCategoryFilterState, onCategoryFilterChange],
  );

  return (
    <>
      {/* FAB filter button */}
      <TouchableOpacity
        style={homeScreenStyles.recenterButton}
        onPress={openSheet}
        activeOpacity={0.7}
      >
        <SlidersHorizontal size={22} color={colors.accent.primary} />
        {hasActiveFilters && <View style={styles.badge} />}
      </TouchableOpacity>

      {/* Bottom sheet modal */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismissSheet}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={dismissSheet} />

          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY }] },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollInner}
              showsVerticalScrollIndicator={false}
            >
              <View>
                <Text style={styles.sectionLabel}>Categories</Text>
                <Text style={styles.legendHint}>
                  Tap to include · Long-press to exclude
                </Text>
              </View>

              <View style={styles.chipWrap}>
                {categories.map((cat, index) => {
                  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  const filterState = getCategoryFilterState(cat.id);
                  const chipStyle =
                    filterState === "include"
                      ? styles.chipIncluded
                      : filterState === "exclude"
                        ? styles.chipExcluded
                        : { borderColor: color + "40" };
                  const dotColor =
                    filterState === "include"
                      ? colors.status.success.text
                      : filterState === "exclude"
                        ? colors.status.error.text
                        : color;
                  const textColor =
                    filterState === "include"
                      ? colors.status.success.text
                      : filterState === "exclude"
                        ? colors.status.error.text
                        : color;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, chipStyle]}
                      onPress={() => handleCategoryPress(cat.id)}
                      onLongPress={() => handleCategoryLongPress(cat.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[styles.dot, { backgroundColor: dotColor }]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: textColor },
                          filterState === "exclude" && styles.chipTextExcluded,
                        ]}
                        numberOfLines={1}
                      >
                        {titleCase(cat.name)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {hasActiveFilters && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={onClearAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearButtonText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.primary,
  },
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
  legendHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing._6,
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
  chipIncluded: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: colors.status.success.border,
  },
  chipExcluded: {
    backgroundColor: colors.status.error.bg,
    borderColor: colors.status.error.border,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
  },
  chipTextExcluded: {
    textDecorationLine: "line-through" as const,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  clearButton: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.status.error.border,
    backgroundColor: colors.status.error.bg,
  },
  clearButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.mono,
    color: colors.status.error.text,
  },
});

export default MapFilterSheet;
