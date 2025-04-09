import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Pressable, StyleSheet, Text, View, Modal, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  cancelAnimation,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  Easing,
  Layout,
} from "react-native-reanimated";
import { Calendar } from "lucide-react-native";
import { useFilterStore } from "@/stores/useFilterStore";
import * as Haptics from "expo-haptics";
import DateRangeCalendar from "./DateRangeCalendar";
import { format, parseISO, addDays } from "date-fns";

// Unified color theme (from EventDetailsHeader)
const COLORS = {
  background: "#2a2a2a",
  cardBackground: "#3a3a3a",
  textPrimary: "#f8f9fa",
  textSecondary: "#93c5fd", // Blue
  accent: "#93c5fd", // Blue

  divider: "rgba(147, 197, 253, 0.12)",
  buttonBackground: "rgba(147, 197, 253, 0.1)",
  buttonBorder: "rgba(147, 197, 253, 0.15)",

  success: "#40c057",
  successBackground: "rgba(64, 192, 87, 0.12)",
  successBorder: "rgba(64, 192, 87, 0.2)",

  iconUser: "#ff922b", // Orange
  iconEngagement: "#a5d8ff", // Light Blue
  iconVerified: "#69db7c", // Green
  iconDateTime: "#ffd43b", // Yellow
  iconLocation: "#ff8787", // Red
  iconCategories: "#da77f2", // Purple
  iconDefault: "#93c5fd", // Default blue
};

// Helper to generate icon background color (from EventDetailsHeader)
const getIconBackgroundColor = (color: string) => {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  }
  return 'rgba(147, 197, 253, 0.15)'; // Fallback
};

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
  const pulseScale = useSharedValue(1);

  // Get active filters with date ranges
  const activeDateFilters = useMemo(() => {
    // First get all active filters based on activeFilterIds
    const activeFilters = filters.filter((f) => activeFilterIds.includes(f.id));

    // Then filter for those with date ranges
    const dateFilters = activeFilters.filter((f) => {
      // Check if the filter has a dateRange in its criteria
      const hasDateRange = f.criteria?.dateRange && (
        f.criteria.dateRange.start ||
        f.criteria.dateRange.end
      );
      return hasDateRange;
    });
    return dateFilters;
  }, [filters, activeFilterIds]);

  // Format date range for display
  const dateRangeText = useMemo(() => {
    if (activeDateFilters.length === 0) {
      // Default to 2 weeks from today
      const today = new Date();
      const twoWeeksFromNow = addDays(today, 14);
      return `${format(today, "MMM d")} - ${format(twoWeeksFromNow, "MMM d")}`;
    }

    const filter = activeDateFilters[0]; // Take the first active filter with date range
    const { start, end } = filter.criteria.dateRange || {};

    if (!start || !end) {
      // Default to 2 weeks from today if no range is set
      const today = new Date();
      const twoWeeksFromNow = addDays(today, 14);
      return `${format(today, "MMM d")} - ${format(twoWeeksFromNow, "MMM d")}`;
    }

    return `${format(parseISO(start), "MMM d")} - ${format(parseISO(end), "MMM d")}`;
  }, [activeDateFilters]);

  // Update animations when loading state changes
  useEffect(() => {
    if (isLoading) {
      iconOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
      loaderOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite loop
        true // Reverse direction on repeat
      );
    } else {
      iconOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
      loaderOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isLoading]);

  // Cleanup animations
  const cleanupAnimations = useCallback(() => {
    if (!isMounted.current) return;
    cancelAnimation(modalAnim);
    modalAnim.value = 0;
    cancelAnimation(pulseScale);
  }, [modalAnim, pulseScale]);

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
      // If no dates are provided, default to 2 weeks from today
      if (!startDate || !endDate) {
        const today = new Date();
        const twoWeeksFromNow = addDays(today, 14);
        startDate = format(today, 'yyyy-MM-dd');
        endDate = format(twoWeeksFromNow, 'yyyy-MM-dd');
      }

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
        targetFilter = await createFilter({
          name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
          criteria: {
            dateRange: { start: startDate, end: endDate }
          },
        });
      } else {
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
        await updateFilter(targetFilter.id, updatedFilter);
        // Then ensure it's the only active filter
        await applyFilters([targetFilter.id]);
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
              { transform: [{ scale: pulseScale }] },
              styles.indicator,
              activeDateFilters.length > 0 && styles.indicatorExpanded,
              activeDateFilters.length > 0 && styles.indicatorActive,
              isLoading && styles.indicatorLoading
            ]}
            layout={Layout.springify().damping(20).mass(0.5).stiffness(200)}
          >
            <View style={[
              styles.iconContainer,
              !isLoading && { backgroundColor: getIconBackgroundColor(COLORS.accent) },
              activeDateFilters.length > 0 && styles.iconContainerExpanded,
              activeDateFilters.length > 0 && styles.iconContainerActive
            ]}>
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { opacity: iconOpacity }
                ]}
              >
                <Calendar size={14} color={COLORS.accent} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.loaderWrapper,
                  { opacity: loaderOpacity }
                ]}
              >
                <View style={styles.activityIndicator}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
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
      </View >

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
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 8,
    height: 40,
    width: 40,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  indicatorExpanded: {
    width: 180,
    paddingRight: 12,
    justifyContent: "flex-start",
  },
  indicatorActive: {
    borderColor: `rgba(${parseInt(COLORS.accent.slice(1, 3), 16)}, ${parseInt(COLORS.accent.slice(3, 5), 16)}, ${parseInt(COLORS.accent.slice(5, 7), 16)}, 0.4)`,
  },
  indicatorLoading: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerExpanded: {
    marginRight: 8,
  },
  iconContainerActive: {
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
    color: COLORS.accent,
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(42, 42, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CalendarIndicator;
