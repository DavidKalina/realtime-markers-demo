import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    withRepeat,
} from 'react-native-reanimated';

// For debugging timings
const DEBUG = false;

// Using full available space instead of fixed dimensions
const EMOJI_SIZE = 60;

// Particle system for the "poof" effect
const PARTICLE_COUNT = 20;

interface ImagePoofIntoEmojiTransformationProps {
    imageUri: string;
    onAnimationComplete: () => void;
}

export const ImagePoofIntoEmojiTransformation: React.FC<ImagePoofIntoEmojiTransformationProps> = ({
    imageUri,
    onAnimationComplete,
}) => {
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
    const particles = Array(PARTICLE_COUNT).fill(0).map(() => ({
        opacity: useSharedValue(0),
        translateX: useSharedValue(0),
        translateY: useSharedValue(0),
        scale: useSharedValue(0),
        rotate: useSharedValue(0),
    }));

    // Image animated style with enhanced effects
    const imageAnimatedStyle = useAnimatedStyle(() => {
        // Add wobble effect for the "resistance" phase
        const rotateZ = interpolate(
            wobble.value,
            [0, 1],
            [0, struggle.value]
        );

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
        transform: [
            { scale: poofScale.value },
        ],
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
    const particleStyles = particles.map((particle, index) =>
        useAnimatedStyle(() => ({
            position: 'absolute',
            opacity: particle.opacity.value,
            transform: [
                { translateX: particle.translateX.value },
                { translateY: particle.translateY.value },
                { scale: particle.scale.value },
                { rotate: `${particle.rotate.value}deg` },
            ],
        }))
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

            // Start gentle bobbing animation immediately
            yOffset.value = withRepeat(
                withSequence(
                    withTiming(-35, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
                    withTiming(-25, { duration: 1500, easing: Easing.inOut(Easing.sin) })
                ),
                -1, // Infinite
                true // Reverse
            );

            // Add subtle rotation during bobbing
            wobble.value = withRepeat(
                withSequence(
                    withTiming(2, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
                    withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
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
                    withTiming(0, { duration: 400 })
                );

                poofScale.value = withTiming(1.8, {
                    duration: 500,
                    easing: Easing.out(Easing.cubic),
                });

                // Animate particles
                particles.forEach((particle, i) => {
                    // Random direction for each particle
                    const angle = (Math.PI * 2) * (i / PARTICLE_COUNT);
                    const distance = 70 + Math.random() * 50;

                    particle.opacity.value = withSequence(
                        withTiming(1, { duration: 100 }),
                        withTiming(0, { duration: 500 })
                    );

                    particle.translateX.value = withTiming(
                        Math.cos(angle) * distance,
                        { duration: 600, easing: Easing.out(Easing.cubic) }
                    );

                    particle.translateY.value = withTiming(
                        Math.sin(angle) * distance,
                        { duration: 600, easing: Easing.out(Easing.cubic) }
                    );

                    particle.scale.value = withSequence(
                        withTiming(0.5 + Math.random() * 0.5, { duration: 100 }),
                        withTiming(0, { duration: 500 })
                    );

                    particle.rotate.value = withTiming(
                        Math.random() * 360,
                        { duration: 600 }
                    );
                });

                // Show emoji with a slight delay
                setTimeout(() => {
                    emojiOpacity.value = withTiming(1, { duration: 400 });
                    emojiScale.value = withSpring(1, {
                        damping: 10,  // Less damping for more bounce
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
                                withTiming(-10, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                                withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) })
                            ),
                            -1, // Infinite
                            true // Reverse
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
                <Animated.View key={`particle-${index}`} style={[styles.particle, style]}>
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
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'absolute',
        backfaceVisibility: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    poofContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    poofEmoji: {
        fontSize: 80,
    },
    emojiContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: EMOJI_SIZE,
    },
    particle: {
        position: 'absolute',
    },
    particleEmoji: {
        fontSize: 20,
    },
});