import React from "react";
import { Text, StyleSheet, StyleProp, TextStyle } from "react-native";

// Define the emoji mappings
const EMOJI_MAPPING = {
  "mappin.and.ellipse": "🧭",
  "magnifyingglass.circle": "🔍",
  "camera.fill": "📸",
  "house.fill": "🏠",
  "paperplane.fill": "✈️",
  "chevron.left.forwardslash.chevron.right": "⚡️",
  "chevron.right": "➡️",
} as const;

export type EmojiIconName = keyof typeof EMOJI_MAPPING;

interface EmojiIconProps {
  name: EmojiIconName;
  size?: number;
  color?: string; // We keep this prop for compatibility but don't use it
  style?: StyleProp<TextStyle>;
}

// Export the EmojiIcon component as the default export
export default function EmojiIcon({ name, size = 24, style }: EmojiIconProps) {
  return (
    <Text
      style={[
        styles.emoji,
        {
          fontSize: size,
          lineHeight: size * 1.2, // Ensure proper vertical alignment
        },
        style,
      ]}
    >
      {EMOJI_MAPPING[name]}
    </Text>
  );
}

// Also export it as a named export

const styles = StyleSheet.create({
  emoji: {
    textAlign: "center",
  },
});
