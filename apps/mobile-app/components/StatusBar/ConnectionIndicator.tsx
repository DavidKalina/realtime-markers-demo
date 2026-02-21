import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  cancelAnimation,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Wifi } from "lucide-react-native";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";

const ANIMATION_CONFIG = {
  damping: 10,
  stiffness: 200,
};

const PULSE_CONFIG = {
  duration: 1500,
  scale: 0.95,
};

const QUALITY_COLORS = {
  connecting: {
    text: "Connecting",
    color: "#9CA3AF",
    bgColor: "rgba(156, 163, 175, 0.2)",
  },
  excellent: {
    text: "Excellent",
    color: "#22C55E",
    bgColor: "rgba(34, 197, 94, 0.2)",
  },
  good: {
    text: "Good",
    color: "#4ADE80",
    bgColor: "rgba(74, 222, 128, 0.2)",
  },
  fair: {
    text: "Fair",
    color: "#FACC15",
    bgColor: "rgba(250, 204, 21, 0.2)",
  },
  poor: {
    text: "Poor",
    color: "#F87171",
    bgColor: "rgba(248, 113, 113, 0.2)",
  },
  veryPoor: {
    text: "Very Poor",
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.2)",
  },
};

const ConnectionIndicator: React.FC = () => {
  const { isConnected, strength, isLoading } = useNetworkQuality();
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);
  const scale = useSharedValue(1);
  const [currentState, setCurrentState] = useState(QUALITY_COLORS.connecting);

  // Start the pulsing animation immediately on mount
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(PULSE_CONFIG.scale, { duration: PULSE_CONFIG.duration / 2 }),
        withTiming(1, { duration: PULSE_CONFIG.duration / 2 }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(scale);
    };
  }, []);

  useEffect(() => {
    // Only update state if we've received our first update or if we're disconnected
    if (!hasReceivedUpdate && !isLoading) {
      setHasReceivedUpdate(true);
    }

    if (!hasReceivedUpdate) {
      return;
    }

    if (!isConnected) {
      setCurrentState(QUALITY_COLORS.connecting);
      // Ensure pulsing animation is running when connecting
      scale.value = withRepeat(
        withSequence(
          withTiming(PULSE_CONFIG.scale, {
            duration: PULSE_CONFIG.duration / 2,
          }),
          withTiming(1, { duration: PULSE_CONFIG.duration / 2 }),
        ),
        -1,
        true,
      );
    } else if (strength >= 80) {
      setCurrentState(QUALITY_COLORS.excellent);
      cancelAnimation(scale);
      scale.value = 1;
    } else if (strength >= 60) {
      setCurrentState(QUALITY_COLORS.good);
      cancelAnimation(scale);
      scale.value = 1;
    } else if (strength >= 40) {
      setCurrentState(QUALITY_COLORS.fair);
      cancelAnimation(scale);
      scale.value = 1;
    } else if (strength >= 20) {
      setCurrentState(QUALITY_COLORS.poor);
      cancelAnimation(scale);
      scale.value = 1;
    } else {
      setCurrentState(QUALITY_COLORS.veryPoor);
      cancelAnimation(scale);
      scale.value = 1;
    }
  }, [isConnected, strength, isLoading, hasReceivedUpdate]);

  const handlePress = useMemo(
    () => () => {
      cancelAnimation(scale);
      scale.value = withSequence(
        withSpring(0.95, ANIMATION_CONFIG),
        withSpring(1, ANIMATION_CONFIG),
      );
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      onTouchStart={handlePress}
    >
      <View
        style={[styles.indicator, { backgroundColor: currentState.bgColor }]}
      >
        <Wifi size={10} color={currentState.color} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

export default React.memo(ConnectionIndicator);
