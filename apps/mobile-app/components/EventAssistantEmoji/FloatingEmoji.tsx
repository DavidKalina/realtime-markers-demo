// FloatingEmoji.tsx - Now using the emoji util
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
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./emoji";
import { getMessageEmoji } from "@/utils/messageUtils";

interface FloatingEmojiProps {
  fallbackEmoji?: string;
  onTouchMove?: (dx: number, dy: number) => void;
}

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({
  fallbackEmoji = "💬",
  onTouchMove,
}) => {
  // Local state for position
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Get marker selection state from location store
  const { selectedMarkerId } = useLocationStore();
  const hasMarker = Boolean(selectedMarkerId);

  // Refs for tracking previous marker state
  const previousMarkerStateRef = useRef(hasMarker);

  // Goodbye state
  const [isInGoodbyeState, setIsInGoodbyeState] = useState(false);

  // Determine which emoji to display using the emoji util.
  // For example, if a marker is selected, we assume a "discovered" message.
  const getEmojiToDisplay = () => {
    if (selectedMarkerId) {
      return getMessageEmoji("discovered", selectedMarkerId) || fallbackEmoji;
    }
    return fallbackEmoji;
  };

  // Displayed emoji state, initially calculated from the util
  const [displayedEmoji, setDisplayedEmoji] = useState(getEmojiToDisplay());

  // When the marker changes, update the displayed emoji
  useEffect(() => {
    const newEmoji = getEmojiToDisplay();
    if (newEmoji !== displayedEmoji) {
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setDisplayedEmoji)(newEmoji);
        scale.value = 0.8;
        opacity.value = withTiming(1, { duration: 250 });
        scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      });
    }
  }, [selectedMarkerId]);

  // Animation shared values
  const animatedX = useSharedValue(0);
  const animatedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bobY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotateZ = useSharedValue(0);

  // Position animation
  useEffect(() => {
    animatedX.value = withSpring(offset.x, { damping: 15 });
    animatedY.value = withSpring(offset.y, { damping: 15 });
  }, [offset.x, offset.y]);

  // Bobbing animation and random movement
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goodbyeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const setupBobbing = () => {
      cancelAnimation(bobY);
      if (isInGoodbyeState) {
        bobY.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(3, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
      } else {
        bobY.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
      }
    };

    setupBobbing();

    const setupRandomMovement = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (hasMarker || isInGoodbyeState) {
        intervalRef.current = setInterval(
          () => {
            const movementRange = isInGoodbyeState ? 0.8 : 0.6;
            const randomX = (Math.random() - 0.5) * movementRange;
            const randomY = (Math.random() - 0.5) * movementRange;
            setOffset({ x: randomX, y: randomY });
            if (onTouchMove) onTouchMove(randomX, randomY);
          },
          isInGoodbyeState ? 3000 : 4000
        );
      } else {
        setOffset({ x: 0, y: 0 });
      }
    };

    setupRandomMovement();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (goodbyeTimeoutRef.current) clearTimeout(goodbyeTimeoutRef.current);
    };
  }, [hasMarker, isInGoodbyeState, onTouchMove]);

  // Handle marker deselection and trigger goodbye animation
  useEffect(() => {
    const markerStateChanged = hasMarker !== previousMarkerStateRef.current;
    const markerDeselected = previousMarkerStateRef.current && !hasMarker;
    previousMarkerStateRef.current = hasMarker;
    if (markerDeselected) {
      setIsInGoodbyeState(true);
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
      scale.value = withSequence(
        withTiming(1.2, { duration: 300 }),
        withSpring(1, { damping: 12, stiffness: 100 })
      );
      if (goodbyeTimeoutRef.current) clearTimeout(goodbyeTimeoutRef.current);
      goodbyeTimeoutRef.current = setTimeout(() => {
        setIsInGoodbyeState(false);
        scale.value = withSequence(
          withTiming(0.8, { duration: 200 }),
          withSpring(1, { damping: 15, stiffness: 120 })
        );
      }, 5000);
    }
  }, [hasMarker]);

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
