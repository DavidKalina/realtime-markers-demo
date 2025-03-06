import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

// Reduced list of emojis that will fountain out of the text
const emojis = ["🗺️", "📍", "🌍", "🏙️", "🏔️", "🏝️", "🏕️", "🛣️", "🌎"];

// Set this to true to make the animation loop
const LOOP_ANIMATION = true;

// New configuration for animation timing
const ANIMATION_CONFIG = {
  burstDuration: 2500, // Duration of emoji bursts
  gapDuration: 3000, // Duration of gaps between bursts
  emojisPerBurst: 3, // Number of emojis to emit in each burst
  emojiSpacing: 150, // Delay between emojis in the same burst
};

const MapMojiHeader = () => {
  // Animation values
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);
  const textPulse = useSharedValue(1);
  const inBurstPhase = useSharedValue(false); // Track if we're in a burst phase

  const emojiValues = emojis.map(() => ({
    translateX: useSharedValue(0),
    translateY: useSharedValue(0),
    rotate: useSharedValue(0),
    scale: useSharedValue(0),
    opacity: useSharedValue(0),
    active: useSharedValue(false), // Track if emoji is active
    launchTime: useSharedValue(0), // Track when emoji was launched
  }));

  // Function to make text wince in response to emoji movement
  // Need to mark this as a worklet to be called from the UI thread
  const triggerWince = (intensity = 1) => {
    "worklet";
    // Only wince if we're in a burst phase
    if (!inBurstPhase.value) return;

    // Cancel any ongoing animation
    cancelAnimation(textPulse);

    // Create a quick, responsive wince with intensity factor
    const winceAmount = 0.03 * intensity;

    textPulse.value = withSequence(
      // Quick compression as if being squeezed
      withTiming(1 - winceAmount, {
        duration: 80,
        easing: Easing.out(Easing.quad),
      }),
      // Bounce back with slight overshoot
      withTiming(1 + winceAmount * 0.7, {
        duration: 100,
        easing: Easing.out(Easing.back(2)),
      }),
      // Settle back to normal
      withTiming(1, {
        duration: 120,
        easing: Easing.inOut(Easing.quad),
      })
    );
  };

  // Function to animate a single emoji with delay
  const animateEmoji = (values: any, delay: number, index: number) => {
    // Only animate if we're in a burst phase
    if (!inBurstPhase.value) return;

    // Random horizontal spread - wider distribution
    const spreadX = (Math.random() * 2 - 1) * width * 0.45;

    // Determine if this emoji will go up or down
    const goingUp = Math.random() > 0.5;

    // Record when this emoji launches for wince timing
    const launchTime = Date.now() + delay;
    values.launchTime.value = launchTime;
    values.active.value = true;

    // Opacity animation
    values.opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 150 }, (finished) => {
          "worklet";
          if (finished && inBurstPhase.value) {
            // Trigger small wince when emoji appears
            triggerWince(0.5);
          }
        }),
        withDelay(
          800 + Math.random() * 1000, // Display time
          withTiming(0, { duration: 600 }, (finished) => {
            "worklet";
            if (finished && inBurstPhase.value) {
              // Trigger more significant wince when emoji disappears
              triggerWince(1.5);
              values.active.value = false;
            }
          })
        )
      )
    );

    values.scale.value = withDelay(delay, withSpring(0.7 + Math.random() * 0.5, { damping: 6 }));

    // Horizontal movement with wince triggers at key points
    values.translateX.value = withDelay(
      delay,
      withSequence(
        withSpring(
          spreadX * 0.6,
          {
            damping: 9,
            stiffness: 40,
          },
          (finished) => {
            "worklet";
            // Subtle wince from initial movement
            if (finished && values.active.value && inBurstPhase.value) {
              triggerWince(0.7);
            }
          }
        ),
        withSpring(spreadX, {
          damping: 15,
          stiffness: 30,
          mass: 0.8 + Math.random() * 0.8,
        })
      )
    );

    // Vertical movement - fountain effect in both directions
    if (goingUp) {
      // Upward movement
      values.translateY.value = withDelay(
        delay,
        withSequence(
          // First go up with different heights
          withSpring(-(30 + Math.random() * 100), {
            damping: 7,
            stiffness: 70,
          }),
          // Middle drift
          withSpring(
            -(50 + Math.random() * 70),
            {
              damping: 12,
              stiffness: 40,
            },
            (finished) => {
              "worklet";
              // Mid-flight wince
              if (finished && values.active.value && inBurstPhase.value) {
                triggerWince(0.8);
              }
            }
          ),
          // Final movement with continued upward drift
          withTiming(-(120 + Math.random() * 180), {
            duration: 1800 + Math.random() * 1200,
            easing: Easing.cubic,
          })
        )
      );
    } else {
      // Downward movement
      values.translateY.value = withDelay(
        delay,
        withSequence(
          // First go down with different distances
          withSpring(30 + Math.random() * 100, {
            damping: 7,
            stiffness: 70,
          }),
          // Middle drift
          withSpring(
            50 + Math.random() * 70,
            {
              damping: 12,
              stiffness: 40,
            },
            (finished) => {
              "worklet";
              // Mid-flight wince
              if (finished && values.active.value && inBurstPhase.value) {
                triggerWince(0.8);
              }
            }
          ),
          // Final movement with continued downward drift
          withTiming(120 + Math.random() * 180, {
            duration: 1800 + Math.random() * 1200,
            easing: Easing.cubic,
          })
        )
      );
    }

    // Random rotation
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

  // Emit a burst of emojis
  const emitEmojiBurst = () => {
    // Set to burst phase
    inBurstPhase.value = true;

    // Select random emojis for this burst
    const emojisToAnimate = [];
    const availableIndices = emojiValues
      .map((_, i) => i)
      .filter((i) => !emojiValues[i].active.value);

    // If we have enough available emojis, use them
    const count = Math.min(ANIMATION_CONFIG.emojisPerBurst, availableIndices.length);
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      emojisToAnimate.push(availableIndices[randomIndex]);
      availableIndices.splice(randomIndex, 1);
    }

    // Animate the selected emojis with staggered delay
    emojisToAnimate.forEach((index, i) => {
      const values = emojiValues[index];

      // Reset position
      values.translateX.value = 0;
      values.translateY.value = 0;
      values.scale.value = 0;
      values.opacity.value = 0;
      values.active.value = false;

      // Staggered animation start
      const delay = i * ANIMATION_CONFIG.emojiSpacing;
      animateEmoji(values, delay, index);
    });

    // Schedule the end of burst phase
    setTimeout(() => {
      inBurstPhase.value = false;
    }, ANIMATION_CONFIG.burstDuration);
  };

  // Initial animation
  const startAnimationForAll = () => {
    // Animate the text appearing quickly
    textOpacity.value = withTiming(1, { duration: 400 });

    // Initial scale animation - dramatic entrance
    textScale.value = withSequence(
      withTiming(1.2, {
        duration: 300,
        easing: Easing.out(Easing.back(2.5)),
      }),
      withTiming(0.9, {
        duration: 150,
        easing: Easing.in(Easing.quad),
      }),
      withTiming(1.08, {
        duration: 120,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0.96, {
        duration: 100,
        easing: Easing.in(Easing.quad),
      }),
      withTiming(1, {
        duration: 80,
        easing: Easing.inOut(Easing.quad),
      })
    );

    // Initial burst after text animation completes
    setTimeout(() => {
      emitEmojiBurst();
    }, 600);
  };

  // Start the animation
  useEffect(() => {
    // Start the animation sequence
    startAnimationForAll();

    // Set up animation loop if enabled
    if (LOOP_ANIMATION) {
      // Set up the rhythmic pattern with bursts and gaps
      const intervalId = setInterval(() => {
        // Toggle between burst and gap phases
        if (!inBurstPhase.value) {
          emitEmojiBurst();

          // Schedule next gap after burst duration
          setTimeout(() => {
            inBurstPhase.value = false;
          }, ANIMATION_CONFIG.burstDuration);
        }
      }, ANIMATION_CONFIG.burstDuration + ANIMATION_CONFIG.gapDuration);

      return () => {
        clearInterval(intervalId);
      };
    }

    // Return cleanup function
    return () => {
      // Stop any animations in progress if component unmounts
    };
  }, []);

  // Animated style for the text
  const textStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [{ scale: textScale.value * textPulse.value }],
    };
  });

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

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.text, textStyle]}>MapMoji</Animated.Text>
      {renderEmojis()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: width,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
  },
  text: {
    fontSize: 42,
    fontFamily: "SpaceMono",
    letterSpacing: 1,
    color: "#fff",
    zIndex: 10,
    textAlign: "center",
    textShadowColor: "rgba(77, 171, 247, 0.6)", // Enhanced glow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    fontWeight: "bold", // Make text bolder
  },
  emojiContainer: {
    position: "absolute",
    backgroundColor: "#333333", // Charcoal color
    borderRadius: 30, // Make containers circular
    padding: 8,
    width: 36, // Fixed width for circle
    height: 36, // Fixed height for circle
    zIndex: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(77, 171, 247, 0.3)",
  },
  emoji: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
  },
});

export default MapMojiHeader;
