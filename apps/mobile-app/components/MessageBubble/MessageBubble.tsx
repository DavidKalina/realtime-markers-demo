import React, { memo, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { styles } from "./styles";

interface MessageBubbleProps {
  message: string;
  isTyping?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isTyping = false }) => {
  // Track current message for display
  const [displayMessage, setDisplayMessage] = useState("");

  // Single animation shared value for simple enter animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(5);

  // Effect to handle message updates with minimal animation
  useEffect(() => {
    if (!message) {
      setDisplayMessage("");
      return;
    }

    // Update the message
    setDisplayMessage(message);

    // Simple fade in and subtle rise animation
    opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [message]);

  // Create animated style
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Simplified typing indicator component
  const TypingIndicator = () => {
    return (
      <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 14 }}>
        <View style={styles.typingDot} />
        <View style={styles.typingDot} />
        <View style={styles.typingDot} />
      </View>
    );
  };

  return (
    <View style={styles.textWrapper}>
      <View style={styles.messageBubble}>
        {isTyping && !displayMessage ? (
          <TypingIndicator />
        ) : (
          <Animated.View style={animatedContentStyle}>
            <Text style={styles.messageText}>{displayMessage}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
});
