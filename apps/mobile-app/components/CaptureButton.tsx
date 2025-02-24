import React from "react";
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

interface CaptureButtonProps {
  onPress: () => void;
  isCapturing: boolean;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({ onPress, isCapturing }) => {
  return (
    <Animated.View
      style={styles.controls}
      entering={ZoomIn.duration(500)}
      exiting={ZoomOut.duration(500)}
    >
      <TouchableOpacity
        style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
        onPress={onPress}
        disabled={isCapturing}
      >
        {isCapturing ? (
          <ActivityIndicator color="#69db7c" size="large" />
        ) : (
          <View style={styles.captureButtonInner} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 30,
    paddingBottom: Platform.select({ ios: 100, android: 85 }),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    zIndex: 100,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    borderWidth: 3,
    borderColor: "#69db7c",
  },
  captureButtonDisabled: {
    opacity: 0.7,
    borderColor: "#868e96",
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#444",
    borderWidth: 2,
    borderColor: "#69db7c",
  },
});
