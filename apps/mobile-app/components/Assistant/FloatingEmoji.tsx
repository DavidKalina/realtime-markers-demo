import { useFloatingEmoji } from "@/hooks/useFloatingEmoji";
import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { styles } from "./styles"; // Using the newly organized styles

interface FloatingEmojiProps {
  emoji: string;
  onTouchMove: (dx: number, dy: number) => void;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({ emoji, onTouchMove }) => {
  const { animatedEmojiStyle } = useFloatingEmoji();

  return (
    <View style={styles.emojiWrapper}>
      <View style={styles.emojiContainer}>
        {/* Add a subtle shadow to make the emoji stand out like the event details icon */}
        <View
          style={[
            styles.emojiCircle,
            {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            },
          ]}
        >
          <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>{emoji}</Animated.Text>
        </View>
        <View style={styles.emojiOverlay} />
      </View>
    </View>
  );
};
