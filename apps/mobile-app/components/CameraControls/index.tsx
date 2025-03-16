// CameraControls.tsx
import React from "react";
import { StyleSheet, View, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

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
  // Get flash icon based on current mode
  const getFlashIcon = () => {
    switch (flashMode) {
      case "on":
        return "zap";
      case "auto":
        return "zap-off";
      case "off":
      default:
        return "zap-off";
    }
  };

  // Get flash button color based on current mode
  const getFlashColor = () => {
    switch (flashMode) {
      case "on":
        return "#ffce00"; // Yellow for on
      case "auto":
        return "#5cafff"; // Blue for auto
      case "off":
      default:
        return "#ffffff"; // White for off
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        {/* Left - Flash button */}
        <View style={styles.sideContainer}>
          <TouchableOpacity
            style={[styles.flashButton, { borderColor: getFlashColor() }]}
            onPress={onFlashToggle}
            activeOpacity={0.7}
            disabled={isCapturing || disabled}
          >
            <Feather name={getFlashIcon()} size={20} color={getFlashColor()} />
          </TouchableOpacity>
        </View>

        {/* Center - Capture button */}
        <View style={styles.centerContainer}>
          <CaptureButton
            onPress={onCapture}
            isCapturing={isCapturing}
            isReady={isReady}
            size="normal"
            flashMode={flashMode}
          />
        </View>

        {/* Right - Gallery button */}
        <View style={styles.sideContainer}>
          <ImageSelector onImageSelected={onImageSelected} disabled={isCapturing || disabled} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
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
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
