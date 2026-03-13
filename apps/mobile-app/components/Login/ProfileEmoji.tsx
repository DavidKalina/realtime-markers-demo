import {
  useColors,
  spacing,
  radius,
  fontWeight,
  fontFamily,
  type Colors,
} from "@/theme";
import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Domain-specific role colors (admin gold, moderator, default)
const getRoleColors = (colors: Colors) => ({
  admin: {
    background: "rgba(255, 204, 0, 0.15)",
    border: "rgba(255, 204, 0, 0.3)",
    text: "#ffcc00",
  },
  moderator: {
    background: colors.accent.muted,
    border: colors.accent.border,
    text: colors.accent.primary,
  },
  default: {
    background: colors.border.subtle,
    border: colors.border.medium,
    text: colors.text.secondary,
  },
});

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ROLE_COLORS = useMemo(() => getRoleColors(colors), [colors]);
  // Animation shared values
  const floatY = useSharedValue(0);
  const scale = useSharedValue(isActive ? 1.05 : 1);
  const opacity = useSharedValue(isActive ? 1 : 0.9);

  // Setup floating animation
  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-3, {
        duration: 1800,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, []);

  // Update scale and opacity when active state changes
  useEffect(() => {
    scale.value = withTiming(isActive ? 1.05 : 1, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    opacity.value = withTiming(isActive ? 1 : 0.9, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
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
        return ROLE_COLORS.admin;
      case "MODERATOR":
        return ROLE_COLORS.moderator;
      default:
        return ROLE_COLORS.default;
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
            borderRadius: radius.md,
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
            color: isActive ? colors.text.primary : colors.text.secondary,
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
          style={[styles.roleIndicator, { backgroundColor: roleStyles.text }]}
        />
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing._10,
      width: 80,
    },
    emojiBubble: {
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.overlay.light,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
    emojiText: {
      textAlign: "center",
    },
    nameText: {
      marginTop: spacing.sm,
      textAlign: "center",
      fontWeight: fontWeight.semibold,
      maxWidth: 80,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.2,
    },
    roleIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: spacing._6,
      opacity: 0.9,
    },
  });

export default ProfileFloatingEmoji;
