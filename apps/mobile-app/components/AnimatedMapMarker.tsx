// QuestMarker.tsx
import useBreathing from "@/hooks/usBreathing";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ZoomIn,
  ZoomOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Define different marker themes
const MARKER_THEMES = {
  fantasy: {
    shapes: ["🏰", "⚔️", "🧙", "🐉", "📜", "🔮"],
    colors: ["#8A2BE2", "#FF6347", "#1E90FF", "#32CD32", "#FFD700", "#FF4500"],
    shadowColor: "#8A2BE2",
  },
  adventure: {
    shapes: ["🗺️", "🧭", "🏕️", "🧗", "🚵", "⛰️"],
    colors: ["#2E8B57", "#FF8C00", "#20B2AA", "#CD853F", "#6B8E23", "#008B8B"],
    shadowColor: "#008B8B",
  },
  treasure: {
    shapes: ["💰", "💎", "🔑", "👑", "💍", "🏆"],
    colors: ["#FFD700", "#C0C0C0", "#B87333", "#E6BE8A", "#4169E1", "#8B4513"],
    shadowColor: "#FFD700",
  },
  city: {
    shapes: ["🏙️", "🚇", "🏢", "🛒", "🏛️", "🍽️"],
    colors: ["#4682B4", "#DC143C", "#708090", "#DAA520", "#2F4F4F", "#CD5C5C"],
    shadowColor: "#4682B4",
  },
};

interface AnimatedMapMarkerProps {
  emoji?: string;
  isSelected: boolean;
  onPress: () => void;
  themeKey?: keyof typeof MARKER_THEMES;
  markerIndex?: number;
  pulseEffect?: boolean;
  showLabel?: boolean;
  label?: string;
}

const AnimatedMapMarker: React.FC<AnimatedMapMarkerProps> = ({
  emoji,
  isSelected,
  onPress,
  themeKey = "fantasy",
  markerIndex = 0,
  pulseEffect = true,
  showLabel = false,
  label = "Location",
}) => {
  const { animatedStyle } = useBreathing();
  const theme = MARKER_THEMES[themeKey];

  // Get emoji and color based on markerIndex
  const markerEmoji = emoji || theme.shapes[markerIndex % theme.shapes.length];
  const markerColor = theme.colors[markerIndex % theme.colors.length];

  // Animation values
  const rotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const bgColor = useSharedValue(0);

  // Set up animations when selected
  useEffect(() => {
    if (isSelected) {
      // Rotation animation
      rotation.value = withRepeat(
        withTiming(2 * Math.PI, { duration: 10000, easing: Easing.linear }),
        -1,
        false
      );

      // Glow effect
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.7, { duration: 1000 }), withTiming(0.3, { duration: 1000 })),
        -1,
        true
      );

      // Color transition
      bgColor.value = withRepeat(
        withSequence(withTiming(1, { duration: 1500 }), withTiming(0, { duration: 1500 })),
        -1,
        true
      );
    } else {
      // Reset animations when not selected
      rotation.value = withTiming(0);
      glowOpacity.value = withTiming(0);
      bgColor.value = withTiming(0);
    }
  }, [isSelected, rotation, glowOpacity, bgColor]);

  // Scale animation style
  const scaleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: isSelected
            ? withSequence(withTiming(1.3, { duration: 300 }), withTiming(1.2, { duration: 200 }))
            : withTiming(1, { duration: 300 }),
        },
        {
          rotate: `${rotation.value}rad`,
        },
      ],
    };
  }, [isSelected]);

  // Glow effect style
  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 15,
      elevation: 10,
    };
  }, [glowOpacity]);

  // Background color animation
  const bgColorStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(bgColor.value, [0, 1], [markerColor, "#ffffff"]);

    return {
      backgroundColor,
    };
  }, [bgColor, markerColor]);

  // Pulse animation for non-selected markers
  const pulseStyle = useAnimatedStyle(() => {
    if (!pulseEffect || isSelected) return {};

    return {
      transform: [
        {
          scale: withRepeat(
            withSequence(
              withTiming(1, { duration: 1500 }),
              withTiming(1.1, { duration: 700 }),
              withTiming(1, { duration: 800 })
            ),
            -1,
            true
          ),
        },
      ],
    };
  }, [pulseEffect, isSelected]);

  return (
    <View>
      <Animated.View
        entering={ZoomIn.duration(500).easing(Easing.back())}
        exiting={ZoomOut.duration(300)}
      >
        <Animated.View
          style={[styles.container, isSelected && styles.selectedContainer, scaleStyle, pulseStyle]}
        >
          <Animated.View style={[styles.glowEffect, glowStyle]} />
          <Pressable style={[styles.marker, bgColorStyle]} onPress={onPress}>
            <Text style={styles.markerIcon}>{markerEmoji}</Text>
          </Pressable>

          {showLabel && (
            <Animated.View entering={ZoomIn.delay(100)} style={styles.labelContainer}>
              <Text style={styles.labelText}>{label}</Text>
            </Animated.View>
          )}

          {isSelected && (
            <Animated.View entering={ZoomIn.duration(400).delay(100)} style={styles.selectedRing} />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  selectedContainer: {
    zIndex: 2,
  },
  marker: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 100,
    backgroundColor: "#333",
    width: 44,
    height: 44,
    padding: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  markerIcon: {
    fontSize: 18,
    color: "#fff",
  },
  glowEffect: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "transparent",
  },
  selectedRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#ffffff",
    borderStyle: "dotted",
  },
  labelContainer: {
    position: "absolute",
    top: -25,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  labelText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  popupMenuWrapper: {
    position: "absolute",
    bottom: 100,
    width: 300,
    alignSelf: "center",
  },
});

export default AnimatedMapMarker;
