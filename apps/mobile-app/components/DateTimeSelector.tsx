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
import * as Haptics from "expo-haptics";
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
  return `rgba(173, 181, 189, ${opacity})`; // Fallback grey
};

// Helper for RGBA background from hex
const getRgbaBackground = (hexColor: string, opacity: number) => {
  if (hexColor.startsWith("#") && hexColor.length === 7) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(147, 197, 253, ${opacity})`; // Fallback accent
};

interface DateTimeSelectorProps {
  selectedDate?: string;
  onDateSelect: (date: string | null) => void;
  isLoading?: boolean;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  selectedDate,
  onDateSelect,
  isLoading = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Initialize with today's date if no date is provided
  React.useEffect(() => {
    if (!selectedDate) {
      const today = new Date();
      const dateString = format(today, "yyyy-MM-dd");
      onDateSelect(dateString);
    }
  }, []);

  // Helper function to check if a date is in the past
  const isPastDate = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

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
    (date: Date) => {
      if (isPastDate(date)) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const dateString = format(date, "yyyy-MM-dd");
      onDateSelect(dateString);
    },
    [isPastDate, onDateSelect]
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

  // Get day styles based on selection state
  const getDayStyles = useCallback(
    (date: Date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const isSelected = dateString === selectedDate;
      const isDisabled = isPastDate(date);

      return {
        container: [
          styles.dayContainer,
          isSelected && styles.selectedDay,
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
    [selectedDate, currentMonth, isPastDate]
  );

  return (
    <View style={styles.container}>
      <View style={styles.calendarContainer}>
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
          {daysInMonth.map((date) => {
            const { container, text } = getDayStyles(date);
            return (
              <TouchableOpacity
                key={date.toISOString()}
                style={container}
                onPress={() => handleDayPress(date)}
                disabled={isLoading}
              >
                <Text style={text}>{format(date, "d")}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.dateInfo}>
        {selectedDate ? (
          <Text style={styles.selectedDateText}>
            {format(new Date(selectedDate), "MMMM d, yyyy")}
          </Text>
        ) : (
          <Text style={styles.placeholderText}>Select a date</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  calendarContainer: {
    padding: 16,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    marginBottom: 8,
  },
  weekDayText: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
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
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderRadius: 10,
  },
  dayText: {
    fontSize: 13,
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
  dateInfo: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    alignItems: "center",
  },
  selectedDateText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  placeholderText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  disabledDay: {
    opacity: 0.4,
  },
  disabledDayText: {
    color: COLORS.textSecondary,
  },
});

export default DateTimeSelector;
