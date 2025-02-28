import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { styles } from "./styles";

interface MessageBubbleProps {
  message: string;
  isTyping?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isTyping = false }) => {
  return (
    <View style={styles.textWrapper}>
      <View style={styles.messageBubble}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.messageText}>
            {message}
            {isTyping && <Text style={styles.dots}>•••</Text>}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};
