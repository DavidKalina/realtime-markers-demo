// Enhanced FloatingEmoji.tsx with more fluid animations
import React, { useEffect, useState, useRef, useMemo } from "react";
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
  interpolate,
  withDelay,
} from "react-native-reanimated";
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./emoji";
import { getMessageEmoji } from "@/utils/messageUtils";

// Spring configurations for different animations
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 100,
  mass: 0.8,
  overshootClamping: false,
};

const PULSE_SPRING = {
  damping: 8,
  stiffness: 120,
  mass: 0.6,
};

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  message: string;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({ message }) => {
  // Local state for position
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Get marker selection state from location store
  const { selectedMarkerId } = useLocationStore();
  const hasMarker = Boolean(selectedMarkerId);

  // Refs for tracking previous marker and message state
  const previousMarkerStateRef = useRef(hasMarker);
  const previousMessageRef = useRef("");
  const previousEmojiRef = useRef("");

  // Goodbye state
  const [isInGoodbyeState, setIsInGoodbyeState] = useState(false);

  // Get current emoji based on message
  const emoji = useMemo(
    () => getMessageEmoji(message, selectedMarkerId),
    [message, selectedMarkerId]
  );

  // Track emoji transitions
  const [displayEmoji, setDisplayEmoji] = useState(emoji || "");

  // Animation shared values
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1); // Base scale that other animations modify
  const pulseScale = useSharedValue(0); // Additive scale for pulse effects
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotateZ = useSharedValue(0);
  const rotateY = useSharedValue(0); // For flip animations

  // Handle emoji transitions
  useEffect(() => {
    if (emoji && emoji !== previousEmojiRef.current) {
      // Emoji change animation - flip and reveal
      rotateY.value = 0;
      rotateY.value = withSequence(
        withTiming(Math.PI / 2, { duration: 150, easing: Easing.inOut(Easing.quad) }, () => {
          runOnJS(setDisplayEmoji)(emoji);
        }),
        withDelay(50, withTiming(0, { duration: 200, easing: Easing.out(Easing.back()) }))
      );

      // Add a little bounce when emoji changes
      baseScale.value = withSequence(
        withTiming(0.9, { duration: 150 }),
        withSpring(1, SPRING_CONFIG)
      );

      previousEmojiRef.current = emoji;
    }
  }, [emoji]);

  // Handle message changes with pulse animation
  useEffect(() => {
    if (message && message !== previousMessageRef.current) {
      // Pulse animation on new message
      pulseScale.value = withSequence(
        withTiming(0.15, { duration: 200, easing: Easing.out(Easing.quad) }),
        withSpring(0, PULSE_SPRING)
      );

      previousMessageRef.current = message;
    }
  }, [message]);

  // Position animation - smoother and more natural
  useEffect(() => {
    animatedX.value = withSpring(offset.x * 20, {
      ...SPRING_CONFIG,
      damping: 18, // Slightly higher damping for horizontal movement
      velocity: 0.5, // Small initial velocity for more natural feeling
    });

    animatedY.value = withSpring(offset.y * 20, {
      ...SPRING_CONFIG,
      damping: 15,
      velocity: 0.3,
    });
  }, [offset.x, offset.y]);

  // Create more natural, organic bobbing animation
  useEffect(() => {
    const setupBobbing = () => {
      cancelAnimation(bobY);

      // Different bobbing styles based on state
      if (isInGoodbyeState) {
        // More pronounced, emotional bobbing for goodbye
        bobY.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 800, easing: Easing.out(Easing.sin) }),
            withTiming(3, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(-2, { duration: 700, easing: Easing.in(Easing.sin) })
          ),
          -1,
          true
        );
      } else if (hasMarker) {
        // Active, excited bobbing
        bobY.value = withRepeat(
          withSequence(
            withTiming(-2.5, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
            withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
      } else {
        // Gentle idle bobbing
        bobY.value = withRepeat(
          withSequence(
            withTiming(-1.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.5, { duration: 1800, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
      }
    };

    setupBobbing();
  }, [hasMarker, isInGoodbyeState]);

  // Setup random movement with more natural, organic patterns
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goodbyeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const setupRandomMovement = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Different movement patterns based on state
      if (hasMarker || isInGoodbyeState) {
        // Use Perlin noise-like movement by combining multiple cycles
        let t = 0;
        intervalRef.current = setInterval(() => {
          t += 0.05;

          // Create a more natural, organic motion by combining cycles
          // This simulates Perlin noise for more natural movement
          const cycle1 = Math.sin(t * 0.8) * 0.5;
          const cycle2 = Math.sin(t * 1.4 + 2.5) * 0.3;
          const cycle3 = Math.sin(t * 2.6 + 1.7) * 0.2;

          let movementRange = isInGoodbyeState ? 0.08 : 0.06;

          // Calculate new position with multi-cycle random movement
          const randomX = (cycle1 + cycle2 * 0.5) * movementRange;
          const randomY = (cycle2 + cycle3 * 0.7) * movementRange;

          setOffset({ x: randomX, y: randomY });
        }, 100); // Update more frequently for smoother motion
      } else {
        // Return to center position when no marker
        setOffset({ x: 0, y: 0 });
      }
    };

    setupRandomMovement();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (goodbyeTimeoutRef.current) clearTimeout(goodbyeTimeoutRef.current);
    };
  }, [hasMarker, isInGoodbyeState]);

  // Enhanced goodbye animation sequence
  useEffect(() => {
    const markerStateChanged = hasMarker !== previousMarkerStateRef.current;
    const markerDeselected = previousMarkerStateRef.current && !hasMarker;
    previousMarkerStateRef.current = hasMarker;

    if (markerDeselected) {
      setIsInGoodbyeState(true);

      // Complex wave goodbye animation
      rotateZ.value = withSequence(
        withTiming(-0.15, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0.2, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(-0.15, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
        withDelay(
          800,
          withSequence(
            withTiming(-0.08, { duration: 150 }),
            withTiming(0.08, { duration: 150 }),
            withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) })
          )
        )
      );

      // Scale up with a spring effect
      scale.value = withSequence(
        withTiming(1.3, { duration: 250, easing: Easing.out(Easing.back()) }),
        withSpring(1.1, { damping: 10, stiffness: 80 })
      );

      // Add a float-away effect before removing
      if (goodbyeTimeoutRef.current) clearTimeout(goodbyeTimeoutRef.current);
      goodbyeTimeoutRef.current = setTimeout(() => {
        // Subtle float upward and fade before resetting
        opacity.value = withTiming(0.7, { duration: 1000 });
        animatedY.value = withTiming(-30, { duration: 1200 });

        // Then reset everything
        setTimeout(() => {
          setIsInGoodbyeState(false);
          opacity.value = withTiming(1, { duration: 300 });
          animatedY.value = withSpring(0, SPRING_CONFIG);
          scale.value = withSequence(
            withTiming(0.8, { duration: 0 }), // Jump to small
            withSpring(1, SPRING_CONFIG) // Spring back to normal
          );
        }, 1200);
      }, 3800);
    } else if (hasMarker && markerStateChanged) {
      // Entrance animation when marker selected
      scale.value = withSequence(
        withTiming(0.5, { duration: 0 }), // Start small
        withTiming(1.15, { duration: 350, easing: Easing.out(Easing.back()) }), // Overshoot
        withSpring(1, SPRING_CONFIG) // Settle
      );

      // Reset any lingering animations
      opacity.value = 1;
      rotateZ.value = 0;
    }
  }, [hasMarker]);

  // Create composite animated style
  const animatedEmojiStyle = useAnimatedStyle(() => {
    // Combine base scale with pulse scale
    const compositeScale = baseScale.value * (1 + pulseScale.value);

    return {
      transform: [
        { translateX: animatedX.value },
        { translateY: animatedY.value + bobY.value },
        { rotateY: `${rotateY.value}rad` },
        { rotateZ: `${rotateZ.value}rad` },
        { scale: scale.value * compositeScale },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.emojiContainer}>
      <View
        style={[
          styles.emojiCircle,
          {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 4,
          },
        ]}
      >
        <Animated.Text style={[styles.emojiText, animatedEmojiStyle]}>{displayEmoji}</Animated.Text>
      </View>
    </View>
  );
};
