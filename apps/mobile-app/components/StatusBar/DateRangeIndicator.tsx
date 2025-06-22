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
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";

const ANIMATION_CONFIG = {
  damping: 15,
  stiffness: 300,
};

const DateRangeIndicator: React.FC = () => {
  const [showCalendar, setShowCalendar] = useState(false);
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
      // Start in relevant mode (no filters applied)
      console.log("Starting in relevant mode (MapMoji filtered)");
    }
  }, []);

  // Reset local loading state when modal closes
  useEffect(() => {
    if (!showCalendar) {
      setIsLocalLoading(false);
    }
  }, [showCalendar]);

  const handlePress = useCallback(() => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.92, ANIMATION_CONFIG),
      withSpring(1, ANIMATION_CONFIG),
    );
    setShowCalendar(true);
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
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Pressable onPress={handlePress}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <Calendar size={20} color={COLORS.accent} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalOverlay}>
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
            onClose={() => setShowCalendar(false)}
            isLoading={isLocalLoading}
            onClearFilters={handleClearFilters}
            isFilteredMode={isFilteredMode}
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
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 44,
    minHeight: 44,
    maxWidth: 120, // Fixed width to maintain consistent button dimensions
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.shadow,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(DateRangeIndicator);
