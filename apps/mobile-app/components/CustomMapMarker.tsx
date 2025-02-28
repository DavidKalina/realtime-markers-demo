// CustomMapMarker.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Star } from "lucide-react-native";

// Define EventType if not already imported
export interface EventType {
  title: string;
  emoji: string;
  location: string;
  distance: string;
  time: string;
  description: string;
  categories: string[];
  isVerified?: boolean;
  color?: string;
}

interface CustomMapMarkerProps {
  event: EventType;
  isSelected: boolean;
  isHighlighted?: boolean;
  onPress: () => void;
}

export const CustomMapMarker: React.FC<CustomMapMarkerProps> = ({
  event,
  isSelected,
  isHighlighted = false,
  onPress,
}) => {
  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const pinDropAnimation = useSharedValue(0);
  const rotateAnimation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.3);
  const shadowRadius = useSharedValue(4);
  const isFirstRender = useRef(true);

  // Handle initial animations
  useEffect(() => {
    if (isFirstRender.current) {
      // Initial drop animation
      pinDropAnimation.value = -50;
      pinDropAnimation.value = withTiming(0, {
        duration: 600,
        easing: Easing.bounce,
      });

      // Start with lower opacity and fade in
      opacity.value = 0.6;
      opacity.value = withTiming(1, { duration: 300 });

      // Reset the flag
      isFirstRender.current = false;
    }
  }, []);

  // Handle selection/highlight changes
  useEffect(() => {
    if (isSelected) {
      // Scale up when selected with a spring effect
      scale.value = withSpring(1.15, { damping: 12, stiffness: 90 });

      // Enhance shadow for selected state
      shadowOpacity.value = withTiming(0.5, { duration: 200 });
      shadowRadius.value = withTiming(8, { duration: 200 });
    } else {
      // Return to normal scale with spring
      scale.value = withSpring(1, { damping: 12, stiffness: 90 });

      // Normal shadow
      shadowOpacity.value = withTiming(0.3, { duration: 150 });
      shadowRadius.value = withTiming(4, { duration: 150 });
    }

    // Highlight animation (attention-grabbing effect)
    if (isHighlighted) {
      // Pulse sequence
      scale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 }),
        withTiming(1.1, { duration: 150 }),
        withTiming(1, { duration: 150 })
      );

      // Add a little wiggle for attention
      rotateAnimation.value = withSequence(
        withTiming(-0.05, { duration: 100 }),
        withTiming(0.05, { duration: 100 }),
        withTiming(-0.05, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
    }
  }, [isSelected, isHighlighted]);

  // Handle press with haptic feedback
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Quick bounce animation on press
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1.1, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );

    onPress();
  };

  // Animated styles
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateY: pinDropAnimation.value },
        { rotate: `${rotateAnimation.value}rad` },
      ],
      opacity: opacity.value,
    };
  });

  // Dynamic shadow style
  const shadowStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: shadowOpacity.value,
      shadowRadius: shadowRadius.value,
      elevation: shadowRadius.value * 1.2, // For Android
    };
  });

  // Determine the background color based on selection state
  // Added subtle color variations for selected state
  const baseBackground = isSelected ? "#424242" : "#3a3a3a";
  const borderColor = isSelected ? "#4dabf7" : "#4a4a4a";

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.touchableArea}>
      <Animated.View style={[styles.container, containerStyle]}>
        <Animated.View
          style={[styles.markerContainer, shadowStyle, isSelected && styles.selectedShadow]}
        >
          {/* Main marker body */}
          <View
            style={[
              styles.markerBase,
              { backgroundColor: baseBackground, borderColor: borderColor },
              isSelected && styles.selectedMarkerBase,
            ]}
          >
            {/* Emoji */}
            <Text style={styles.emojiText}>{event.emoji}</Text>

            {/* Verified badge - only if event is verified */}
            {event.isVerified && (
              <View style={styles.verifiedBadge}>
                <Star size={8} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Marker point - creates the pin shape */}
          <View
            style={[
              styles.markerPoint,
              { backgroundColor: baseBackground, borderColor: borderColor },
              isSelected && styles.selectedMarkerPoint,
            ]}
          />

          {/* Shadow element for better 3D effect */}
          <View style={styles.markerShadow} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableArea: {
    // Larger touch target for better usability
    width: 50,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 60,
  },
  markerContainer: {
    alignItems: "center",
    width: "100%",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedShadow: {
    shadowColor: "#4dabf7",
    shadowOffset: { width: 0, height: 3 },
  },
  markerBase: {
    backgroundColor: "#3a3a3a",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#4a4a4a",
    // Add subtle inner shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedMarkerBase: {
    borderColor: "#4dabf7",
    backgroundColor: "#424242",
    ...Platform.select({
      ios: {
        shadowColor: "#4dabf7",
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  emojiText: {
    fontSize: 20,
    // Subtle text shadow for better visibility
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  markerPoint: {
    width: 14,
    height: 14,
    backgroundColor: "#3a3a3a",
    borderColor: "#4a4a4a",
    borderWidth: 2,
    transform: [{ rotate: "45deg" }],
    marginTop: -7,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedMarkerPoint: {
    borderColor: "#4dabf7",
    backgroundColor: "#424242",
  },
  markerShadow: {
    position: "absolute",
    bottom: -4,
    width: 20,
    height: 4,
    backgroundColor: "transparent",
    borderRadius: 50,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
    zIndex: -1,
  },
  verifiedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#4dabf7",
    borderRadius: 10,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
