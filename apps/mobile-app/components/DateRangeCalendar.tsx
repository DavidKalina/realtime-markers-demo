import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  cancelAnimation,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
} from "react-native-reanimated";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  spring,
} from "@/theme";

// Helper for dimmed text color
const getDimmedTextColor = (baseColor: string, opacity: number = 0.5) => {
  if (baseColor.startsWith("#") && baseColor.length === 7) {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(173, 181, 189, ${opacity})`; // Fallback grey
};

interface DateRangeCalendarProps {
  startDate?: string;
  endDate?: string;
  onDateRangeSelect: (startDate: string | null, endDate: string | null) => void;
  onClose: () => void;
  isLoading?: boolean;
  onClearFilters?: () => void;
  isFilteredMode?: boolean;
}

const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  onDateRangeSelect,
  onClose,
  isLoading = false,
  onClearFilters,
  isFilteredMode,
}) => {
  const [selectedStartDate, setSelectedStartDate] = useState<
    string | undefined
  >(startDate);
  const [selectedEndDate, setSelectedEndDate] = useState<string | undefined>(
    endDate,
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMounted = useRef(true);
  const slideAnim = useSharedValue(0);
  const containerAnim = useSharedValue(0);

  // Initialize with default 2-week range if no dates are provided
  useEffect(() => {
    if (!selectedStartDate || !selectedEndDate) {
      const today = new Date();
      const twoWeeksFromNow = addDays(today, 14);
      setSelectedStartDate(format(today, "yyyy-MM-dd"));
      setSelectedEndDate(format(twoWeeksFromNow, "yyyy-MM-dd"));
    }
  }, []);

  // Helper function to check if a date is in the past
  const isPastDate = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

  // Cleanup animations
  const cleanupAnimations = useCallback(() => {
    if (!isMounted.current) return;
    cancelAnimation(slideAnim);
    cancelAnimation(containerAnim);
    slideAnim.value = 0;
    containerAnim.value = 0;
  }, [slideAnim, containerAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanupAnimations();
    };
  }, [cleanupAnimations]);

  // Handle close with animation cleanup
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanupAnimations();
    onClose();
  }, [onClose, cleanupAnimations]);

  // Check if we can navigate to previous month
  const canGoBack = useMemo(() => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    return currentMonthStart > startOfMonth(today);
  }, [currentMonth]);

  // Get all days in the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Get the first day of the month (0-6, where 0 is Sunday)
    const firstDayOfMonth = start.getDay();

    // Get all days in the current month
    const days = eachDayOfInterval({ start, end });

    // Add padding days at the start to align with the week grid
    const paddingDays = Array(firstDayOfMonth).fill(null);

    return [...paddingDays, ...days];
  }, [currentMonth]);

  // Handle date selection
  const handleDayPress = useCallback(
    (date: Date) => {
      if (isPastDate(date)) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Format the date in UTC to avoid timezone issues
      const dateString = format(date, "yyyy-MM-dd");

      if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
        // Start new selection
        setSelectedStartDate(dateString);
        setSelectedEndDate(undefined);
      } else {
        // Complete selection
        const start = parseISO(selectedStartDate);
        const end = parseISO(dateString);

        if (end < start) {
          // If end date is before start date, swap them
          setSelectedEndDate(selectedStartDate);
          setSelectedStartDate(dateString);
        } else {
          setSelectedEndDate(dateString);
        }
      }
    },
    [selectedStartDate, selectedEndDate, isPastDate],
  );

  // Handle month navigation
  const handlePrevMonth = useCallback(() => {
    if (canGoBack) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  }, [canGoBack]);

  const handleNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  // Handle date range selection
  const handleConfirmSelection = useCallback(() => {
    if (selectedStartDate && selectedEndDate) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDateRangeSelect(selectedStartDate, selectedEndDate);
      onClose();
    }
  }, [selectedStartDate, selectedEndDate, onDateRangeSelect, onClose]);

  // Handle reset - set to default 2-week range
  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const today = new Date();
    const twoWeeksFromNow = addDays(today, 14);
    setSelectedStartDate(format(today, "yyyy-MM-dd"));
    setSelectedEndDate(format(twoWeeksFromNow, "yyyy-MM-dd"));
    onDateRangeSelect(
      format(today, "yyyy-MM-dd"),
      format(twoWeeksFromNow, "yyyy-MM-dd"),
    );
  }, [onDateRangeSelect]);

  // Format date range text
  const dateRangeText = useMemo(() => {
    if (!selectedStartDate || !selectedEndDate) return "";

    const start = parseISO(selectedStartDate);
    const end = parseISO(selectedEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "1 day";
    if (diffDays === 1) return "1 day";
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    return `${Math.floor(diffDays / 30)} months`;
  }, [selectedStartDate, selectedEndDate]);

  // Get day styles based on selection state
  const getDayStyles = useCallback(
    (date: Date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const isSelected =
        dateString === selectedStartDate || dateString === selectedEndDate;
      const isInRange =
        selectedStartDate &&
        selectedEndDate &&
        date > parseISO(selectedStartDate) &&
        date < parseISO(selectedEndDate);
      const isStart = dateString === selectedStartDate;
      const isEnd = dateString === selectedEndDate;
      const isDisabled = isPastDate(date);

      return {
        container: [
          styles.dayContainer,
          isSelected && styles.selectedDay,
          isInRange && styles.rangeDay,
          isStart && styles.startDay,
          isEnd && styles.endDay,
          isDisabled && styles.disabledDay,
        ],
        text: [
          styles.dayText,
          isSelected && styles.selectedDayText,
          !isSameMonth(date, currentMonth) && styles.otherMonthDay,
          isToday(date) && styles.todayText,
          isDisabled && styles.disabledDayText,
        ],
      };
    },
    [selectedStartDate, selectedEndDate, currentMonth, isPastDate],
  );

  return (
    <Animated.View
      style={styles.container}
      entering={SlideInDown.springify()
        .damping(spring.firm.damping)
        .stiffness(spring.dropdown.stiffness)}
      exiting={SlideOutDown.springify()
        .damping(spring.firm.damping)
        .stiffness(spring.dropdown.stiffness)
        .withCallback((finished) => {
          if (finished) {
            scheduleOnRN(cleanupAnimations);
          }
        })}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <X size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Calendar</Text>
      </View>

      <View style={styles.calendarContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={[
              styles.monthNavButton,
              !canGoBack && styles.monthNavButtonDisabled,
            ]}
            disabled={!canGoBack}
            activeOpacity={canGoBack ? 0.7 : 1}
          >
            <ChevronLeft
              size={20}
              color={
                canGoBack
                  ? colors.accent.primary
                  : getDimmedTextColor(colors.text.primary, 0.4)
              }
            />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {format(currentMonth, "MMMM yyyy")}
          </Text>
          <TouchableOpacity
            onPress={handleNextMonth}
            style={styles.monthNavButton}
            activeOpacity={0.7}
          >
            <ChevronRight size={20} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekDays}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={styles.weekDayText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {daysInMonth.map((date, index) => {
            if (date === null) {
              return (
                <View key={`empty-${index}`} style={styles.dayContainer} />
              );
            }
            const { container, text } = getDayStyles(date);
            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={container}
                onPress={() => handleDayPress(date)}
              >
                <Text style={text}>{format(date, "d")}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Animated.View style={styles.dateRangeInfo}>
          {selectedStartDate && selectedEndDate ? (
            <>
              <Text style={styles.dateRangeText}>
                {format(parseISO(selectedStartDate), "MMM d")} -{" "}
                {format(parseISO(selectedEndDate), "MMM d")}
              </Text>
              <Text style={styles.dateRangeDuration}>{dateRangeText}</Text>
            </>
          ) : (
            <Text style={styles.placeholderText}>Select a date range</Text>
          )}
        </Animated.View>

        <View style={styles.buttonContainer}>
          {isFilteredMode && onClearFilters ? (
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={onClearFilters}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : (
                <Text style={styles.clearButtonText}>Show Relevant</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={handleReset}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : (
                <Text style={styles.resetButtonText}>Reset</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              isLoading && styles.confirmButtonLoading,
            ]}
            onPress={handleConfirmSelection}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    maxWidth: 500,
    borderRadius: radius["2xl"],
    overflow: "hidden",
    width: "90%",
    maxHeight: "75%",
    shadowColor: colors.shadow.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
    marginRight: 36,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  calendarContainer: {
    padding: spacing.xl,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  monthText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  monthNavButtonDisabled: {
    opacity: 0.5,
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  weekDayText: {
    width: 40,
    textAlign: "center",
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  selectedDay: {
    backgroundColor: colors.accent.primary,
  },
  selectedDayText: {
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  rangeDay: {
    backgroundColor: colors.accent.muted,
  },
  startDay: {
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  endDay: {
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  otherMonthDay: {
    color: colors.text.secondary,
  },
  todayText: {
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.lg,
  },
  dateRangeInfo: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  dateRangeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dateRangeDuration: {
    fontSize: fontSize.sm,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  button: {
    flex: 1,
    height: spacing["5xl"],
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  resetButton: {
    backgroundColor: colors.border.subtle,
    borderColor: colors.border.medium,
  },
  resetButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  confirmButton: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.border,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  placeholderText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  confirmButtonLoading: {
    opacity: 0.7,
  },
  disabledDay: {
    opacity: 0.4,
  },
  disabledDayText: {
    color: colors.text.secondary,
  },
  clearButton: {
    backgroundColor: colors.border.subtle,
    borderColor: colors.border.medium,
  },
  clearButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default DateRangeCalendar;
