import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
} from "react-native-reanimated";
import { styles } from "./styles";
import { EventType } from "./types";

interface MessageBubbleProps {
  currentEvent: EventType;
  currentStreamedText: string;
  isTyping: boolean;
  messageIndex: number;
  isTransitioning?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  currentEvent,
  currentStreamedText,
  isTyping,
  messageIndex,
  isTransitioning = false,
}) => {
  // Animation shared value for bubble scale effect
  const bubbleScale = useSharedValue(1);

  // Trigger bubble animation when transitioning
  useEffect(() => {
    if (isTransitioning) {
      bubbleScale.value = withSequence(
        withTiming(1.03, { duration: 300 }),
        withTiming(1, { duration: 300 })
      );
    }
  }, [isTransitioning]);

  // Animated style for the bubble
  const animatedBubbleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: bubbleScale.value }],
    };
  });

  return (
    <View style={styles.textWrapper}>
      <Animated.View style={[styles.messageBubble, animatedBubbleStyle]}>
        {isTransitioning ? (
          // Keep transition messages centered
          <Animated.Text style={styles.transitionMessageText} entering={FadeIn.duration(300)}>
            {currentStreamedText}
          </Animated.Text>
        ) : (
          // Regular chat message with left-aligned text for natural streaming
          <View style={{ width: "100%" }}>
            <Text style={styles.messageText}>
              {currentStreamedText}
              {isTyping && (
                <Text style={styles.dots}>{currentStreamedText.length === 0 ? "•••" : "•"}</Text>
              )}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};
