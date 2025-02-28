// ScannerOverlay.tsx - Dedicated component for scanner detection UI
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { styles } from "./styles";

interface ScannerOverlayProps {
  isVisible: boolean;
  isAligned: boolean;
  processingStatus: "none" | "processing" | "complete" | "error";
}

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  isVisible,
  isAligned,
  processingStatus,
}) => {
  // Animation for scan line
  const scanLinePosition = useSharedValue(0);

  // Initialize scan line animation
  useEffect(() => {
    if (isVisible && processingStatus === "none") {
      scanLinePosition.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.linear }),
        -1,
        true
      );
    } else {
      scanLinePosition.value = 0;
    }
  }, [isVisible, processingStatus]);

  // Scan line animation style
  const scanLineStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY:
            (scanLinePosition.value - 0.5) *
            (0.55 * (typeof window !== "undefined" ? window.innerHeight : 600)),
        },
      ],
    };
  });

  return (
    <>
      {/* Status Section - Clearly separated at top */}
      <View style={styles.statusSection}>
        <Text style={styles.scanStatusText}>
          {processingStatus === "processing"
            ? "Processing..."
            : isAligned
            ? "Position flyer in frame"
            : "Position flyer in frame"}
        </Text>

        {isAligned && (
          <View style={styles.perfectIndicator}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.perfectText}>Perfect!</Text>
          </View>
        )}
      </View>

      {/* Green scan frame - in the middle with no overlap */}
      <View style={styles.scanFrame}>
        {/* Green border */}
        <View style={styles.scanBorder}>
          <View style={styles.scanOverlay} />

          {/* Animated scan line */}
          {processingStatus === "none" && (
            <Animated.View style={[styles.scanLine, scanLineStyle]} />
          )}
        </View>

        {/* Corner brackets */}
        <View style={[styles.cornerBracket, styles.topLeftBracket]} />
        <View style={[styles.cornerBracket, styles.topRightBracket]} />
        <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
        <View style={[styles.cornerBracket, styles.bottomRightBracket]} />
      </View>
    </>
  );
};

export default ScannerOverlay;
