import DateRangeCalendar from "@/components/DateRangeCalendar";
import { useFilterStore } from "@/stores/useFilterStore";
import { format, parseISO } from "date-fns";
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const { filters, activeFilterIds, applyFilters, createFilter, clearFilters } =
    useFilterStore();
  const scale = useSharedValue(1);

  // Determine if we're in filtered mode (has date range filter) or relevant mode (no filters)
  const isFilteredMode = useMemo(() => {
    if (activeFilterIds.length === 0) return false;

    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    return !!(
      activeFilter?.criteria?.dateRange?.start &&
      activeFilter?.criteria?.dateRange?.end
    );
  }, [filters, activeFilterIds]);

  // Sync date range on mount - start in relevant mode
  useEffect(() => {
    if (activeFilterIds.length === 0 && filters.length === 0) {
      // Start in relevant mode (MapMoji filtered)
      console.log("Starting in relevant mode (MapMoji filtered)");
    }
  }, []);

  // Reset local loading state when modal closes
  useEffect(() => {
    if (!showCalendar) {
      setIsLocalLoading(false);
    }
  }, [showCalendar]);

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
    setIsClosing(false);
    setShowCalendar(true);
  }, []);

  // Close with exit animation — mark closing, let calendar animate out, then destroy
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShowCalendar(false);
      setIsClosing(false);
    }, 300);
  }, []);

  const handleDateRangeSelect = useCallback(
    async (startDate: string | null, endDate: string | null) => {
      if (!startDate || !endDate) return;

      setIsLocalLoading(true);

      try {
        // Create a new filter for the date range
        const newFilter = await createFilter({
          name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
          criteria: {
            dateRange: { start: startDate, end: endDate },
          },
        });

        // Apply the newly created filter to switch to filtered mode
        await applyFilters([newFilter.id]);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error("Error creating date range filter:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsLocalLoading(false);
        setShowCalendar(false);
      }
    },
    [createFilter, applyFilters],
  );

  const handleClearFilters = useCallback(async () => {
    try {
      await clearFilters();
      setShowCalendar(false);
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
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          {!isClosing && (
            <DateRangeCalendar
              startDate={
                filters.find((f) => activeFilterIds.includes(f.id))?.criteria
                  ?.dateRange?.start || undefined
              }
              endDate={
                filters.find((f) => activeFilterIds.includes(f.id))?.criteria
                  ?.dateRange?.end || undefined
              }
              onDateRangeSelect={handleDateRangeSelect}
              onClose={handleClose}
              isLoading={isLocalLoading}
              onClearFilters={handleClearFilters}
              isFilteredMode={isFilteredMode}
            />
          )}
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
