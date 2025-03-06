import React, { useEffect } from "react";
import { StyleSheet, Dimensions, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

// List of emojis that will fountain across the screen
const emojis = [
  "🗺️",
  "📍",
  "🧭",
  "🌍",
  "🚗",
  "🏙️",
  "🏔️",
  "🏝️",
  "🏕️",
  "🛣️",
  "🚶",
  "🚲",
  "🌎",
  "🏘️",
  "⛰️",
  "🏞️",
];

// Set this to true to make the animation loop
const LOOP_ANIMATION = true;

const EmojiOverlay = () => {
  // Animation values for each emoji
  const emojiValues = emojis.map(() => ({
    translateX: useSharedValue(0),
    translateY: useSharedValue(0),
    rotate: useSharedValue(0),
    scale: useSharedValue(0),
    opacity: useSharedValue(0),
  }));

  // Function to animate a single emoji with delay
  const animateEmoji = (values: any, delay: number) => {
    // Random starting position in the center area of the screen
    const startX = (Math.random() * 0.5 - 0.25) * width;
    const startY = (Math.random() * 0.5 - 0.25) * height;

    // Random movement direction
    const directionX = (Math.random() * 2 - 1) * width * 0.6;
    const directionY = (Math.random() * 2 - 1) * height * 0.6;

    // Reset to starting position
    values.translateX.value = startX;
    values.translateY.value = startY;
    values.scale.value = 0;
    values.opacity.value = 0;

    // Animate opacity
    values.opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(2000 + Math.random() * 2000, withTiming(0, { duration: 1000 }))
      )
    );

    // Animate scale
    values.scale.value = withDelay(delay, withSpring(0.7 + Math.random() * 0.7, { damping: 6 }));

    // Animate horizontal movement
    values.translateX.value = withDelay(
      delay,
      withSequence(
        withSpring(startX + directionX * 0.4, {
          damping: 9,
          stiffness: 40,
        }),
        withSpring(startX + directionX, {
          damping: 15,
          stiffness: 30,
          mass: 0.8 + Math.random() * 0.8,
        })
      )
    );

    // Animate vertical movement
    values.translateY.value = withDelay(
      delay,
      withSequence(
        withSpring(startY + directionY * 0.4, {
          damping: 7,
          stiffness: 70,
        }),
        withSpring(startY + directionY, {
          damping: 12,
          stiffness: 40,
        })
      )
    );

    // Animate rotation
    values.rotate.value = withDelay(
      delay,
      withSequence(
        withSpring((Math.random() * 2 - 1) * Math.PI, { damping: 8 }),
        withSpring((Math.random() * 3 - 1.5) * Math.PI, {
          damping: 15,
          stiffness: 25,
        })
      )
    );
  };

  // Start all animations
  const startAnimationForAll = () => {
    // Animate each emoji to appear and move across the screen
    emojiValues.forEach((values, index) => {
      // Staggered delays
      const delay = index * 150;
      animateEmoji(values, delay);
    });
  };

  // Start the animation
  useEffect(() => {
    // Initial animation
    startAnimationForAll();

    // Set up animation loop if enabled
    if (LOOP_ANIMATION) {
      const intervalId = setInterval(() => {
        // Randomly select emojis to animate
        const numToRestart = Math.floor(emojis.length / 4) + 1;
        const indicesToRestart = Array.from({ length: numToRestart }, () =>
          Math.floor(Math.random() * emojis.length)
        );

        indicesToRestart.forEach((index) => {
          if (index < emojiValues.length) {
            // Restart this emoji's animation with new random parameters
            animateEmoji(emojiValues[index], Math.random() * 500);
          }
        });
      }, 1500); // Every 1.5 seconds, restart some emojis

      return () => clearInterval(intervalId);
    }
  }, []);

  // Create the emoji animated components
  const renderEmojis = () => {
    return emojis.map((emoji, index) => {
      const emojiStyle = useAnimatedStyle(() => {
        return {
          transform: [
            { translateX: emojiValues[index].translateX.value },
            { translateY: emojiValues[index].translateY.value },
            { rotate: `${emojiValues[index].rotate.value}rad` },
            { scale: emojiValues[index].scale.value },
          ],
          opacity: emojiValues[index].opacity.value,
        };
      });

      return (
        <Animated.View key={index} style={[styles.emojiContainer, emojiStyle]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </Animated.View>
      );
    });
  };

  return <View style={styles.container}>{renderEmojis()}</View>;
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    height: height,
    width: width,
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "#333333", // Charcoal color
    zIndex: -1, // Ensure it appears above other content
  },
  emojiContainer: {
    position: "absolute",
    backgroundColor: "#333333", // Charcoal color
    borderRadius: 30, // Make containers circular
    padding: 8,
    width: 36, // Fixed width for circle
    height: 36, // Fixed height for circle
    justifyContent: "center",
    alignItems: "center",
    elevation: 5, // Add shadow on Android
    shadowColor: "#000", // Add shadow on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  emoji: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
  },
});

export default EmojiOverlay;
