// CameraControls.tsx
import React, { useMemo } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Zap, ZapOff } from "lucide-react-native";
import { useColors, spacing, radius, type Colors } from "@/theme";

import { FlashMode } from "expo-camera";
import { CaptureButton } from "../CaptureButton/CaptureButton";
import { ImageSelector } from "../ImageSelector";

interface CameraControlsProps {
  onCapture: () => void;
  onImageSelected: (uri: string) => void;
  isCapturing?: boolean;
  isReady?: boolean;
  flashMode: FlashMode;
  onFlashToggle: () => void;
  disabled?: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  onCapture,
  onImageSelected,
  isCapturing = false,
  isReady = true,
  flashMode = "off",
  onFlashToggle,
  disabled = false,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Flash mode color mapping using theme tokens
  const flashColors: Record<string, string> = useMemo(() => ({
    on: colors.status.warning.text,
    auto: colors.accent.primary,
    off: colors.text.secondary,
  }), [colors]);

  const FlashIcon = flashMode === "on" ? Zap : ZapOff;
  const flashColor = flashColors[flashMode] ?? colors.text.secondary;

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        {/* Left - Flash button */}
        <View style={styles.sideContainer}>
          <TouchableOpacity
            style={[styles.controlButton, { borderColor: flashColor }]}
            onPress={onFlashToggle}
            activeOpacity={0.7}
            disabled={isCapturing || disabled}
          >
            <FlashIcon size={22} color={flashColor} />
          </TouchableOpacity>
        </View>

        {/* Center - Capture button */}
        <View style={styles.centerContainer}>
          <CaptureButton
            onPress={onCapture}
            isCapturing={isCapturing}
            isReady={isReady}
            size="large"
            disabled={disabled}
          />
        </View>

        {/* Right - Gallery button */}
        <View style={styles.sideContainer}>
          <ImageSelector
            onImageSelected={onImageSelected}
            disabled={isCapturing || disabled}
          />
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: spacing.lg,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  sideContainer: {
    width: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
});
