import { Marker } from "@/hooks/useMapWebsocket";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { COLORS } from "../Layout/ScreenLayout";
import {
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MarkerSVG,
  SHADOW_OFFSET,
  ShadowSVG,
} from "./MarkerSVGs";
import { TimePopup } from "./TimePopup";

interface MapMarkerProps {
  event: Marker;
  onPress: () => void;
  isHighlighted?: boolean;
  style?: ViewStyle; // Properly type the style prop
}

export const MapMarker: React.FC<MapMarkerProps> = React.memo(
  ({ event, onPress, style }) => {
    // Handle press with haptic feedback
    const handlePress = () => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      onPress();
    };

    // Memoize SVG components
    const ShadowSvg = useMemo(() => <ShadowSVG />, []);
    const MarkerSvg = useMemo(
      () => (
        <MarkerSVG
          fill={event.data.isPrivate ? COLORS.accent : "#1a1a1a"}
          stroke={event.data.isPrivate ? COLORS.accentDark : "white"}
          strokeWidth="3"
          highlightStrokeWidth="2.5"
          circleRadius="12"
          circleStroke={event.data.isPrivate ? COLORS.accentDark : "#E2E8F0"}
          circleStrokeWidth="1"
        />
      ),
      [event.data.isPrivate],
    );

    return (
      <View style={styles.container}>
        {/* Popup */}
        <View style={styles.popupContainer}>
          <TimePopup
            time={event.data.eventDate || ""}
            endDate={event.data.endDate || ""}
            title={event.data.title || ""}
          />
        </View>

        {/* Marker Shadow */}
        <View style={[styles.shadowContainer, { opacity: 0.3 }]}>
          {ShadowSvg}
        </View>

        {/* Marker */}
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          style={styles.touchableArea}
        >
          <View style={[styles.markerContainer, style]}>
            {MarkerSvg}

            {/* Emoji */}
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{event.data.emoji}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Optimize re-renders
    return (
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.event.data.emoji === nextProps.event.data.emoji &&
      prevProps.event.data.title === nextProps.event.data.title
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  touchableArea: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  markerContainer: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    zIndex: -1,
    transform: [
      { translateX: SHADOW_OFFSET.x },
      { translateY: SHADOW_OFFSET.y },
    ],
  },
  emojiContainer: {
    position: "absolute",
    top: 10,
    width: MARKER_WIDTH,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    padding: 2,
  },
  popupContainer: {
    position: "absolute",
    width: "100%",
    zIndex: 1,
  },
});
