import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    Easing,
    runOnJS,
    interpolate,
    withRepeat,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH * 0.8;
const EMOJI_SIZE = 60;

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
    const yOffset = useSharedValue(0);
    const emojiOpacity = useSharedValue(0);
    const emojiScale = useSharedValue(0);
    const emojiRotate = useSharedValue(180);
    const emojiBob = useSharedValue(0);

    // Animated styles
    const imageAnimatedStyle = useAnimatedStyle(() => {
        const scaleValue = interpolate(
            progress.value,
            [0, 0.2, 0.4, 0.7, 1],
            [1, 1.05, 0.9, 0.5, 0.2]
        );

        const rotateYValue = interpolate(
            progress.value,
            [0, 0.2, 0.4, 0.7, 1],
            [0, 10, -10, 5, -5]
        );

        return {
            transform: [
                { translateY: yOffset.value },
                { scale: scaleValue },
                { perspective: 1000 },
                { rotateY: `${rotateYValue}deg` },
            ],
            opacity: interpolate(progress.value, [0.7, 1], [1, 0]),
        };
    });

    const emojiAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: emojiScale.value },
            { rotate: `${emojiRotate.value}deg` },
            { translateY: emojiBob.value },
        ],
        opacity: emojiOpacity.value,
    }));

    useEffect(() => {
        // Start the animation sequence
        const startAnimation = () => {
            // First, lift the image
            yOffset.value = withTiming(-50, {
                duration: 800,
                easing: Easing.out(Easing.cubic),
            });

            // Then start the transformation sequence
            progress.value = withTiming(1, {
                duration: 1500,
                easing: Easing.inOut(Easing.cubic),
            });

            // After image transformation, show the emoji
            setTimeout(() => {
                emojiOpacity.value = withTiming(1, { duration: 300 });
                emojiScale.value = withSpring(1, {
                    damping: 20,
                    stiffness: 260,
                });
                emojiRotate.value = withSpring(0, {
                    damping: 20,
                    stiffness: 260,
                });

                // Start the bobbing animation
                emojiBob.value = withRepeat(
                    withSequence(
                        withTiming(-10, { duration: 1000 }),
                        withTiming(0, { duration: 1000 })
                    ),
                    -1, // Infinite
                    true // Reverse
                );

                // Call the completion callback after the full animation
                setTimeout(() => {
                    runOnJS(onAnimationComplete)();
                }, 1000);
            }, 1500);
        };

        startAnimation();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
                <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="cover"
                />
            </Animated.View>

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
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'absolute',
        backfaceVisibility: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    emojiContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: EMOJI_SIZE,
    },
}); 