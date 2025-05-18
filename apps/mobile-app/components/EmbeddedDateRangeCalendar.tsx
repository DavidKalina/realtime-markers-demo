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
  setHours,
  setMinutes,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "./Layout/ScreenLayout";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

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

// Helper for RGBA background from hex
const getRgbaBackground = (hexColor: string, opacity: number) => {
  if (hexColor.startsWith("#") && hexColor.length === 7) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(147, 197, 253, ${opacity})`;
};

interface EmbeddedDateRangeCalendarProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

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
      onTimeChange(newDate);
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
      onTimeChange(newDate);
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
    onTimeChange(newDate);
  }, [date, hours, isPM, onTimeChange]);

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
      <View style={styles.timeBlockContainer}>
        <View style={styles.timeBlockMask}>
          <GestureDetector gesture={hoursGesture}>
            <Animated.View style={[styles.timeBlock, hoursAnimatedStyle]}>
              <Text style={styles.timeText}>
                {displayHours.toString().padStart(2, "0")}
              </Text>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <Text style={styles.timeSeparator}>:</Text>
      <View style={styles.timeBlockContainer}>
        <View style={styles.timeBlockMask}>
          <GestureDetector gesture={minutesGesture}>
            <Animated.View style={[styles.timeBlock, minutesAnimatedStyle]}>
              <Text style={styles.timeText}>
                {minutes.toString().padStart(2, "0")}
              </Text>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.amPmButton, isPM && styles.amPmButtonActive]}
        onPress={toggleAmPm}
        activeOpacity={0.8}
      >
        <Text style={[styles.amPmText, isPM && styles.amPmTextActive]}>
          {isPM ? "PM" : "AM"}
        </Text>
      </TouchableOpacity>
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
      onDateChange(newDate);
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
      const isDisabled = dayDate < new Date(new Date().setHours(0, 0, 0, 0));

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
});

export default EmbeddedDateRangeCalendar;
