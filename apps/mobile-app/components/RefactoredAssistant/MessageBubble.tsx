import React, { memo, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, useSharedValue, withSpring } from "react-native-reanimated";
import { styles } from "./styles";

interface MessageBubbleProps {
  message: string;
  isTyping?: boolean;
}

// Use memo to prevent unnecessary re-renders
export const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isTyping = false }) => {
  // Use shared values for animation performance
  const opacity = useSharedValue(1);
  const lastMessageRef = useRef("");

  // Only animate when a completely new message starts
  useEffect(() => {
    if (message && message !== lastMessageRef.current && message.length === 1) {
      opacity.value = withSpring(1, { damping: 20, stiffness: 90 });
      lastMessageRef.current = message;
    }
  }, [message]);

  // No longer need animated styles for dots

  // No typing indicator anymore

  return (
    <View style={styles.textWrapper}>
      <View style={styles.messageBubble}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.messageText}>{message}</Text>
        </Animated.View>
      </View>
    </View>
  );
});
