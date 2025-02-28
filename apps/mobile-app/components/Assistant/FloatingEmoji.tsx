import { useFloatingEmoji } from "@/hooks/useFloatingEmoji";
import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { styles } from "./styles";

interface FloatingEmojiProps {
  emoji: string;
  onTouchMove: (dx: number, dy: number) => void;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({ emoji, onTouchMove }) => {
  const { animatedEmojiStyle } = useFloatingEmoji();

  return (
    <View style={styles.emojiWrapper}>
      <View style={styles.emojiContainer}>
        <View style={styles.emojiCircle}>
          <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>{emoji}</Animated.Text>
        </View>
        <View style={styles.emojiOverlay} />
      </View>
    </View>
  );
};
