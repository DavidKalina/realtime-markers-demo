import React, { memo, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  Easing,
  interpolate,
  withSequence,
  withDelay,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { styles } from "./styles";

interface MessageBubbleProps {
  message: string;
  isTyping?: boolean;
}

// Use memo to prevent unnecessary re-renders
export const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isTyping = false }) => {
  // Track current and previous messages for transitions
  const [displayMessage, setDisplayMessage] = useState("");
  const previousMessageRef = useRef("");

  // Animation shared values
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const bubbleScale = useSharedValue(1);
  const bubbleTranslateY = useSharedValue(0);

  // Constants for spring animation
  const springConfig = { damping: 12, stiffness: 120, mass: 0.8 };

  // Effect to handle message updates with animations
  useEffect(() => {
    // Don't animate if message is empty
    if (!message) {
      setDisplayMessage("");
      return;
    }

    // Check if this is a new message (not just an extension of current message)
    const isNewMessage =
      !message.startsWith(previousMessageRef.current) ||
      message.length < previousMessageRef.current.length;

    if (isNewMessage) {
      // Cancel any running animations
      cancelAnimation(scale);
      cancelAnimation(translateY);
      cancelAnimation(bubbleScale);
      cancelAnimation(bubbleTranslateY);

      // Update the message
      setDisplayMessage(message);
      previousMessageRef.current = message;

      // Animate the bubble
      bubbleScale.value = withSequence(
        withTiming(0.97, { duration: 150, easing: Easing.out(Easing.quad) }),
        withSpring(1, springConfig)
      );

      // Subtle float-in from bottom
      translateY.value = 10;
      translateY.value = withSpring(0, springConfig);

      // Add a tiny bounce effect
      bubbleTranslateY.value = withSequence(
        withTiming(2, { duration: 120 }),
        withSpring(0, { damping: 8, stiffness: 100 })
      );

      // Scale animation for emphasis
      scale.value = withSequence(
        withTiming(1.03, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) })
      );
    } else {
      // It's just an extension of the current message (like typing more)
      // Just update the display without full animations
      setDisplayMessage(message);
      previousMessageRef.current = message;

      // Add a subtle pulse on text update
      scale.value = withSequence(
        withTiming(1.01, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.inOut(Easing.quad) })
      );
    }
  }, [message]);

  // Create animated styles
  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bubbleScale.value }, { translateY: bubbleTranslateY.value }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  // Typing indicator component
  const TypingIndicator = () => {
    // Animation values for dots
    const dot1Opacity = useSharedValue(0.4);
    const dot2Opacity = useSharedValue(0.4);
    const dot3Opacity = useSharedValue(0.4);

    // Start typing animation on mount
    useEffect(() => {
      const animateDots = () => {
        dot1Opacity.value = withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.4, { duration: 400 })
        );

        dot2Opacity.value = withSequence(
          withDelay(150, withTiming(1, { duration: 400 })),
          withTiming(0.4, { duration: 400 })
        );

        dot3Opacity.value = withSequence(
          withDelay(300, withTiming(1, { duration: 400 })),
          withTiming(0.4, { duration: 400 }),
          withDelay(
            100,
            withTiming(0.4, { duration: 1 }, () => {
              runOnJS(animateDots)();
            })
          )
        );
      };

      animateDots();

      return () => {
        cancelAnimation(dot1Opacity);
        cancelAnimation(dot2Opacity);
        cancelAnimation(dot3Opacity);
      };
    }, []);

    // Animated styles for dots
    const dot1Style = useAnimatedStyle(() => ({
      opacity: dot1Opacity.value,
      transform: [{ scale: interpolate(dot1Opacity.value, [0.4, 1], [1, 1.2]) }],
    }));

    const dot2Style = useAnimatedStyle(() => ({
      opacity: dot2Opacity.value,
      transform: [{ scale: interpolate(dot2Opacity.value, [0.4, 1], [1, 1.2]) }],
    }));

    const dot3Style = useAnimatedStyle(() => ({
      opacity: dot3Opacity.value,
      transform: [{ scale: interpolate(dot3Opacity.value, [0.4, 1], [1, 1.2]) }],
    }));

    return (
      <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 14 }}>
        <Animated.View style={[styles.typingDot, dot1Style]} />
        <Animated.View style={[styles.typingDot, dot2Style]} />
        <Animated.View style={[styles.typingDot, dot3Style]} />
      </View>
    );
  };

  return (
    <View style={styles.textWrapper}>
      <Animated.View style={[styles.messageBubble, animatedBubbleStyle]}>
        {isTyping && !displayMessage ? (
          <TypingIndicator />
        ) : (
          <Animated.View style={animatedContentStyle}>
            <Text style={styles.messageText}>{displayMessage}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
});
