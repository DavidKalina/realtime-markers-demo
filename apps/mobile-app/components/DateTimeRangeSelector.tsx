import React from "react";
import { StyleSheet, View } from "react-native";
import DateTimeSelector from "./DateTimeSelector";
import TimeSelector from "./TimeSelector";
import { COLORS } from "./Layout/ScreenLayout";

interface DateTimeRangeSelectorProps {
  startDate?: string;
  endDate?: string;
  onDateRangeSelect: (startDate: string | null, endDate: string | null) => void;
  isLoading?: boolean;
}

const DateTimeRangeSelector: React.FC<DateTimeRangeSelectorProps> = ({
  startDate,
  endDate,
  onDateRangeSelect,
  isLoading = false,
}) => {
  const handleStartTimeChange = (newTime: string) => {
    if (startDate && endDate) {
      onDateRangeSelect(newTime, endDate);
    }
  };

  const handleEndTimeChange = (newTime: string) => {
    if (startDate && endDate) {
      onDateRangeSelect(startDate, newTime);
    }
  };

  return (
    <View style={styles.container}>
      <DateTimeSelector
        startDate={startDate}
        endDate={endDate}
        onDateRangeSelect={onDateRangeSelect}
        isLoading={isLoading}
      />

      {startDate && endDate && (
        <View style={styles.timeSelectorsContainer}>
          <TimeSelector
            time={startDate}
            onChange={handleStartTimeChange}
            disabled={isLoading}
            label="Start Time"
          />
          <TimeSelector
            time={endDate}
            onChange={handleEndTimeChange}
            disabled={isLoading}
            label="End Time"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  timeSelectorsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});

export default DateTimeRangeSelector;
