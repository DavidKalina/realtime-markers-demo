import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  roles: {
    admin: {
      background: "rgba(255, 204, 0, 0.15)",
      border: "rgba(255, 204, 0, 0.3)",
      text: "#ffcc00"
    },
    moderator: {
      background: "rgba(147, 197, 253, 0.15)",
      border: "rgba(147, 197, 253, 0.3)",
      text: "#93c5fd"
    },
    default: {
      background: "rgba(255, 255, 255, 0.05)",
      border: "rgba(255, 255, 255, 0.1)",
      text: "#a0a0a0"
    }
  }
};

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
  // Animation shared values
  const floatY = useSharedValue(0);
  const scale = useSharedValue(isActive ? 1.05 : 1);
  const opacity = useSharedValue(isActive ? 1 : 0.9);

  // Setup floating animation
  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-3, {
        duration: 1800,
        easing: Easing.inOut(Easing.sin)
      }),
      -1,
      true
    );
  }, []);

  // Update scale and opacity when active state changes
  useEffect(() => {
    scale.value = withTiming(isActive ? 1.05 : 1, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    });
    opacity.value = withTiming(isActive ? 1 : 0.9, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    });
  }, [isActive]);

  // Animated styles
  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { scale: scale.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Get role-based styles
  const getRoleStyles = () => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return COLORS.roles.admin;
      case "MODERATOR":
        return COLORS.roles.moderator;
      default:
        return COLORS.roles.default;
    }
  };

  const roleStyles = getRoleStyles();

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.emojiBubble,
          {
            width: size,
            height: size,
            borderRadius: 12,
            backgroundColor: roleStyles.background,
            borderColor: roleStyles.border,
            borderWidth: isActive ? 2 : 1,
          },
          animatedContainerStyle,
        ]}
      >
        <Animated.Text
          style={[
            styles.emojiText,
            { fontSize: size * 0.55 },
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
            color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
            fontSize: isActive ? 14 : 13,
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {name}
      </Text>

      {isActive && (
        <View
          style={[
            styles.roleIndicator,
            { backgroundColor: roleStyles.text }
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    width: 80,
  },
  emojiBubble: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  emojiText: {
    textAlign: "center",
  },
  nameText: {
    marginTop: 8,
    textAlign: "center",
    fontWeight: "600",
    maxWidth: 80,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  roleIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    opacity: 0.9,
  },
});

export default ProfileFloatingEmoji;
