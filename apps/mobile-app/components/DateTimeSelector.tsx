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
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "./Layout/ScreenLayout";
import ClockTimePicker from "./ClockTimePicker";

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
  startDate?: string;
  endDate?: string;
  onDateRangeSelect: (startDate: string | null, endDate: string | null) => void;
  isLoading?: boolean;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  startDate,
  endDate,
  onDateRangeSelect,
  isLoading = false,
}) => {
  const [selectedStartDate, setSelectedStartDate] = useState<string | undefined>(startDate);
  const [selectedEndDate, setSelectedEndDate] = useState<string | undefined>(endDate);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Initialize with default 2-week range if no dates are provided
  React.useEffect(() => {
    if (!selectedStartDate || !selectedEndDate) {
      const today = new Date();
      const twoWeeksFromNow = addDays(today, 14);
      setSelectedStartDate(format(today, "yyyy-MM-dd'T'HH:mm"));
      setSelectedEndDate(format(twoWeeksFromNow, "yyyy-MM-dd'T'HH:mm"));
      onDateRangeSelect(
        format(today, "yyyy-MM-dd'T'HH:mm"),
        format(twoWeeksFromNow, "yyyy-MM-dd'T'HH:mm")
      );
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

  // Handle time selection
  const handleStartTimeChange = useCallback(
    (newTime: string) => {
      setShowStartTimePicker(false);
      if (selectedStartDate) {
        const date = parseISO(selectedStartDate);
        const newDate = parseISO(newTime);
        const updatedDate = setHours(setMinutes(date, newDate.getMinutes()), newDate.getHours());
        const newDateString = format(updatedDate, "yyyy-MM-dd'T'HH:mm");
        setSelectedStartDate(newDateString);
        onDateRangeSelect(newDateString, selectedEndDate || null);
      }
    },
    [selectedStartDate, selectedEndDate, onDateRangeSelect]
  );

  const handleEndTimeChange = useCallback(
    (newTime: string) => {
      setShowEndTimePicker(false);
      if (selectedEndDate) {
        const date = parseISO(selectedEndDate);
        const newDate = parseISO(newTime);
        const updatedDate = setHours(setMinutes(date, newDate.getMinutes()), newDate.getHours());
        const newDateString = format(updatedDate, "yyyy-MM-dd'T'HH:mm");
        setSelectedEndDate(newDateString);
        onDateRangeSelect(selectedStartDate || null, newDateString);
      }
    },
    [selectedStartDate, selectedEndDate, onDateRangeSelect]
  );

  // Handle date selection
  const handleDayPress = useCallback(
    (date: Date) => {
      if (isPastDate(date)) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const dateString = format(date, "yyyy-MM-dd'T'HH:mm");

      if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
        // Start new selection
        setSelectedStartDate(dateString);
        setSelectedEndDate(undefined);
        onDateRangeSelect(dateString, null);
      } else {
        // Complete selection
        const start = parseISO(selectedStartDate);
        const end = parseISO(dateString);

        if (end < start) {
          // If end date is before start date, swap them
          setSelectedEndDate(selectedStartDate);
          setSelectedStartDate(dateString);
          onDateRangeSelect(dateString, selectedStartDate);
        } else {
          setSelectedEndDate(dateString);
          onDateRangeSelect(selectedStartDate, dateString);
        }
      }
    },
    [selectedStartDate, selectedEndDate, isPastDate, onDateRangeSelect]
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
      const isSelected = dateString === selectedStartDate || dateString === selectedEndDate;
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
    [selectedStartDate, selectedEndDate, currentMonth, isPastDate]
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

      <View style={styles.dateRangeInfo}>
        {selectedStartDate && selectedEndDate ? (
          <>
            <View style={styles.timeSelectionContainer}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
                disabled={isLoading}
              >
                <Text style={styles.timeButtonText}>
                  {format(parseISO(selectedStartDate), "h:mm a")}
                </Text>
              </TouchableOpacity>
              <Text style={styles.dateRangeText}>
                {format(parseISO(selectedStartDate), "MMM d")} -{" "}
                {format(parseISO(selectedEndDate), "MMM d")}
              </Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
                disabled={isLoading}
              >
                <Text style={styles.timeButtonText}>
                  {format(parseISO(selectedEndDate), "h:mm a")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dateRangeDuration}>{dateRangeText}</Text>
          </>
        ) : (
          <Text style={styles.placeholderText}>Select a date range</Text>
        )}
      </View>

      <ClockTimePicker
        time={selectedStartDate || format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        onChange={handleStartTimeChange}
        onClose={() => setShowStartTimePicker(false)}
        isVisible={showStartTimePicker}
      />

      <ClockTimePicker
        time={selectedEndDate || format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        onChange={handleEndTimeChange}
        onClose={() => setShowEndTimePicker(false)}
        isVisible={showEndTimePicker}
      />
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
  rangeDay: {
    backgroundColor: getRgbaBackground(COLORS.accent, 0.15),
  },
  startDay: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  endDay: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  otherMonthDay: {
    color: COLORS.textSecondary,
  },
  todayText: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  dateRangeInfo: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    alignItems: "center",
  },
  dateRangeText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateRangeDuration: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: "SpaceMono",
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
  timeSelectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  timeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginHorizontal: 8,
  },
  timeButtonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
});

export default DateTimeSelector;
