import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "@/components/Layout/ScreenLayout";

// For debugging timings

// Using full available space instead of fixed dimensions
const EMOJI_SIZE = 60;

// Particle system for the "poof" effect
const PARTICLE_COUNT = 20;

interface ImagePoofIntoEmojiTransformationProps {
  imageUri: string;
  onAnimationComplete: () => void;
}

export const ImagePoofIntoEmojiTransformation: React.FC<
  ImagePoofIntoEmojiTransformationProps
> = ({ imageUri, onAnimationComplete }) => {
  // Animation values
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const yOffset = useSharedValue(0);
  const wobble = useSharedValue(0);
  const struggle = useSharedValue(0);
  const poofScale = useSharedValue(0);
  const poofOpacity = useSharedValue(0);

  // Emoji animation values
  const emojiOpacity = useSharedValue(0);
  const emojiScale = useSharedValue(0);
  const emojiRotate = useSharedValue(180);
  const emojiBob = useSharedValue(0);

  // Create shared values for particles
  const particles = Array(PARTICLE_COUNT)
    .fill(0)
    .map(() => ({
      opacity: useSharedValue(0),
      translateX: useSharedValue(0),
      translateY: useSharedValue(0),
      scale: useSharedValue(0),
      rotate: useSharedValue(0),
    }));

  // Image animated style with enhanced effects
  const imageAnimatedStyle = useAnimatedStyle(() => {
    // Add wobble effect for the "resistance" phase
    const rotateZ = interpolate(wobble.value, [0, 1], [0, struggle.value]);

    return {
      transform: [
        { translateY: yOffset.value },
        { scale: scale.value },
        { rotate: `${rotateZ}deg` },
      ],
      opacity: interpolate(progress.value, [0.8, 1], [1, 0]),
    };
  });

  // Poof effect style
  const poofAnimatedStyle = useAnimatedStyle(() => ({
    opacity: poofOpacity.value,
    transform: [{ scale: poofScale.value }],
  }));

  // Emoji animated style
  const emojiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: emojiScale.value },
      { rotate: `${emojiRotate.value}deg` },
      { translateY: emojiBob.value },
    ],
    opacity: emojiOpacity.value,
  }));

  // Generate particle styles
  const particleStyles = particles.map((particle) =>
    useAnimatedStyle(() => ({
      position: "absolute",
      opacity: particle.opacity.value,
      transform: [
        { translateX: particle.translateX.value },
        { translateY: particle.translateY.value },
        { scale: particle.scale.value },
        { rotate: `${particle.rotate.value}deg` },
      ],
    })),
  );

  useEffect(() => {
    // Start the animation sequence
    const startAnimation = () => {
      // First phase: Lift and start scaling down
      yOffset.value = withTiming(-30, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });

      // Scale down smoothly to 70% of original size
      scale.value = withTiming(0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.cubic),
      });

      // Start gentle bobbing animation immediately with slightly larger range
      yOffset.value = withRepeat(
        withSequence(
          withTiming(-40, { duration: 1500, easing: Easing.inOut(Easing.sin) }), // Increased range
          withTiming(-20, { duration: 1500, easing: Easing.inOut(Easing.sin) }), // Increased range
        ),
        -1,
        true,
      );

      // Add subtle rotation during bobbing with slightly larger range
      wobble.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 1500, easing: Easing.inOut(Easing.sin) }), // Increased range
          withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.sin) }), // Increased range
        ),
        -1,
        true,
      );

      // Schedule the poof transformation after the initial animations
      setTimeout(() => {
        poofPhase();
      }, 3000);

      // Third phase: Poof and transform
      const poofPhase = () => {
        // Stop the bobbing animation
        yOffset.value = withTiming(-30, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });

        wobble.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });

        // Final transformation - rapidly scale down and fade out
        progress.value = withTiming(1, {
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
        });

        scale.value = withTiming(0.1, {
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
        });

        // Poof effect
        poofOpacity.value = withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(0, { duration: 400 }),
        );

        poofScale.value = withTiming(1.8, {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        });

        // Animate particles with more dramatic movement
        particles.forEach((particle, i) => {
          const angle = Math.PI * 2 * (i / PARTICLE_COUNT);
          const distance = 80 + Math.random() * 70; // Increased distance range

          particle.opacity.value = withSequence(
            withTiming(1, { duration: 150 }), // Slightly longer fade in
            withTiming(0, { duration: 600 }), // Longer fade out
          );

          particle.translateX.value = withTiming(Math.cos(angle) * distance, {
            duration: 800, // Longer duration
            easing: Easing.out(Easing.cubic),
          });

          particle.translateY.value = withTiming(Math.sin(angle) * distance, {
            duration: 800, // Longer duration
            easing: Easing.out(Easing.cubic),
          });

          particle.scale.value = withSequence(
            withTiming(0.6 + Math.random() * 0.6, { duration: 150 }), // Larger scale range
            withTiming(0, { duration: 600 }),
          );

          particle.rotate.value = withTiming(Math.random() * 720, {
            // More rotation
            duration: 800,
          });
        });

        // Show emoji with a slight delay
        setTimeout(() => {
          emojiOpacity.value = withTiming(1, { duration: 400 });
          emojiScale.value = withSpring(1, {
            damping: 10, // Less damping for more bounce
            stiffness: 180,
          });
          emojiRotate.value = withSpring(0, {
            damping: 12,
            stiffness: 180,
          });

          // Start the bobbing animation after everything is done
          setTimeout(() => {
            emojiBob.value = withRepeat(
              withSequence(
                withTiming(-10, {
                  duration: 1000,
                  easing: Easing.inOut(Easing.sin),
                }),
                withTiming(0, {
                  duration: 1000,
                  easing: Easing.inOut(Easing.sin),
                }),
              ),
              -1, // Infinite
              true, // Reverse
            );

            // Call the completion callback
            runOnJS(onAnimationComplete)();
          }, 800);
        }, 300);
      };
    };

    startAnimation();
  }, []);

  return (
    <View style={styles.container}>
      {/* Particle effects */}
      {particleStyles.map((style, index) => (
        <Animated.View
          key={`particle-${index}`}
          style={[styles.particle, style]}
        >
          <Text style={styles.particleEmoji}>✨</Text>
        </Animated.View>
      ))}

      {/* Poof cloud effect */}
      <Animated.View style={[styles.poofContainer, poofAnimatedStyle]}>
        <Text style={styles.poofEmoji}>💨</Text>
      </Animated.View>

      {/* Main image that transforms */}
      <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Final emoji */}
      <Animated.View style={[styles.emojiContainer, emojiAnimatedStyle]}>
        <Text style={styles.emoji}>🖼️</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    position: "absolute",
    backfaceVisibility: "hidden",
    justifyContent: "center",
    alignItems: "center",
    // Add a subtle shadow to make the image pop
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    // Add a subtle border
    borderWidth: 1,
    borderColor: `${COLORS.accent}20`, // 12.5% opacity accent color
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  poofContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    // Add a glow effect to the poof
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  poofEmoji: {
    fontSize: 80,
    // Add a text shadow to make the poof emoji pop
    textShadowColor: `${COLORS.accent}80`, // 50% opacity accent color
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  emojiContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    // Add a subtle glow effect to the final emoji
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  emoji: {
    fontSize: EMOJI_SIZE,
    // Add a text shadow to make the emoji pop
    textShadowColor: `${COLORS.accent}60`, // 37.5% opacity accent color
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  particle: {
    position: "absolute",
    // Add a subtle glow to particles
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  particleEmoji: {
    fontSize: 20,
    // Add a text shadow to make particles pop
    textShadowColor: `${COLORS.accent}80`, // 50% opacity accent color
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
