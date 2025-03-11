import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ProfileFloatingEmojiProps {
  emoji: string;
  name: string;
  size?: number;
  isActive?: boolean;
  role?: string;
}

const ProfileFloatingEmoji: React.FC<ProfileFloatingEmojiProps> = ({
  emoji,
  name,
  size = 40,
  isActive = false,
  role,
}) => {
  // Simple animation shared values
  const floatY = useSharedValue(0);
  const scale = useSharedValue(isActive ? 1.1 : 1);
  const opacity = useSharedValue(isActive ? 1 : 0.8); // Slightly higher base opacity

  // Setup simple floating animation
  useEffect(() => {
    // Simple floating animation
    floatY.value = withRepeat(
      withTiming(-4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1, // Infinite repetitions
      true // Reverse each cycle
    );
  }, []);

  // Update scale and opacity when active state changes
  useEffect(() => {
    scale.value = withTiming(isActive ? 1.1 : 1, { duration: 300 });
    opacity.value = withTiming(isActive ? 1 : 0.8, { duration: 300 });
  }, [isActive]);

  // Create animated style for emoji and container
  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { scale: scale.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Get background color based on role
  const getBgColor = () => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "rgba(255, 215, 0, 0.2)"; // Slightly more transparent gold
      case "MODERATOR":
        return "rgba(77, 171, 247, 0.2)"; // Slightly more transparent blue
      default:
        return "rgba(255, 255, 255, 0.6)"; // Lighter default bg
    }
  };

  // Create role indicator color
  const getRoleColor = () => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "#e6bc00"; // Darker gold for better contrast
      case "MODERATOR":
        return "#1a8fe3"; // Darker blue for better contrast
      default:
        return "#666"; // Darker gray for better contrast
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.emojiBubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: getBgColor(),
            borderColor: isActive ? getRoleColor() : "rgba(0, 0, 0, 0.1)", // Darker border for light theme
            borderWidth: isActive ? 2 : 1,
            shadowColor: getRoleColor(),
          },
          animatedContainerStyle,
        ]}
      >
        <Animated.Text
          style={[
            styles.emojiText,
            { fontSize: size * 0.6 }, // Make emoji 60% of the bubble size
            animatedEmojiStyle,
          ]}
        >
          {emoji}
        </Animated.Text>
      </Animated.View>

      <Text
        style={[
          styles.nameText,
          {
            opacity: isActive ? 1 : 0.8,
            fontSize: isActive ? 14 : 12,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {name}
      </Text>

      {isActive && <View style={[styles.roleIndicator, { backgroundColor: getRoleColor() }]} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    width: 80, // Fixed width for container
  },
  emojiBubble: {
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  emojiText: {
    textAlign: "center",
  },
  nameText: {
    color: "#333", // Changed from white to dark
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
    maxWidth: 80,
    fontFamily: "SpaceMono-Regular",
  },
  roleIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    shadowColor: "#000", // Changed from white to black
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, // Less intense shadow
    shadowRadius: 3,
  },
});

export default ProfileFloatingEmoji;
