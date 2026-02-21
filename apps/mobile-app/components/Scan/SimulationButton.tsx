import React, { useCallback } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";

interface SimulationButtonProps {
  isVisible: boolean;
  isMounted: React.MutableRefObject<boolean>;
  onSimulateCapture: () => void;
}

export const SimulationButton: React.FC<SimulationButtonProps> = ({
  isVisible,
  isMounted,
  onSimulateCapture,
}) => {
  const { publish } = useEventBroker();

  const simulateCapture = useCallback(() => {
    if (!isMounted.current) return;

    // Show a notification
    publish(EventTypes.NOTIFICATION, {
      timestamp: Date.now(),
      source: "ScanScreen",
      message: "Simulating document capture...",
    });

    // Call the parent's simulation function
    onSimulateCapture();
  }, [isMounted, onSimulateCapture, publish]);

  if (!isVisible) return null;

  return (
    <TouchableOpacity
      style={styles.simulationButton}
      onPress={simulateCapture}
      activeOpacity={0.7}
    >
      <Text style={styles.simulationButtonText}>
        🧪 Simulate Capture (Dev Only)
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  simulationButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  simulationButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});
