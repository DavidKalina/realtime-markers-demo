import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

interface ScannerOverlayProps {
  guideText?: string;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  guideText = "Position your document within the frame",
}) => {
  return (
    <>
      <View style={styles.overlay}>
        <Animated.View style={styles.scanFrame} entering={ZoomIn.duration(700)}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(51, 51, 51, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  scanFrame: {
    width: "85%",
    aspectRatio: 0.8, // This creates a rectangular frame
    position: "relative",
    marginTop: -150, // Adjust this value to fine-tune vertical position
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: "#69db7c",
    borderRadius: 5,
  },
  guideText: {
    color: "#FFF",
    fontSize: 16,
    marginTop: 24,
    fontWeight: "500",
    textAlign: "center",
    opacity: 1,
    fontFamily: "SpaceMono",
    padding: 10,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    zIndex: 100,
  },
});
