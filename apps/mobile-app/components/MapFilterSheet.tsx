import React, { useCallback, useMemo, useRef, useState } from "react";
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
import {
  addDays,
  format,
  nextFriday,
  nextSunday,
  isFriday,
  isSaturday,
  isSunday,
} from "date-fns";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";
import { useFilterStore } from "@/stores/useFilterStore";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { getCategoryColor } from "@/utils/categoryColors";

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

interface Preset {
  label: string;
  getRange: () => { start: string; end: string };
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX = SCREEN_HEIGHT * 0.85;
const SHEET_MIN = SCREEN_HEIGHT * 0.32;
// translateY offsets for each snap position (sheet height is always SHEET_MAX)
const SNAP_EXPANDED = 0;
const SNAP_COLLAPSED = SHEET_MAX - SHEET_MIN;
const SNAP_DISMISSED = SHEET_MAX;

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());
const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

const buildPresets = (): Preset[] => {
  const today = new Date();

  return [
    {
      label: "Tonight",
      getRange: () => ({
        start: formatDate(today),
        end: formatDate(today),
      }),
    },
    {
      label: "This Weekend",
      getRange: () => {
        if (isSunday(today)) {
          return { start: formatDate(today), end: formatDate(today) };
        }
        const fri =
          isFriday(today) || isSaturday(today) ? today : nextFriday(today);
        const sun = isSunday(today) ? today : nextSunday(today);
        return { start: formatDate(fri), end: formatDate(sun) };
      },
    },
    {
      label: "This Week",
      getRange: () => {
        const sun = isSunday(today) ? today : nextSunday(today);
        return { start: formatDate(today), end: formatDate(sun) };
      },
    },
    {
      label: "Next 2 Weeks",
      getRange: () => ({
        start: formatDate(today),
        end: formatDate(addDays(today, 14)),
      }),
    },
  ];
};

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
  const translateY = useRef(new Animated.Value(SNAP_DISMISSED)).current;
  const snapRef = useRef<"collapsed" | "expanded">("collapsed");

  const { filters, activeFilterIds, createFilter, applyFilters, clearFilters } =
    useFilterStore();

  const presets = useMemo(() => buildPresets(), []);

  const isDateFiltered = useMemo(() => {
    if (activeFilterIds.length === 0) return false;
    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    return !!(
      activeFilter?.criteria?.dateRange?.start &&
      activeFilter?.criteria?.dateRange?.end
    );
  }, [filters, activeFilterIds]);

  const activePresetLabel = useMemo(() => {
    if (activeFilterIds.length === 0) return undefined;
    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    return activeFilter?.name;
  }, [filters, activeFilterIds]);

  const anyFilterActive = hasActiveFilters || isDateFiltered;

  const springTo = useCallback(
    (toValue: number, onDone?: () => void) => {
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(onDone);
    },
    [translateY],
  );

  const openSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateY.setValue(SNAP_DISMISSED);
    snapRef.current = "collapsed";
    setSheetOpen(true);
    springTo(SNAP_COLLAPSED);
  }, [translateY, springTo]);

  const dismissSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SNAP_DISMISSED,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSheetOpen(false);
      snapRef.current = "collapsed";
    });
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        const origin =
          snapRef.current === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED;
        const next = origin + gesture.dy;
        // Clamp: don't go above expanded, allow dragging down past collapsed
        translateY.setValue(Math.max(SNAP_EXPANDED, next));
      },
      onPanResponderRelease: (_, gesture) => {
        const origin =
          snapRef.current === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED;
        const current = origin + gesture.dy;

        if (snapRef.current === "collapsed") {
          // Swipe up → expand
          if (gesture.dy < -60 || gesture.vy < -0.5) {
            snapRef.current = "expanded";
            Animated.spring(translateY, {
              toValue: SNAP_EXPANDED,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }).start();
            return;
          }
          // Swipe down → dismiss
          if (gesture.dy > 80 || gesture.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: SNAP_DISMISSED,
              duration: 250,
              useNativeDriver: true,
            }).start(() => {
              setSheetOpen(false);
              snapRef.current = "collapsed";
            });
            return;
          }
        } else {
          // Expanded: swipe down → collapse
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            snapRef.current = "collapsed";
            Animated.spring(translateY, {
              toValue: SNAP_COLLAPSED,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }).start();
            return;
          }
        }

        // Snap back to current position
        const target =
          snapRef.current === "expanded" ? SNAP_EXPANDED : SNAP_COLLAPSED;
        Animated.spring(translateY, {
          toValue: target,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      },
    }),
  ).current;

  const handlePresetSelect = useCallback(
    (preset: Preset) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Toggle off if already active
      if (activePresetLabel === preset.label) {
        applyFilters([]).catch((error) => {
          console.error(
            "[MapFilterSheet] Clear filter error:",
            error?.message || error,
          );
        });
        return;
      }

      const { start, end } = preset.getRange();

      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: preset.label,
        message: "Filtering events...",
        notificationType: "info",
        duration: 3000,
        timestamp: Date.now(),
        source: "MapFilterSheet",
      });

      createFilter({
        name: preset.label,
        criteria: {
          dateRange: { start, end },
        },
      })
        .then((newFilter) => applyFilters([newFilter.id]))
        .catch((error) => {
          console.error(
            "[MapFilterSheet] Filter error:",
            error?.message || error,
          );
          eventBroker.emit(EventTypes.NOTIFICATION, {
            title: "Error",
            message: `Failed to apply filter: ${error?.message || "Unknown error"}`,
            notificationType: "error",
            duration: 5000,
            timestamp: Date.now(),
            source: "MapFilterSheet",
          });
        });
    },
    [createFilter, applyFilters, activePresetLabel],
  );

  const handleClearAll = useCallback(async () => {
    try {
      onClearAll();
      await clearFilters();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dismissSheet();
    } catch (error) {
      console.error("Error clearing filters:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [onClearAll, clearFilters, dismissSheet]);

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
        <SlidersHorizontal size={22} color={colors.action.share} />
        {anyFilterActive && <View style={styles.badge} />}
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
              {anyFilterActive && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollInner}
              showsVerticalScrollIndicator={false}
            >
              {/* When section */}
              <Text style={styles.sectionLabel}>When</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetRow}
              >
                {presets.map((preset) => {
                  const isActive = activePresetLabel === preset.label;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[
                        styles.presetButton,
                        isActive && styles.presetButtonActive,
                      ]}
                      onPress={() => handlePresetSelect(preset)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.presetLabel,
                          isActive && styles.presetLabelActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Categories section */}
              <View>
                <Text style={styles.sectionLabel}>Categories</Text>
                <Text style={styles.legendHint}>
                  Tap to include · Long-press to exclude
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScrollContent}
              >
                <View style={styles.chipRows}>
                  {[0, 1, 2].map((row) => (
                    <View key={row} style={styles.chipRow}>
                      {categories
                        .filter((_, i) => i % 3 === row)
                        .map((cat) => {
                          const color = getCategoryColor(cat.name);
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
                              onLongPress={() =>
                                handleCategoryLongPress(cat.id)
                              }
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.dot,
                                  { backgroundColor: dotColor },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.chipText,
                                  { color: textColor },
                                  filterState === "exclude" &&
                                    styles.chipTextExcluded,
                                ]}
                                numberOfLines={1}
                              >
                                {titleCase(cat.name)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  ))}
                </View>
              </ScrollView>
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
    backgroundColor: colors.action.share,
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
    height: SHEET_MAX,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  presetRow: {
    gap: spacing.sm,
  },
  presetButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  presetButtonActive: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.border,
  },
  presetLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  presetLabelActive: {
    color: colors.accent.primary,
  },
  chipScrollContent: {
    paddingRight: spacing.sm,
  },
  chipRows: {
    gap: spacing._6,
  },
  chipRow: {
    flexDirection: "row",
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
    position: "absolute",
    right: 20,
    top: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
