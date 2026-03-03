import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  FadeInRight,
  FadeOutRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Settings, CheckCircle2, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { colors } from "@/theme";
import { styles as homeScreenStyles } from "@/components/homeScreenStyles";

interface ScanProgressFABProps {
  onPress: () => void;
}

const ScanProgressFAB: React.FC<ScanProgressFABProps> = ({ onPress }) => {
  const { activeJobs } = useJobProgressContext();
  const rotation = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);

  const inFlightJobs = activeJobs.filter(
    (j) => j.status === "pending" || j.status === "processing",
  );
  const completedJobs = activeJobs.filter((j) => j.status === "completed");
  const failedJobs = activeJobs.filter((j) => j.status === "failed");

  const hasInFlight = inFlightJobs.length > 0;
  const isCompleted = !hasInFlight && completedJobs.length > 0;
  const isFailed =
    !hasInFlight && failedJobs.length > 0 && completedJobs.length === 0;

  useEffect(() => {
    if (hasInFlight) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 }),
        ),
        -1,
      );
    } else {
      rotation.value = 0;
      pulseOpacity.value = 0.3;
    }
  }, [hasInFlight, rotation, pulseOpacity]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (activeJobs.length === 0) return null;

  const accentColor = isFailed
    ? colors.status.error.text
    : isCompleted
      ? colors.status.success.text
      : colors.accent.primary;

  return (
    <Animated.View
      entering={FadeInRight.springify()}
      exiting={FadeOutRight.springify()}
    >
      <TouchableOpacity
        style={[homeScreenStyles.recenterButton, styles.fab]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {hasInFlight && (
          <Animated.View
            style={[styles.glowRing, { borderColor: accentColor }, glowStyle]}
          />
        )}

        {hasInFlight ? (
          <Animated.View style={spinStyle}>
            <Settings size={22} color={accentColor} strokeWidth={2.5} />
          </Animated.View>
        ) : isCompleted ? (
          <CheckCircle2 size={22} color={accentColor} strokeWidth={2.5} />
        ) : (
          <AlertCircle size={22} color={accentColor} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fab: {
    borderColor: colors.accent.border,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 2,
  },
});

export default React.memo(ScanProgressFAB);
