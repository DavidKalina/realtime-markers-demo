import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";

interface ScannerOverlayProps {
  guideText?: string;
  detectionStatus?: "none" | "detecting" | "aligned";
  onFrameReady?: () => void;
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = (props) => {
  const { guideText = "Position your document", detectionStatus = "none", onFrameReady } = props;

  // Simple state
  const [message, setMessage] = useState(guideText);

  // Update message based on status
  useEffect(() => {
    switch (detectionStatus) {
      case "none":
        setMessage(guideText);
        break;
      case "detecting":
        setMessage("Almost there...");
        break;
      case "aligned":
        setMessage("Perfect!");
        break;
    }
  }, [detectionStatus, guideText]);

  // Handle callback
  useEffect(() => {
    if (detectionStatus === "aligned" && onFrameReady) {
      const timer = setTimeout(onFrameReady, 500);
      return () => clearTimeout(timer);
    }
  }, [detectionStatus, onFrameReady]);

  // Color based on status
  const borderColor =
    detectionStatus === "aligned"
      ? "#69db7c"
      : detectionStatus === "detecting"
      ? "#ffd700"
      : "#ffdb69";

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Just a simple frame with solid border */}
      <View
        style={{
          width: "80%",
          aspectRatio: 0.8,
          borderWidth: 3,
          borderColor: borderColor,
          position: "relative",
        }}
      />

      {/* Simple message */}
      <Text
        style={{
          color: "white",
          fontSize: 16,
          marginTop: 20,
        }}
      >
        {message}
      </Text>
    </View>
  );
};
