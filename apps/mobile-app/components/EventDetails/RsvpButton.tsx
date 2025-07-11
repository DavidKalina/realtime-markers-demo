import { CalendarCheck, CalendarPlus } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";

interface RsvpButtonProps {
  isRsvped: boolean;
  rsvpState: "idle" | "loading";
  onRsvp: () => void;
}

const RsvpButton: React.FC<RsvpButtonProps> = ({
  isRsvped,
  rsvpState,
  onRsvp,
}) => {
  const scale = useSharedValue(1);
  const color = useSharedValue(0);

  // Update color when RSVP state changes
  React.useEffect(() => {
    if (rsvpState === "idle") {
      color.value = withTiming(isRsvped ? 1 : 0, { duration: 300 });
    }
  }, [isRsvped, rsvpState]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleRsvpPress = () => {
    if (rsvpState === "loading") return;
    onRsvp();
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: interpolateColor(
        color.value,
        [0, 1],
        [COLORS.buttonBackground, COLORS.accent + "20"],
      ),
    };
  });

  return (
    <Pressable
      onPress={handleRsvpPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={rsvpState === "loading"}
      style={({ pressed }) => [
        styles.rsvpButton,
        pressed && styles.rsvpButtonPressed,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.buttonContent, animatedStyle]}
      >
        {rsvpState === "loading" ? (
          <ActivityIndicator
            size="small"
            color={isRsvped ? COLORS.accent : COLORS.accent}
          />
        ) : isRsvped ? (
          <CalendarCheck size={24} color={COLORS.accent} />
        ) : (
          <CalendarPlus size={24} color={COLORS.accent} />
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  rsvpButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  loading: {
    opacity: 0.7,
  },
  rsvpButtonPressed: {
    // Add any styles for pressed state if needed
  },
});

export default React.memo(RsvpButton);
