import DateRangeCalendar from "@/components/DateRangeCalendar";
import { useFilterStore } from "@/stores/useFilterStore";
import { format, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";
import { Calendar } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";

const ANIMATION_CONFIG = {
  damping: 10,
  stiffness: 200,
};

const ROTATION_CONFIG = {
  duration: 100,
  easing: Easing.inOut(Easing.ease),
};

const DateRangeIndicator: React.FC = () => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const { filters, activeFilterIds, updateFilter, applyFilters, createFilter } =
    useFilterStore();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const textOpacity = useSharedValue(1);
  const prevDateRangeRef = useRef<string>("");

  // Sync date range on mount
  useEffect(() => {
    if (activeFilterIds.length === 0 && filters.length > 0) {
      applyFilters([filters[0].id]);
    }
  }, []);

  // Reset local loading state when modal closes
  useEffect(() => {
    if (!showCalendar) {
      setIsLocalLoading(false);
    }
  }, [showCalendar]);

  // Format date range for display
  const dateRangeText = useMemo(() => {
    if (filters.length === 0 || activeFilterIds.length === 0) {
      return "Calendar";
    }

    const activeFilter = filters.find((f) => activeFilterIds.includes(f.id));
    if (!activeFilter?.criteria?.dateRange) {
      return "Calendar";
    }

    const { start, end } = activeFilter.criteria.dateRange;
    if (!start || !end) {
      return "Calendar";
    }

    return `${format(parseISO(start), "M/d")} – ${format(parseISO(end), "M/d")}`;
  }, [filters, activeFilterIds]);

  // Animate text opacity when date range changes
  useEffect(() => {
    if (prevDateRangeRef.current !== dateRangeText) {
      cancelAnimation(textOpacity);
      textOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );
      prevDateRangeRef.current = dateRangeText;
    }
  }, [dateRangeText]);

  const handlePress = useCallback(() => {
    // Cancel any ongoing animations before starting new ones
    cancelAnimation(scale);
    cancelAnimation(rotation);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withSpring(0.95, ANIMATION_CONFIG),
      withSpring(1, ANIMATION_CONFIG),
    );
    rotation.value = withSequence(
      withTiming(-5, ROTATION_CONFIG),
      withTiming(5, ROTATION_CONFIG),
      withTiming(0, ROTATION_CONFIG),
    );
    setShowCalendar(true);
  }, []);

  const handleDateRangeSelect = useCallback(
    async (startDate: string | null, endDate: string | null) => {
      if (!startDate || !endDate) return;

      setIsLocalLoading(true);
      let targetFilter = filters.find((f) => activeFilterIds.includes(f.id));

      // If no target filer, check for oldest filter that only has date/time criteria
      if (!targetFilter) {
        targetFilter = filters.find((f) => !f.semanticQuery);
      }

      try {
        if (!targetFilter) {
          targetFilter = await createFilter({
            name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
            criteria: {
              dateRange: { start: startDate, end: endDate },
            },
          });
          // Apply the newly created filter
          await applyFilters([targetFilter.id]);
        } else {
          const updatedFilter = {
            ...targetFilter,
            ...(targetFilter.semanticQuery
              ? {}
              : {
                  name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
                }),
            criteria: {
              ...targetFilter.criteria,
              dateRange: { start: startDate, end: endDate },
            },
          };
          await updateFilter(targetFilter.id, updatedFilter);
          await applyFilters([targetFilter.id]);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error("Error updating date range:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsLocalLoading(false);
        setShowCalendar(false);
      }
    },
    [filters, activeFilterIds, createFilter, updateFilter, applyFilters],
  );

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotation);
      cancelAnimation(textOpacity);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <>
      <Pressable onPress={handlePress}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.iconContainer}>
            <Calendar size={12} color={COLORS.accent} />
          </View>
          <Animated.Text style={[styles.text, textAnimatedStyle]}>
            {dateRangeText}
          </Animated.Text>
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
                .dateRange?.start
            }
            endDate={
              filters.find((f) => activeFilterIds.includes(f.id))?.criteria
                .dateRange?.end
            }
            onDateRangeSelect={handleDateRangeSelect}
            onClose={() => setShowCalendar(false)}
            isLoading={isLocalLoading}
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
    gap: 6,
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${COLORS.accent}10`,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${COLORS.accent}20`,
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.accent,
    letterSpacing: 0.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.shadow,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(DateRangeIndicator);
