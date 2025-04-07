import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Pressable, StyleSheet, Text, View, Modal, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  cancelAnimation,
  FadeIn,
  FadeOut,
  Easing,
  Layout,
} from "react-native-reanimated";
import { Calendar } from "lucide-react-native";
import { useFilterStore } from "@/stores/useFilterStore";
import * as Haptics from "expo-haptics";
import DateRangeCalendar from "./DateRangeCalendar";
import { format, parseISO } from "date-fns";

// Pre-define animations to avoid recreation
const FADE_IN = FadeIn.duration(200);
const FADE_OUT = FadeOut.duration(200);
const LAYOUT_CONFIG = {
  duration: 200,
  damping: 20,
  mass: 0.5,
  stiffness: 200,
  overshootClamping: true,
};

const CalendarIndicator: React.FC = React.memo(() => {
  const { filters, activeFilterIds, updateFilter, applyFilters, clearFilters, createFilter, isLoading } =
    useFilterStore();
  const [showCalendar, setShowCalendar] = useState(false);
  const isMounted = useRef(true);
  const modalAnim = useSharedValue(0);
  const lastActiveFilterIds = useRef<string[]>([]);
  const lastFilters = useRef<any[]>([]);
  const iconOpacity = useSharedValue(1);
  const loaderOpacity = useSharedValue(0);

  // Get active filters with date ranges
  const activeDateFilters = useMemo(() => {
    // Check if filters or activeFilterIds have changed
    const filtersChanged = lastFilters.current !== filters;
    const activeIdsChanged = lastActiveFilterIds.current !== activeFilterIds;

    if (!filtersChanged && !activeIdsChanged) {
      return lastFilters.current;
    }

    // Update refs
    lastFilters.current = filters;
    lastActiveFilterIds.current = activeFilterIds;

    // First get all active filters based on activeFilterIds
    const activeFilters = filters.filter((f) => activeFilterIds.includes(f.id));
    // Then filter for those with date ranges
    return activeFilters.filter((f) => f.criteria?.dateRange);
  }, [filters, activeFilterIds]);

  // Format date range for display
  const dateRangeText = useMemo(() => {
    if (activeDateFilters.length === 0) return 'Select dates';

    const filter = activeDateFilters[0]; // Take the first active filter with date range
    const { start, end } = filter.criteria.dateRange || {};

    if (!start && !end) return 'Select dates';

    if (start && end) {
      return `${format(parseISO(start), "MMM d")} - ${format(parseISO(end), "MMM d")}`;
    }

    if (start) {
      return `From ${format(parseISO(start), "MMM d")}`;
    }
    if (end) {
      return `Until ${format(parseISO(end), "MMM d")}`;
    }
    return 'Select dates';
  }, [activeDateFilters]);

  // Update animations when loading state changes
  useEffect(() => {
    if (isLoading) {
      iconOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
      loaderOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
    } else {
      iconOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
      loaderOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
    }
  }, [isLoading]);

  // Cleanup animations
  const cleanupAnimations = useCallback(() => {
    if (!isMounted.current) return;
    cancelAnimation(modalAnim);
    modalAnim.value = 0;
  }, [modalAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanupAnimations();
    };
  }, [cleanupAnimations]);

  // Handle modal close with cleanup
  const handleCloseModal = useCallback(() => {
    cleanupAnimations();
    setShowCalendar(false);
  }, [cleanupAnimations]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCalendar(true);
  }, []);

  const handleDateRangeSelect = useCallback(
    async (startDate: string | null, endDate: string | null) => {
      // Get either the active filter or fall back to the oldest filter
      let targetFilter =
        filters.find((f) => activeFilterIds.includes(f.id)) ||
        (filters.length > 0
          ? filters.reduce((oldest, current) => {
            return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
          })
          : null);

      // If no filter exists, create a new one
      if (!targetFilter) {
        if (startDate && endDate) {
          targetFilter = await createFilter({
            name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
            criteria: {
              dateRange: { start: startDate, end: endDate }
            },
          });
        } else {
          // If no date range is provided, we can't create a filter
          throw new Error("Date range is required for the first filter");
        }
      }

      if (startDate === null && endDate === null) {
        // Clear the date range while preserving other criteria
        const { dateRange, ...restCriteria } = targetFilter.criteria;
        const updatedFilter = {
          ...targetFilter,
          criteria: restCriteria,
        };
        // Update the filter and clear active filters
        updateFilter(targetFilter.id, updatedFilter).then(() => {
          clearFilters();
        });
      } else if (startDate && endDate) {
        // Update the filter with new date range while preserving other criteria
        const updatedFilter = {
          ...targetFilter,
          // Only update the name if there's no semantic query
          ...(targetFilter.semanticQuery ? {} : {
            name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
          }),
          criteria: {
            ...targetFilter.criteria,
            dateRange: { start: startDate, end: endDate },
          },
        };
        // First update the filter
        updateFilter(targetFilter.id, updatedFilter).then(() => {
          // Then ensure it's the only active filter
          applyFilters([targetFilter.id]);
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCalendar(false);
    },
    [filters, activeFilterIds, updateFilter, applyFilters, clearFilters, createFilter]
  );

  return (
    <>
      <View>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.pressable,
            pressed && { opacity: 0.8 }
          ]}
          disabled={isLoading}
        >
          <Animated.View
            style={[
              styles.indicator,
              activeDateFilters.length > 0 && styles.indicatorExpanded,
              activeDateFilters.length > 0 && styles.indicatorActive,
              isLoading && styles.indicatorLoading
            ]}
            layout={Layout.springify().damping(20).mass(0.5).stiffness(200)}
          >
            <View style={[
              styles.iconContainer,
              activeDateFilters.length > 0 && styles.iconContainerExpanded,
              activeDateFilters.length > 0 && styles.iconContainerActive
            ]}>
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { opacity: iconOpacity }
                ]}
              >
                <Calendar size={14} color="#93c5fd" />
              </Animated.View>
              <Animated.View
                style={[
                  styles.loaderWrapper,
                  { opacity: loaderOpacity }
                ]}
              >
                <View style={styles.activityIndicator}>
                  <ActivityIndicator size="small" color="#93c5fd" />
                </View>
              </Animated.View>
            </View>

            <Animated.View
              style={[
                styles.textContainer,
                activeDateFilters.length > 0 && styles.textContainerExpanded
              ]}
              layout={Layout.springify().damping(20).mass(0.5).stiffness(200)}
            >
              {dateRangeText === 'Select dates' ? (
                <Animated.Text
                  key="default"
                  entering={FADE_IN}
                  exiting={FADE_OUT}
                  style={styles.dateText}
                >
                  {dateRangeText}
                </Animated.Text>
              ) : (
                <Animated.Text
                  key="date-range"
                  entering={FADE_IN}
                  exiting={FADE_OUT}
                  style={styles.dateText}
                >
                  {dateRangeText}
                </Animated.Text>
              )}
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>

      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <Animated.View style={styles.modalOverlay} entering={FADE_IN} exiting={FADE_OUT}>
          <DateRangeCalendar
            startDate={activeDateFilters[0]?.criteria.dateRange?.start}
            endDate={activeDateFilters[0]?.criteria.dateRange?.end}
            onDateRangeSelect={handleDateRangeSelect}
            onClose={handleCloseModal}
            isLoading={isLoading}
          />
        </Animated.View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  pressable: {
    width: "auto",
  },
  indicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 51, 51, 0.92)",
    borderRadius: 16,
    padding: 8,
    height: 40,
    width: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  indicatorExpanded: {
    width: 180,
    paddingRight: 8,
    justifyContent: "flex-start",
  },
  indicatorActive: {
    backgroundColor: "rgba(51, 51, 51, 0.95)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  indicatorLoading: {
    opacity: 0.9,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  iconContainerExpanded: {
    marginRight: 8,
  },
  iconContainerActive: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
  },
  iconWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 1,
  },
  loaderWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  activityIndicator: {
    opacity: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 24,
    opacity: 0,
  },
  textContainerExpanded: {
    opacity: 1,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    lineHeight: 16,
    color: "#93c5fd",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CalendarIndicator;
