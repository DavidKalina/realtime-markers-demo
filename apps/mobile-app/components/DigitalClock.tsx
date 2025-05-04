import React from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";
import { COLORS } from "./Layout/ScreenLayout";

const { width } = Dimensions.get("window");

interface DigitalClockProps {
  onValueChange: (hours: number, minutes: number) => void;
}

const DigitalClock = ({ onValueChange }: DigitalClockProps) => {
  const hoursValue = useSharedValue(0);
  const minutesValue = useSharedValue(0);
  const hoursDisplay = useSharedValue("00");
  const minutesDisplay = useSharedValue("00");

  const updateDisplay = (hours: number, minutes: number) => {
    "worklet";
    hoursDisplay.value = hours.toString().padStart(2, "0");
    minutesDisplay.value = minutes.toString().padStart(2, "0");
  };

  const hoursGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      console.log("Hours gesture started");
    },
    onActive: (event) => {
      const movement = -event.translationY / 20;
      const newValue = Math.max(0, Math.min(23, Math.round(hoursValue.value + movement)));

      if (newValue !== hoursValue.value) {
        hoursValue.value = newValue;
        updateDisplay(newValue, minutesValue.value);
        runOnJS(onValueChange)(newValue, minutesValue.value);
      }
    },
    onEnd: () => {
      hoursValue.value = withSpring(hoursValue.value, {
        damping: 15,
        stiffness: 150,
      });
    },
  });

  const minutesGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      console.log("Minutes gesture started");
    },
    onActive: (event) => {
      const movement = -event.translationY / 20;
      const newValue = Math.max(0, Math.min(59, Math.round(minutesValue.value + movement)));

      if (newValue !== minutesValue.value) {
        minutesValue.value = newValue;
        updateDisplay(hoursValue.value, newValue);
        runOnJS(onValueChange)(hoursValue.value, newValue);
      }
    },
    onEnd: () => {
      minutesValue.value = withSpring(minutesValue.value, {
        damping: 15,
        stiffness: 150,
      });
    },
  });

  const hoursStyle = useAnimatedStyle(() => {
    return {
      color: COLORS.textPrimary,
    };
  });

  const minutesStyle = useAnimatedStyle(() => {
    return {
      color: COLORS.textPrimary,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.clockContainer}>
        {/* Hour Section */}
        <PanGestureHandler onGestureEvent={hoursGestureHandler}>
          <Animated.View style={styles.digitContainer}>
            <Animated.Text style={[styles.digitText, hoursStyle]}>
              {hoursDisplay.value}
            </Animated.Text>
          </Animated.View>
        </PanGestureHandler>

        {/* Separator */}
        <Text style={styles.separator}>:</Text>

        {/* Minutes Section */}
        <PanGestureHandler onGestureEvent={minutesGestureHandler}>
          <Animated.View style={styles.digitContainer}>
            <Animated.Text style={[styles.digitText, minutesStyle]}>
              {minutesDisplay.value}
            </Animated.Text>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  clockContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  digitContainer: {
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  digitText: {
    fontSize: 56,
    fontFamily: "SpaceMono",
    fontWeight: "300",
    color: COLORS.textPrimary,
    letterSpacing: -2,
  },
  separator: {
    fontSize: 56,
    fontFamily: "SpaceMono",
    fontWeight: "300",
    color: COLORS.accent,
    marginHorizontal: 4,
  },
});

export default DigitalClock;
