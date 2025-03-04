// components/AssistantCard.tsx
import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { FloatingEmoji } from "../EventAssistantEmoji/FloatingEmoji";
import { MessageBubble } from "../MessageBubble/MessageBubble";
import { styles } from "../globalStyles";

interface AssistantCardProps {
  message: string;
  isTyping: boolean;
  containerStyle: any; // Animated style
  contentStyle?: any; // Optional animated style for content
  // Make sure we're only passing styles, not values that need to be read
}

/**
 * The main card component that displays the assistant message with emoji
 */
const AssistantCard: React.FC<AssistantCardProps> = ({
  message,
  isTyping,
  containerStyle,
  contentStyle,
}) => {
  return (
    <Animated.View style={[styles.card, containerStyle]}>
      {/* If contentStyle is provided, wrap inner content with additional animation */}
      {contentStyle ? (
        <Animated.View style={[styles.row, contentStyle]}>
          <FloatingEmoji />
          <MessageBubble message={message} isTyping={isTyping} />
        </Animated.View>
      ) : (
        <View style={styles.row}>
          <FloatingEmoji />
          <MessageBubble message={message} isTyping={isTyping} />
        </View>
      )}
    </Animated.View>
  );
};

export default AssistantCard;
