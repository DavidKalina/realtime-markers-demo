import useBounceIn from "@/hooks/useBounceIn";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export interface MarkerData {
  id: string;
  title: string;
  emoji: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface GenericMapMarkerProps {
  marker: MarkerData;
  isSelected?: boolean;
  onPress: () => void;
  onShare?: () => void;
  onGetDirections?: () => void;
  onViewDetails?: () => void;
  onDismiss?: () => void;
}

const MARKER_SIZE = 56;
// Color theme with dark backgrounds and varying accent colors
const BACKGROUND_COLOR = "#333";
const SHARE_COLOR = "#4CB5AB";
const DIRECTIONS_COLOR = "#7C4DFF";
const INFO_COLOR = "#FF9800";

const GenericMapMarker: React.FC<GenericMapMarkerProps> = ({
  marker,
  isSelected,
  onPress,
  onShare,
  onGetDirections,
  onViewDetails,
  onDismiss,
}) => {
  const bounceInStyle = useBounceIn();
  const rotation = useSharedValue(0);
  const dashOffset = useSharedValue(0); // For animated dashed border
  const leftActionScale = useSharedValue(0);
  const centerActionScale = useSharedValue(0);
  const rightActionScale = useSharedValue(0);
  const popupScale = useSharedValue(0);
  const markerScale = useSharedValue(0.8); // Start with smaller scale

  // Start rotation and dash animations on component mount
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 20000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    dashOffset.value = withRepeat(
      withTiming(20, {
        duration: 3000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Initial scale animation on mount
    markerScale.value = withTiming(0.8, { duration: 300 });
  }, [rotation, dashOffset]);

  // Animate the marker and action buttons when selected
  useEffect(() => {
    if (isSelected) {
      // Reset values when re-selecting
      leftActionScale.value = 0;
      centerActionScale.value = 0;
      rightActionScale.value = 0;
      popupScale.value = 0;

      // Animate marker to larger scale when selected
      markerScale.value = withSequence(
        withTiming(1.15, { duration: 300, easing: Easing.bounce }),
        withTiming(1.05, { duration: 200 })
      );

      // Start popup animation
      popupScale.value = withSequence(
        withTiming(1.1, { duration: 300, easing: Easing.bounce }),
        withTiming(1, { duration: 200 })
      );

      // Animate buttons with staggered appearance
      leftActionScale.value = withDelay(
        100,
        withSequence(
          withTiming(1.2, { duration: 350, easing: Easing.bounce }),
          withTiming(1, { duration: 200 })
        )
      );

      centerActionScale.value = withDelay(
        200,
        withSequence(
          withTiming(1.2, { duration: 350, easing: Easing.bounce }),
          withTiming(1, { duration: 200 })
        )
      );

      rightActionScale.value = withDelay(
        300,
        withSequence(
          withTiming(1.2, { duration: 350, easing: Easing.bounce }),
          withTiming(1, { duration: 200 })
        )
      );
    } else {
      // Shrink back to original size when deselected
      markerScale.value = withTiming(0.8, { duration: 300 });

      // Add exit animations
      if (leftActionScale.value !== 0) {
        leftActionScale.value = withTiming(0, { duration: 200 });
        centerActionScale.value = withDelay(50, withTiming(0, { duration: 200 }));
        rightActionScale.value = withDelay(100, withTiming(0, { duration: 200 }));
        popupScale.value = withDelay(150, withTiming(0, { duration: 250 }));
      }
    }
  }, [isSelected]);

  const markerScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markerScale.value }],
  }));

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dashedBorderStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    // Animate the dashed border
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: `rgba(255, 255, 255, 0.3)`,
    // This creates the movement effect for the dashes
    borderDashOffset: dashOffset.value,
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 }, { scale: leftActionScale.value }],
    opacity: leftActionScale.value,
  }));

  const centerActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 8 }, { scale: centerActionScale.value }],
    opacity: centerActionScale.value,
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 }, { scale: rightActionScale.value }],
    opacity: rightActionScale.value,
  }));

  const popupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popupScale.value }],
    opacity: popupScale.value,
  }));

  // Handle marker press - can toggle selection if already selected
  const handleMarkerPress = useCallback(() => {
    if (isSelected && onDismiss) {
      onDismiss();
    } else {
      onPress();
    }
  }, [isSelected, onPress, onDismiss]);

  const renderMarker = useCallback(
    () => (
      <Pressable onPress={handleMarkerPress} style={styles.pressableArea}>
        <Animated.View style={[styles.markerContainer, bounceInStyle, markerScaleStyle]}>
          <Animated.View style={[styles.dashedBorder, dashedBorderStyle]} />
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{marker.emoji}</Text>
          </View>
        </Animated.View>

        {/* Title appears above and actions wrap around the bottom when selected */}
        {isSelected && (
          <>
            <Animated.View style={[styles.titleContainer, popupStyle]}>
              <Text style={styles.titleText} numberOfLines={2}>
                {marker.title}
              </Text>
              {/* Close button in the title container */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onDismiss}
                activeOpacity={0.7}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Feather name="x" size={16} color="#ccc" />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.actionsContainer}>
              {onShare && (
                <Animated.View style={leftActionStyle}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onShare}
                    activeOpacity={0.7}
                  >
                    <Feather name="share" size={20} color={SHARE_COLOR} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {onGetDirections && (
                <Animated.View style={centerActionStyle}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onGetDirections}
                    activeOpacity={0.7}
                  >
                    <Feather name="navigation" size={20} color={DIRECTIONS_COLOR} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {onViewDetails && (
                <Animated.View style={rightActionStyle}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onViewDetails}
                    activeOpacity={0.7}
                  >
                    <Feather name="info" size={20} color={INFO_COLOR} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </>
        )}
      </Pressable>
    ),
    [
      marker.emoji,
      marker.title,
      isSelected,
      onPress,
      onShare,
      onGetDirections,
      onViewDetails,
      onDismiss,
      handleMarkerPress,
      bounceInStyle,
      markerScaleStyle,
      dashedBorderStyle,
      leftActionStyle,
      centerActionStyle,
      rightActionStyle,
      popupStyle,
    ]
  );

  return renderMarker();
};

const styles = StyleSheet.create({
  pressableArea: {
    width: MARKER_SIZE * 3,
    height: MARKER_SIZE * 2.5,
    justifyContent: "center",
    alignItems: "center",
  },
  markerContainer: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dashedBorder: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: MARKER_SIZE / 2,
    // We're moving these styles to the animated style
    // borderWidth: 1.5,
    // borderColor: `rgba(255, 255, 255, 0.3)`,
    // borderStyle: "dashed",
  },
  emojiContainer: {
    width: MARKER_SIZE - 14,
    height: MARKER_SIZE - 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51, 51, 51, 0.95)",
    borderRadius: (MARKER_SIZE - 14) / 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emoji: {
    fontSize: 28,
  },
  popupContainer: {
    position: "absolute",
    alignItems: "center",
    width: MARKER_SIZE * 2.5,
  },
  titleContainer: {
    position: "absolute",
    bottom: MARKER_SIZE + 50,
    backgroundColor: "rgba(51, 51, 51, 0.95)",
    padding: 8,
    borderRadius: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    color: "#fff",
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  actionsContainer: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    width: MARKER_SIZE * 2.2,
    top: MARKER_SIZE * 1.7,
  },
  actionButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: "rgba(51, 51, 51, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});

export default React.memo(GenericMapMarker);
