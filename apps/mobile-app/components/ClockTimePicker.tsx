import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";
import { COLORS } from "./Layout/ScreenLayout";
import { format, parseISO, setHours, setMinutes } from "date-fns";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");
const DIAL_SIZE = width * 0.6;
const MARKER_SIZE = 4;

interface ClockTimePickerProps {
  time: string;
  onChange: (time: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

const ClockTimePicker: React.FC<ClockTimePickerProps> = ({
  time,
  onChange,
  onClose,
  isVisible,
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Parse initial time
  const initialTime = useMemo(() => {
    const date = parseISO(time);
    return {
      hours: date.getHours(),
      minutes: date.getMinutes(),
    };
  }, [time]);

  // Calculate initial rotation
  useEffect(() => {
    const hourRotation = (initialTime.hours % 12) * 30 + (initialTime.minutes / 60) * 30;
    rotation.value = hourRotation;
  }, [initialTime]);

  // Animate in/out
  useEffect(() => {
    if (isVisible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(0, { damping: 15 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const handleGesture = useCallback(
    (angle: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      rotation.value = withSpring(angle, { damping: 15 });

      // Calculate hours and minutes
      const hours = Math.floor(angle / 30);
      const minutes = Math.floor(((angle % 30) / 30) * 60);

      // Update time
      const newDate = parseISO(time);
      const updatedDate = setMinutes(setHours(newDate, hours), minutes);
      onChange(format(updatedDate, "yyyy-MM-dd'T'HH:mm"));
    },
    [time, onChange]
  );

  const onGestureEvent = useCallback(
    (event: any) => {
      "worklet";
      const { x, y } = event;
      const centerX = DIAL_SIZE / 2;
      const centerY = DIAL_SIZE / 2;

      // Calculate angle from center
      let angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      angle = (angle + 90 + 360) % 360; // Normalize to 0-360

      // Snap to nearest hour
      const snappedAngle = Math.round(angle / 30) * 30;

      runOnJS(handleGesture)(snappedAngle);
    },
    [handleGesture]
  );

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Generate hour markers
  const markers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const x = Math.sin(angle) * (DIAL_SIZE / 2 - 20);
      const y = -Math.cos(angle) * (DIAL_SIZE / 2 - 20);

      return (
        <View
          key={i}
          style={[
            styles.marker,
            {
              transform: [{ translateX: x }, { translateY: y }],
            },
          ]}
        >
          <Text style={styles.markerText}>{i === 0 ? "12" : i}</Text>
        </View>
      );
    });
  }, []);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Time</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dialContainer}>
          <View style={styles.dialBackground}>{markers}</View>
          <PanGestureHandler onGestureEvent={onGestureEvent}>
            <Animated.View style={[styles.dial, dialStyle]}>
              <View style={styles.dialIndicator} />
            </Animated.View>
          </PanGestureHandler>

          <View style={styles.selectedTimeContainer}>
            <Text style={styles.selectedTime}>{format(parseISO(time), "h:mm a")}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    width: width * 0.9,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
  closeText: {
    fontSize: 16,
    color: COLORS.accent,
    fontFamily: "SpaceMono",
  },
  dialContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  dialBackground: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  dial: {
    position: "absolute",
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  dialIndicator: {
    position: "absolute",
    top: 0,
    width: 4,
    height: DIAL_SIZE / 2,
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  marker: {
    position: "absolute",
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  markerText: {
    position: "absolute",
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    transform: [{ translateY: -20 }],
  },
  selectedTimeContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  selectedTime: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
});

export default ClockTimePicker;
