// FloatingEmoji.tsx - Enhanced with goodbye state support
import React, { useEffect, useState, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { useTextStreamingStore } from "@/stores/useTextStreamingStore";
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./emoji";

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  onTouchMove?: (dx: number, dy: number) => void;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({
  fallbackEmoji = "💬",
  onTouchMove,
}) => {
  // Local state for position instead of using a separate store
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Pull the emoji directly from the text streaming store
  const { currentEmoji } = useTextStreamingStore();

  // Get the selected marker ID to track marker selection state
  const { selectedMarkerId } = useLocationStore();

  // Track whether we have a marker selected
  const hasMarker = Boolean(selectedMarkerId);

  // Store marker state changes
  const previousMarkerStateRef = useRef(hasMarker);

  // Track if we're in a goodbye state
  const [isInGoodbyeState, setIsInGoodbyeState] = useState(false);

  // State for tracking emoji we display
  const [displayedEmoji, setDisplayedEmoji] = useState(fallbackEmoji);

  // Track animation interval
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track goodbye timeout to clear it if needed
  const goodbyeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation shared values
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotateZ = useSharedValue(0);

  // Helper function to determine which emoji to show
  const getEmojiToDisplay = () => {
    if (currentEmoji) {
      return currentEmoji;
    }
    return fallbackEmoji;
  };

  // Handle marker deselection and goodbye state
  useEffect(() => {
    const markerStateChanged = hasMarker !== previousMarkerStateRef.current;
    const markerDeselected = previousMarkerStateRef.current && !hasMarker;

    // Update previous marker state
    previousMarkerStateRef.current = hasMarker;

    if (markerDeselected) {
      // Enter goodbye state
      setIsInGoodbyeState(true);

      // Special wave animation for goodbye
      rotateZ.value = withRepeat(
        withSequence(
          withTiming(-0.15, { duration: 200 }),
          withTiming(0.15, { duration: 200 }),
          withTiming(-0.1, { duration: 200 }),
          withTiming(0.1, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        1
      );

      // Create a gentle bounce effect
      scale.value = withSequence(
        withTiming(1.2, { duration: 300 }),
        withSpring(1, { damping: 12, stiffness: 100 })
      );

      // Clear goodbye state after 5 seconds (matching EventAssistant's goodbye duration)
      if (goodbyeTimeoutRef.current) {
        clearTimeout(goodbyeTimeoutRef.current);
      }

      goodbyeTimeoutRef.current = setTimeout(() => {
        setIsInGoodbyeState(false);
        // Small scale down effect when returning to normal state
        scale.value = withSequence(
          withTiming(0.8, { duration: 200 }),
          withSpring(1, { damping: 15, stiffness: 120 })
        );
      }, 5000);
    }
  }, [hasMarker]);

  // Handle emoji changes with marker state awareness
  useEffect(() => {
    const newEmoji = getEmojiToDisplay();

    // Only animate if the emoji actually changes
    if (newEmoji !== displayedEmoji) {
      // Fade out, update emoji, fade in
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setDisplayedEmoji)(newEmoji);
        scale.value = 0.8;
        opacity.value = withTiming(1, { duration: 250 });
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      });
    }
  }, [currentEmoji]);

  // Position animation
  useEffect(() => {
    animatedX.value = withSpring(offset.x, { damping: 15 });
    animatedY.value = withSpring(offset.y, { damping: 15 });
  }, [offset.x, offset.y]);

  // Bobbing animation and random movement
  useEffect(() => {
    // Create gentle bobbing effect - more dynamic when in goodbye state
    const setupBobbing = () => {
      // Cancel any existing animation
      cancelAnimation(bobY);

      if (isInGoodbyeState) {
        // More active bobbing during goodbye
        bobY.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(3, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1, // Infinite repetitions
          true // Reverse animation
        );
      } else {
        // Normal gentle bobbing
        bobY.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
          ),
          -1, // Infinite repetitions
          true // Reverse animation
        );
      }
    };

    setupBobbing();

    // Simple random movement - but only active when a marker is selected or in goodbye state
    const setupRandomMovement = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Only set up random movement if we have a marker selected or in goodbye state
      if (hasMarker || isInGoodbyeState) {
        intervalRef.current = setInterval(
          () => {
            // More movement during goodbye to appear "excited"
            const movementRange = isInGoodbyeState ? 0.8 : 0.6;
            const randomX = (Math.random() - 0.5) * movementRange;
            const randomY = (Math.random() - 0.5) * movementRange;

            setOffset({ x: randomX, y: randomY });
            if (onTouchMove) onTouchMove(randomX, randomY);
          },
          isInGoodbyeState ? 3000 : 4000
        ); // More frequent movement in goodbye state
      } else {
        // Reset position when no marker is selected and not in goodbye state
        setOffset({ x: 0, y: 0 });
      }
    };

    setupRandomMovement();

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (goodbyeTimeoutRef.current) {
        clearTimeout(goodbyeTimeoutRef.current);
      }
    };
  }, [hasMarker, isInGoodbyeState, onTouchMove]);

  // Combined animation style
  const animatedEmojiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animatedX.value },
      { translateY: animatedY.value + bobY.value },
      { scale: scale.value },
      { rotateZ: `${rotateZ.value}rad` },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.emojiContainer}>
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
        <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>
          {displayedEmoji}
        </Animated.Text>
      </View>
    </View>
  );
};
