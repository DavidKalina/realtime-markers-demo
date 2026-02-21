import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { COLORS } from "./Layout/ScreenLayout";
import * as Haptics from "expo-haptics";

// Helper for dimmed text color
const getDimmedTextColor = (baseColor: string, opacity: number = 0.5) => {
  if (baseColor.startsWith("#") && baseColor.length === 7) {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(173, 181, 189, ${opacity})`;
};

interface EmbeddedDateRangeCalendarProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

// Add helper function to check if a date is at least 15 minutes in the future
const isAtLeast15MinutesInFuture = (date: Date) => {
  const now = new Date();
  const minDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
  return date >= minDate;
};

const TimeSelector: React.FC<{
  date: Date;
  onTimeChange: (date: Date) => void;
}> = ({ date, onTimeChange }) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const displayHours = hours % 12 || 12;
  const isPM = hours >= 12;

  const hoursOffset = useSharedValue(0);
  const minutesOffset = useSharedValue(0);

  const updateHours = useCallback(
    (newHours: number) => {
      const normalizedHours = ((newHours % 24) + 24) % 24;
      const newDate = new Date(date.getTime());
      newDate.setHours(
        normalizedHours,
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
      );

      // Always update the time, but show warning if invalid
      onTimeChange(newDate);

      // Provide haptic feedback only if the time is invalid
      if (!isAtLeast15MinutesInFuture(newDate)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [date, onTimeChange],
  );

  const updateMinutes = useCallback(
    (newMinutes: number) => {
      const normalizedMinutes = ((newMinutes % 60) + 60) % 60;
      const newDate = new Date(date.getTime());
      newDate.setHours(
        date.getHours(),
        normalizedMinutes,
        date.getSeconds(),
        date.getMilliseconds(),
      );

      // Always update the time, but show warning if invalid
      onTimeChange(newDate);

      // Provide haptic feedback only if the time is invalid
      if (!isAtLeast15MinutesInFuture(newDate)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [date, onTimeChange],
  );

  const toggleAmPm = useCallback(() => {
    const newHour = isPM ? hours - 12 : hours + 12;
    const newDate = new Date(date.getTime());
    newDate.setHours(
      newHour,
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    );

    // Always update the time, but show warning if invalid
    onTimeChange(newDate);

    // Provide haptic feedback only if the time is invalid
    if (!isAtLeast15MinutesInFuture(newDate)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [date, hours, isPM, onTimeChange]);

  // Add warning text if time is invalid
  const isTimeValid = isAtLeast15MinutesInFuture(date);

  const hoursGesture = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      hoursOffset.value = e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      if (Math.abs(e.translationY) > 20) {
        const direction = e.translationY > 0 ? -1 : 1;
        runOnJS(updateHours)(hours + direction);
      }
      hoursOffset.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
    });

  const minutesGesture = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      minutesOffset.value = e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      if (Math.abs(e.translationY) > 20) {
        const direction = e.translationY > 0 ? -1 : 1;
        runOnJS(updateMinutes)(minutes + direction);
      }
      minutesOffset.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
    });

  const hoursAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hoursOffset.value }],
  }));

  const minutesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: minutesOffset.value }],
  }));

  return (
    <View style={styles.timeSelector}>
      <View style={styles.timePickerContainer}>
        <View style={styles.timeBlockContainer}>
          <View style={styles.timeBlockMask}>
            <GestureDetector gesture={hoursGesture}>
              <Animated.View style={[styles.timeBlock, hoursAnimatedStyle]}>
                <Text
                  style={[
                    styles.timeText,
                    !isTimeValid && styles.invalidTimeText,
                  ]}
                >
                  {displayHours.toString().padStart(2, "0")}
                </Text>
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
        <Text
          style={[styles.timeSeparator, !isTimeValid && styles.invalidTimeText]}
        >
          :
        </Text>
        <View style={styles.timeBlockContainer}>
          <View style={styles.timeBlockMask}>
            <GestureDetector gesture={minutesGesture}>
              <Animated.View style={[styles.timeBlock, minutesAnimatedStyle]}>
                <Text
                  style={[
                    styles.timeText,
                    !isTimeValid && styles.invalidTimeText,
                  ]}
                >
                  {minutes.toString().padStart(2, "0")}
                </Text>
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.amPmButton,
            isPM && styles.amPmButtonActive,
            !isTimeValid && styles.invalidAmPmButton,
          ]}
          onPress={toggleAmPm}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.amPmText,
              isPM && styles.amPmTextActive,
              !isTimeValid && styles.invalidTimeText,
            ]}
          >
            {isPM ? "PM" : "AM"}
          </Text>
        </TouchableOpacity>
      </View>
      {!isTimeValid && (
        <Text style={styles.warningText}>
          Must be at least 15 minutes in the future
        </Text>
      )}
    </View>
  );
};

const EmbeddedDateRangeCalendar: React.FC<EmbeddedDateRangeCalendarProps> = ({
  date,
  onDateChange,
}) => {
  const [currentMonth, setCurrentMonth] = useState(date);

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
    (selectedDate: Date) => {
      // Create a new date object and preserve the time from the current date
      const newDate = new Date(selectedDate.getTime());
      // Get the local hours and minutes from the current date
      const currentHours = date.getHours();
      const currentMinutes = date.getMinutes();
      // Set the hours and minutes in the local timezone while preserving seconds and milliseconds
      newDate.setHours(
        currentHours,
        currentMinutes,
        date.getSeconds(),
        date.getMilliseconds(),
      );

      // Only update if the new date is valid
      if (isAtLeast15MinutesInFuture(newDate)) {
        onDateChange(newDate);
      } else {
        // Provide haptic feedback for invalid date
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [date, onDateChange],
  );

  // Handle month navigation
  const handlePrevMonth = useCallback(() => {
    if (canGoBack) {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  }, [canGoBack]);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  // Get day styles based on selection state
  const getDayStyles = useCallback(
    (dayDate: Date) => {
      const isSelected = dayDate.toDateString() === date.toDateString();
      const isDisabled = !isAtLeast15MinutesInFuture(dayDate);

      return {
        container: [
          styles.dayContainer,
          isSelected && styles.selectedDay,
          isDisabled && styles.disabledDay,
        ],
        text: [
          styles.dayText,
          isSelected && styles.selectedDayText,
          !isSameMonth(dayDate, currentMonth) && styles.otherMonthDay,
          isToday(dayDate) && styles.todayText,
          isDisabled && styles.disabledDayText,
        ],
      };
    },
    [date, currentMonth],
  );

  return (
    <View style={styles.container}>
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
                ? COLORS.accent
                : getDimmedTextColor(COLORS.textPrimary, 0.4)
            }
          />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.monthText}>
            {format(currentMonth, "MMMM yyyy")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleNextMonth}
          style={styles.monthNavButton}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={COLORS.accent} />
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
        {daysInMonth.map((dayDate, index) => {
          if (dayDate === null) {
            return <View key={`empty-${index}`} style={styles.dayContainer} />;
          }
          const { container, text } = getDayStyles(dayDate);
          return (
            <TouchableOpacity
              key={dayDate.toISOString()}
              style={container}
              onPress={() => handleDayPress(dayDate)}
            >
              <Text style={text}>{format(dayDate, "d")}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.timeSelectorContainer}>
        <GestureHandlerRootView>
          <TimeSelector date={date} onTimeChange={onDateChange} />
        </GestureHandlerRootView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  monthText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  monthNavButtonDisabled: {
    opacity: 0.5,
  },
  weekDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  weekDayText: {
    width: 40,
    textAlign: "center",
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
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
    marginBottom: 8,
    borderRadius: 12,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  selectedDay: {
    backgroundColor: COLORS.accent,
  },
  selectedDayText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  otherMonthDay: {
    color: COLORS.textSecondary,
  },
  todayText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  disabledDay: {
    opacity: 0.4,
  },
  disabledDayText: {
    color: COLORS.textSecondary,
  },
  timeSelectorContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  timeSelector: {
    alignItems: "center",
    gap: 8,
  },
  timePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeBlockContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: "hidden",
  },
  timeBlockMask: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  timeBlock: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 20,
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 1,
  },
  timeSeparator: {
    fontSize: 20,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 2,
  },
  amPmButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  amPmButtonActive: {
    backgroundColor: COLORS.accent,
  },
  amPmText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  amPmTextActive: {
    color: COLORS.background,
  },
  invalidTimeText: {
    color: COLORS.errorText,
  },
  invalidAmPmButton: {
    borderColor: COLORS.errorText,
  },
  warningText: {
    color: COLORS.errorText,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
});

export default EmbeddedDateRangeCalendar;
