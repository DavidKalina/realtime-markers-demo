import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressProps {
    progress: number;
    children?: React.ReactNode;
    message?: {
        emoji: string;
        text: string;
    };
}

const CircularProgress: React.FC<CircularProgressProps> = ({ progress, children, message }) => {
    const animatedProgress = useSharedValue(0);
    const previousProgress = useRef(0);
    const [showCompletionEmoji, setShowCompletionEmoji] = useState(false);

    useEffect(() => {
        // If progress is 0 and we had a previous non-zero value, it means the job completed
        if (progress === 0 && previousProgress.current > 0) {
            animatedProgress.value = withTiming(100, {
                duration: 500,
                easing: Easing.linear,
            });
            // After the progress animation completes, show the completion emoji
            setTimeout(() => {
                setShowCompletionEmoji(true);
            }, 500);
        } else {
            animatedProgress.value = withTiming(progress, {
                duration: 500,
                easing: Easing.linear,
            });
            setShowCompletionEmoji(false);
        }
        previousProgress.current = progress;
    }, [progress]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: animatedProgress.value > 0 ? 1 : 0,
        };
    });

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: 88 - (88 * animatedProgress.value) / 100,
        };
    });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.svgContainer, animatedStyle]}>
                <Svg width="24" height="24" viewBox="0 0 24 24">
                    <Circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="rgba(156, 163, 175, 0.2)"
                        strokeWidth="2"
                        fill="none"
                    />
                    <AnimatedCircle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="#9CA3AF"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="88"
                        animatedProps={animatedProps}
                    />
                </Svg>
            </Animated.View>
            <View style={styles.contentContainer}>
                {showCompletionEmoji && message?.emoji ? (
                    <Animated.Text
                        entering={FadeIn
                            .duration(300)
                            .springify()
                            .damping(15)
                            .stiffness(200)}
                        exiting={FadeOut.duration(300)}
                        style={styles.emojiText}
                    >
                        {message.emoji}
                    </Animated.Text>
                ) : (
                    children
                )}
            </View>
        </View>
    );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
    container: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    svgContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    emojiText: {
        fontSize: 10,
        color: '#FFFFFF',
    },
});

export default CircularProgress;