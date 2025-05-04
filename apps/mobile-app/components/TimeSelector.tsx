import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Dimensions } from "react-native";
import { COLORS } from "./Layout/ScreenLayout";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const WINDOW_HEIGHT = Dimensions.get("window").height;

interface TimeSelectorProps {
  time: string;
  onChange: (newTime: string) => void;
  disabled?: boolean;
  label?: string;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ time, onChange, disabled = false, label }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => {
    const date = parseISO(time);
    return date.getHours();
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const date = parseISO(time);
    return date.getMinutes();
  });

  const hourScrollY = useSharedValue(0);
  const minuteScrollY = useSharedValue(0);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const handleTimePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPicker(!showPicker);
  }, [disabled, showPicker]);

  const handleHourSelect = useCallback(
    (hour: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedHour(hour);
      const date = parseISO(time);
      const newDate = setHours(date, hour);
      onChange(format(newDate, "yyyy-MM-dd'T'HH:mm"));
    },
    [time, onChange]
  );

  const handleMinuteSelect = useCallback(
    (minute: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMinute(minute);
      const date = parseISO(time);
      const newDate = setMinutes(date, minute);
      onChange(format(newDate, "yyyy-MM-dd'T'HH:mm"));
    },
    [time, onChange]
  );

  const hourItemStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 }],
      opacity: 1,
    };
  });

  const minuteItemStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 }],
      opacity: 1,
    };
  });

  const renderPicker = () => {
    if (!showPicker) return null;

    return (
      <View style={styles.pickerContainer}>
        <View style={styles.pickerColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onScroll={(e) => {
              hourScrollY.value = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.pickerSpacer} />
            {hours.map((hour) => (
              <Animated.View key={hour} style={[styles.pickerItem, hourItemStyle]}>
                <TouchableOpacity
                  onPress={() => handleHourSelect(hour)}
                  style={[styles.pickerItemButton, selectedHour === hour && styles.selectedItem]}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedHour === hour && styles.selectedItemText,
                    ]}
                  >
                    {format(new Date().setHours(hour), "h a")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
            <View style={styles.pickerSpacer} />
          </ScrollView>
        </View>

        <View style={styles.pickerColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onScroll={(e) => {
              minuteScrollY.value = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.pickerSpacer} />
            {minutes.map((minute) => (
              <Animated.View key={minute} style={[styles.pickerItem, minuteItemStyle]}>
                <TouchableOpacity
                  onPress={() => handleMinuteSelect(minute)}
                  style={[
                    styles.pickerItemButton,
                    selectedMinute === minute && styles.selectedItem,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedMinute === minute && styles.selectedItemText,
                    ]}
                  >
                    {minute.toString().padStart(2, "0")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
            <View style={styles.pickerSpacer} />
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.timeButton, disabled && styles.disabledButton]}
        onPress={handleTimePress}
        disabled={disabled}
      >
        <Text style={[styles.timeText, disabled && styles.disabledText]}>
          {format(parseISO(time), "h:mm a")}
        </Text>
      </TouchableOpacity>
      {renderPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: COLORS.buttonBackground,
  },
  disabledText: {
    color: COLORS.textSecondary,
  },
  pickerContainer: {
    flexDirection: "row",
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: "hidden",
    marginTop: 8,
  },
  pickerColumn: {
    flex: 1,
    height: "100%",
  },
  pickerSpacer: {
    height: ITEM_HEIGHT * 2,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerItemButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  selectedItem: {
    backgroundColor: COLORS.accent,
  },
  selectedItemText: {
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
});

export default TimeSelector;
