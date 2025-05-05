import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { COLORS } from "../Layout/ScreenLayout";
import { ChevronUp, ChevronDown } from "lucide-react-native";
import { format, setHours, setMinutes, getHours, getMinutes } from "date-fns";

interface SwipeableClockProps {
  date: Date;
  onChange: (date: Date) => void;
}

const AmPmToggle: React.FC<{
  date: Date;
  onChange: (date: Date) => void;
}> = ({ date, onChange }) => {
  const isPM = date.getUTCHours() >= 12;

  const handleAmPmChange = (isPM: boolean) => {
    const currentHour = date.getUTCHours();
    const newHour = isPM
      ? currentHour < 12
        ? currentHour + 12
        : currentHour
      : currentHour >= 12
      ? currentHour - 12
      : currentHour;
    const newDate = new Date(date);
    newDate.setUTCHours(newHour);
    onChange(newDate);
  };

  return (
    <View style={styles.amPmToggleContainer}>
      <TouchableOpacity
        style={[styles.amPmButton, !isPM && styles.amPmButtonActive]}
        onPress={() => handleAmPmChange(false)}
        activeOpacity={0.8}
      >
        <Text style={[styles.amPmText, !isPM && styles.amPmTextActive]}>AM</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.amPmButton, isPM && styles.amPmButtonActive]}
        onPress={() => handleAmPmChange(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.amPmText, isPM && styles.amPmTextActive]}>PM</Text>
      </TouchableOpacity>
    </View>
  );
};

const SwipeableClock: React.FC<SwipeableClockProps> = ({ date, onChange }) => {
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const displayHours = hours % 12 || 12; // Convert 24h to 12h format

  const updateHours = (newHours: number) => {
    const normalizedHours = ((newHours % 24) + 24) % 24;
    const newDate = new Date(date);
    newDate.setUTCHours(normalizedHours);
    onChange(newDate);
  };

  const updateMinutes = (newMinutes: number) => {
    const normalizedMinutes = ((newMinutes % 60) + 60) % 60;
    const newDate = new Date(date);
    newDate.setUTCMinutes(normalizedMinutes);
    onChange(newDate);
  };

  const renderTimeBlock = (
    value: number,
    max: number,
    onIncrement: () => void,
    onDecrement: () => void
  ) => (
    <View style={styles.timeBlock}>
      <TouchableOpacity style={styles.timeButton} onPress={onIncrement} activeOpacity={0.8}>
        <ChevronUp size={18} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.timeText}>{value.toString().padStart(2, "0")}</Text>
      <TouchableOpacity style={styles.timeButton} onPress={onDecrement} activeOpacity={0.8}>
        <ChevronDown size={18} color={COLORS.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.timeRow}>
        <View style={styles.timeContainer}>
          {renderTimeBlock(
            displayHours,
            12,
            () => updateHours(hours + 1),
            () => updateHours(hours - 1)
          )}
          <Text style={styles.separator}>:</Text>
          {renderTimeBlock(
            minutes,
            59,
            () => updateMinutes(minutes + 1),
            () => updateMinutes(minutes - 1)
          )}
        </View>
        <AmPmToggle date={date} onChange={onChange} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: 36,
    width: "100%",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  timeBlock: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    minWidth: 70,
    width: 80,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  timeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.buttonBackground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginVertical: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  timeText: {
    fontSize: 28,
    fontFamily: "SpaceMono",
    color: COLORS.textPrimary,
    textAlign: "center",
    fontWeight: "700",
    letterSpacing: 2,
    marginVertical: 2,
  },
  separator: {
    fontSize: 28,
    marginHorizontal: 6,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    marginBottom: 0,
  },
  amPmToggleContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  amPmButton: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: "transparent",
  },
  amPmButtonActive: {
    backgroundColor: COLORS.accent,
  },
  amPmText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 1,
  },
  amPmTextActive: {
    color: COLORS.background,
  },
});

export default SwipeableClock;
