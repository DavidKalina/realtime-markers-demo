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
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "./Layout/ScreenLayout";

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
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Handle date selection
  const handleDayPress = useCallback(
    (selectedDate: Date) => {
      // Create a new date object and preserve the time from the current date
      const newDate = new Date(selectedDate);
      // Get the local hours and minutes from the current date
      const currentHours = date.getHours();
      const currentMinutes = date.getMinutes();
      // Set the hours and minutes in the local timezone
      newDate.setHours(currentHours, currentMinutes, 0, 0);
      onDateChange(newDate);
    },
    [date, onDateChange]
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
    [date, currentMonth]
  );

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          style={[styles.monthNavButton, !canGoBack && styles.monthNavButtonDisabled]}
          disabled={!canGoBack}
          activeOpacity={canGoBack ? 0.7 : 1}
        >
          <ChevronLeft
            size={20}
            color={canGoBack ? COLORS.accent : getDimmedTextColor(COLORS.textPrimary, 0.4)}
          />
        </TouchableOpacity>
        <Text style={styles.monthText}>{format(currentMonth, "MMMM yyyy")}</Text>
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
        {daysInMonth.map((dayDate) => {
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
    color: COLORS.accent,
    fontWeight: "600",
  },
  disabledDay: {
    opacity: 0.4,
  },
  disabledDayText: {
    color: COLORS.textSecondary,
  },
});

export default EmbeddedDateRangeCalendar;
