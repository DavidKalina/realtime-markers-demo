import TimeRangePresets from "@/components/TimeRangePresets";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { useFilterStore } from "@/stores/useFilterStore";
import * as Haptics from "expo-haptics";
import { Calendar } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, spacing, spring } from "@/theme";

const DateRangeIndicator: React.FC = () => {
  const [showPresets, setShowPresets] = useState(false);
  const { filters, activeFilterIds, applyFilters, createFilter, clearFilters } =
    useFilterStore();
  const scale = useSharedValue(1);

  // Determine if we're in filtered mode (has date range filter)
  const isFilteredMode = useMemo(() => {
    if (activeFilterIds.length === 0) return false;

    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    return !!(
      activeFilter?.criteria?.dateRange?.start &&
      activeFilter?.criteria?.dateRange?.end
    );
  }, [filters, activeFilterIds]);

  // Derive the active preset label from the active filter's name
  const activePresetLabel = useMemo(() => {
    if (activeFilterIds.length === 0) return undefined;
    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    return activeFilter?.name;
  }, [filters, activeFilterIds]);

  // Sync date range on mount - start in relevant mode
  useEffect(() => {
    if (activeFilterIds.length === 0 && filters.length === 0) {
      console.log("Starting in relevant mode (filtered)");
    }
  }, []);

  const handlePressIn = useCallback(() => {
    cancelAnimation(scale);
    scale.value = withSpring(0.85, spring.firm);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    cancelAnimation(scale);
    scale.value = withSpring(1, spring.bouncy);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPresets(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowPresets(false);
  }, []);

  const handlePresetSelect = useCallback(
    (start: string, end: string, label: string) => {
      // Close modal and give immediate feedback
      setShowPresets(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      eventBroker.emit(EventTypes.NOTIFICATION, {
        title: label,
        message: "Filtering events...",
        notificationType: "info",
        duration: 3000,
        timestamp: Date.now(),
        source: "DateRangeIndicator",
      });

      // API work happens in the background
      console.log("[DateRangeIndicator] Creating filter:", {
        label,
        start,
        end,
      });
      createFilter({
        name: label,
        criteria: {
          dateRange: { start, end },
        },
      })
        .then((newFilter) => {
          console.log("[DateRangeIndicator] Filter created:", newFilter.id);
          return applyFilters([newFilter.id]);
        })
        .then(() => {
          console.log("[DateRangeIndicator] Filter applied successfully");
        })
        .catch((error) => {
          console.error(
            "[DateRangeIndicator] Filter error:",
            error?.message || error,
          );
          eventBroker.emit(EventTypes.NOTIFICATION, {
            title: "Error",
            message: `Failed to apply filter: ${error?.message || "Unknown error"}`,
            notificationType: "error",
            duration: 5000,
            timestamp: Date.now(),
            source: "DateRangeIndicator",
          });
        });
    },
    [createFilter, applyFilters],
  );

  const handleClearFilters = useCallback(async () => {
    try {
      await clearFilters();
      setShowPresets(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error clearing filters:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [clearFilters]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
    };
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.container, animatedStyle]}>
          <Calendar size={22} color={colors.accent.primary} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={showPresets}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <TimeRangePresets
            onPresetSelect={handlePresetSelect}
            onClose={handleClose}
            onClearFilters={handleClearFilters}
            isFilteredMode={isFilteredMode}
            activePresetLabel={activePresetLabel}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing._6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: colors.fixed.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 52,
    minHeight: 52,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.shadow.default,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(DateRangeIndicator);
