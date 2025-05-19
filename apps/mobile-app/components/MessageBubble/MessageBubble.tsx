import React, { memo, useEffect, useState, useCallback } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { styles } from "./styles";

interface MessageBubbleProps {
  message: string;
  isTyping?: boolean;
}

// Memoized typing indicator component
const TypingIndicator = memo(() => {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <View style={styles.typingDot} />
      <View style={styles.typingDot} />
      <View style={styles.typingDot} />
    </View>
  );
});

export const MessageBubble: React.FC<MessageBubbleProps> = memo(
  ({ message, isTyping = false }) => {
    // Track current message for display
    const [displayMessage, setDisplayMessage] = useState("");

    // Animation shared values
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(5);

    // Cleanup function for animations
    const cleanupAnimations = useCallback(() => {
      cancelAnimation(opacity);
      cancelAnimation(translateY);
    }, []);

    // Effect to handle message updates with minimal animation
    useEffect(() => {
      if (!message) {
        setDisplayMessage("");
        return;
      }

      // Update the message
      setDisplayMessage(message);

      // Simple fade in and subtle rise animation
      opacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.quad),
      });
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });

      // Cleanup on unmount
      return cleanupAnimations;
    }, [message, cleanupAnimations]);

    // Create animated style
    const animatedContentStyle = useAnimatedStyle(
      () => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
      }),
      [],
    );

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
  },
);
