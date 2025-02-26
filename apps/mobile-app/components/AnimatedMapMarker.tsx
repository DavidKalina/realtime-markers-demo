import React, { useEffect, useState, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

// Define different marker behaviors
export enum MarkerBehavior {
  BOBBING = "bobbing",
  WIGGLING = "wiggling",
  BLINKING = "blinking",
  PULSING = "pulsing",
  SPINNING = "spinning",
  CALLING = "calling",
  JUMPING = "jumping",
  IDLING = "idling",
}

// Lifecycle patterns - sequences of behaviors
export enum BehaviorPattern {
  STANDARD = "standard", // Basic subtle movements
  IMPORTANT = "important", // Slightly more attention-grabbing
  INTERACTIVE = "interactive", // Invites user interaction
  PASSIVE = "passive", // Very subtle, background element
  HIGHLIGHT = "highlight", // Draws attention but not overwhelming
}

// Define the shape of a behavior step
interface BehaviorStep {
  behavior: MarkerBehavior;
  duration: number;
  slow?: boolean;
}

// Behavior pattern definitions - with more subtle, professional animations
const BEHAVIOR_PATTERNS: Record<BehaviorPattern, BehaviorStep[]> = {
  [BehaviorPattern.STANDARD]: [
    { behavior: MarkerBehavior.IDLING, duration: 4000 },
    { behavior: MarkerBehavior.BOBBING, duration: 2000 },
    { behavior: MarkerBehavior.IDLING, duration: 3000 },
  ],
  [BehaviorPattern.IMPORTANT]: [
    { behavior: MarkerBehavior.PULSING, duration: 2000 },
    { behavior: MarkerBehavior.IDLING, duration: 3000 },
    { behavior: MarkerBehavior.CALLING, duration: 2500 },
  ],
  [BehaviorPattern.INTERACTIVE]: [
    { behavior: MarkerBehavior.WIGGLING, duration: 1500 },
    { behavior: MarkerBehavior.IDLING, duration: 2000 },
    { behavior: MarkerBehavior.CALLING, duration: 2000 },
  ],
  [BehaviorPattern.PASSIVE]: [
    { behavior: MarkerBehavior.IDLING, duration: 5000 },
    { behavior: MarkerBehavior.BOBBING, duration: 1500, slow: true },
    { behavior: MarkerBehavior.IDLING, duration: 4000 },
  ],
  [BehaviorPattern.HIGHLIGHT]: [
    { behavior: MarkerBehavior.JUMPING, duration: 1000 },
    { behavior: MarkerBehavior.IDLING, duration: 3000 },
    { behavior: MarkerBehavior.SPINNING, duration: 1500 },
  ],
};

interface MarioMarkerProps {
  emoji: string;
  onPress?: () => void;
  pattern?: BehaviorPattern;
  currentBehavior?: MarkerBehavior; // For manual control if needed
  talkBubbleText?: string; // For call-out text
  cycleBehaviors?: boolean; // Whether to automatically cycle through behavior patterns
  cycleInterval?: number; // How long to stay on each pattern before changing (in ms)
}

const MarioMarker: React.FC<MarioMarkerProps> = ({
  emoji = "📍", // Default to pin
  onPress = () => {},
  pattern = BehaviorPattern.STANDARD, // Default to standard, more subtle behavior
  currentBehavior,
  talkBubbleText = "Tap",
  cycleBehaviors = false, // Whether to cycle through different behavior patterns
  cycleInterval = 15000, // Cycle to a new pattern every 15 seconds by default
}) => {
  // Animation shared values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const bubbleScale = useSharedValue(0);

  // Track current behavior state
  const [activeBehavior, setActiveBehavior] = useState<MarkerBehavior>(
    currentBehavior || MarkerBehavior.IDLING
  );

  // Keep track of behavior index in the pattern
  const [behaviorIndex, setBehaviorIndex] = useState(0);

  // Keep track of active pattern when cycling is enabled
  const [activePattern, setActivePattern] = useState<BehaviorPattern>(pattern);

  // Timeouts reference for cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patternCycleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // List of all patterns to cycle through
  const allPatterns = Object.values(BehaviorPattern);

  // Set up pattern cycling if enabled
  useEffect(() => {
    if (!cycleBehaviors) {
      setActivePattern(pattern);
      return;
    }

    // Start with the provided pattern
    setActivePattern(pattern);

    // Set up cycling through patterns
    const cyclePattern = () => {
      setActivePattern((prevPattern) => {
        const currentIndex = allPatterns.indexOf(prevPattern);
        const nextIndex = (currentIndex + 1) % allPatterns.length;
        return allPatterns[nextIndex];
      });
    };

    // Set initial cycle timeout
    patternCycleRef.current = setTimeout(cyclePattern, cycleInterval);

    // Set up recurring cycling
    const intervalId = setInterval(cyclePattern, cycleInterval);

    return () => {
      if (patternCycleRef.current) {
        clearTimeout(patternCycleRef.current);
      }
      clearInterval(intervalId);
    };
  }, [cycleBehaviors, pattern, cycleInterval]);

  // Apply a specific behavior animation
  const applyBehavior = (
    behavior: MarkerBehavior,
    duration: number = 2000,
    isSlowed: boolean = false
  ) => {
    // Cancel any running animations
    cancelAnimation(translateY);
    cancelAnimation(translateX);
    cancelAnimation(scale);
    cancelAnimation(rotation);
    cancelAnimation(bubbleScale);

    // Reset animation values
    translateY.value = 0;
    translateX.value = 0;
    scale.value = 1;
    rotation.value = 0;
    bubbleScale.value = 0;

    const speedFactor = isSlowed ? 1.5 : 1;

    // Apply the specific behavior animation - with subtler movements
    switch (behavior) {
      case MarkerBehavior.BOBBING:
        // Gentle bobbing motion
        translateY.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 600 * speedFactor }),
            withTiming(0, { duration: 600 * speedFactor })
          ),
          Math.max(1, Math.floor(duration / 1200))
        );
        break;

      case MarkerBehavior.WIGGLING:
        // Subtle side to side motion
        translateX.value = withRepeat(
          withSequence(
            withTiming(3, { duration: 400 * speedFactor }),
            withTiming(-3, { duration: 400 * speedFactor }),
            withTiming(0, { duration: 400 * speedFactor })
          ),
          Math.max(1, Math.floor(duration / 1200))
        );
        break;

      case MarkerBehavior.BLINKING:
        // Replace blinking with a gentle fade pulse
        scale.value = withRepeat(
          withSequence(withTiming(1.05, { duration: 700 }), withTiming(0.98, { duration: 700 })),
          Math.max(1, Math.floor(duration / 1400))
        );
        break;

      case MarkerBehavior.PULSING:
        // More subtle pulse
        scale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 500 * speedFactor }),
            withTiming(0.95, { duration: 500 * speedFactor }),
            withTiming(1, { duration: 300 * speedFactor })
          ),
          Math.max(1, Math.floor(duration / 1300))
        );
        break;

      case MarkerBehavior.SPINNING:
        // Gentle rotation (not full 360)
        rotation.value = withRepeat(
          withSequence(
            withTiming(Math.PI / 6, { duration: 700 * speedFactor }),
            withTiming(-Math.PI / 6, { duration: 700 * speedFactor }),
            withTiming(0, { duration: 500 * speedFactor })
          ),
          Math.max(1, Math.floor(duration / 1900))
        );
        break;

      case MarkerBehavior.CALLING:
        // Show hint indicator
        bubbleScale.value = withSequence(
          withTiming(1, { duration: 400 }),
          withDelay(duration - 800, withTiming(0, { duration: 400 }))
        );
        break;

      case MarkerBehavior.JUMPING:
        // More subtle jump
        translateY.value = withRepeat(
          withSequence(
            withTiming(-6, {
              duration: 300,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            withTiming(0, {
              duration: 400,
              easing: Easing.bezier(0.5, 1, 0.89, 1),
            })
          ),
          Math.max(1, Math.floor(duration / 700))
        );
        break;

      case MarkerBehavior.IDLING:
      default:
        // Very subtle floating motion
        translateY.value = withRepeat(
          withSequence(
            withTiming(-2, {
              duration: 1500 * speedFactor,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            }),
            withTiming(0, {
              duration: 1500 * speedFactor,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            })
          ),
          Math.max(1, Math.floor(duration / 3000))
        );
        break;
    }

    setActiveBehavior(behavior);
  };

  // Run the behavior lifecycle
  useEffect(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If a specific behavior is forced, just use that one
    if (currentBehavior) {
      applyBehavior(currentBehavior, 2000);
      return;
    }

    // Otherwise use the active pattern (which could be cycling)
    const steps = BEHAVIOR_PATTERNS[activePattern];
    const currentStep = steps[behaviorIndex];

    // Apply the current behavior
    applyBehavior(currentStep.behavior, currentStep.duration, currentStep.slow);

    // Schedule the next behavior
    timeoutRef.current = setTimeout(() => {
      // Move to the next behavior in the pattern, or loop back to the start
      const nextIndex = (behaviorIndex + 1) % steps.length;
      setBehaviorIndex(nextIndex);
    }, currentStep.duration);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [behaviorIndex, activePattern, currentBehavior]);

  // Define animated styles
  const markerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
    };
  });

  const hintStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.7,
      transform: [{ scale: bubbleScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Subtle hint that appears during "calling" behavior */}
      {activeBehavior === MarkerBehavior.CALLING && (
        <Animated.View style={[styles.hint, hintStyle]}>
          <Text style={styles.hintText}>{talkBubbleText}</Text>
        </Animated.View>
      )}

      {/* The marker itself */}
      <Animated.View style={[markerStyle]}>
        <Pressable style={styles.marker} onPress={onPress}>
          <Text style={styles.markerIcon}>{emoji}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 60, // Reduced space for more subtle animations
    width: 60, // Fixed width to prevent layout shifts
  },
  marker: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 100,
    backgroundColor: "#333", // Charcoal color
    width: 44,
    height: 44,
    padding: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
  markerIcon: {
    fontSize: 18,
    color: "#fff",
  },
  hint: {
    position: "absolute",
    top: -18, // Moved higher up to avoid overlap
    backgroundColor: "rgba(255, 255, 255, 1)",
    borderRadius: 8,
    padding: 3, // Reduced vertical padding
    paddingHorizontal: 8,
    zIndex: 10,
    minWidth: 150,
    maxWidth: 250,
    alignItems: "center",
  },
  hintText: {
    fontSize: 10, // Slightly smaller font
    color: "#333",
    fontWeight: "condensedBold",
    textAlign: "center",
    lineHeight: 12, // Tighter line height
  },
});

export default MarioMarker;
