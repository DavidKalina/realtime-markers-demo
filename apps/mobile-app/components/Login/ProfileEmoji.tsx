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
  const opacity = useSharedValue(isActive ? 1 : 0.7);

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
    opacity.value = withTiming(isActive ? 1 : 0.7, { duration: 300 });
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
        return "rgba(255, 215, 0, 0.25)"; // Gold for admin
      case "MODERATOR":
        return "rgba(77, 171, 247, 0.25)"; // Blue for moderator
      default:
        return "rgba(255, 255, 255, 0.2)"; // Default for users
    }
  };

  // Create role indicator color
  const getRoleColor = () => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "#FFD700"; // Gold for admin
      case "MODERATOR":
        return "#4dabf7"; // Blue for moderator
      default:
        return "#aaa"; // Default for users
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
            borderColor: isActive ? getRoleColor() : "rgba(255, 255, 255, 0.2)",
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
            opacity: isActive ? 1 : 0.7,
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
    color: "#fff",
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
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
});

export default ProfileFloatingEmoji;
