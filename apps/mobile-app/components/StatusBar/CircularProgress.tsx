import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedProps,
    withTiming,
    useSharedValue,
    Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircularProgress = ({ progress }: { progress: number }) => {
    const progressValue = useSharedValue(0);
    const CIRCLE_LENGTH = 2 * Math.PI * 9; // 2πr where radius is 9 (slightly smaller than container)
    const BACKGROUND_CIRCLE_LENGTH = 2 * Math.PI * 9;

    useEffect(() => {
        console.log('CircularProgress: Updating progress to', progress);
        progressValue.value = withTiming(progress / 100, {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
        });
    }, [progress]);

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: CIRCLE_LENGTH * (1 - progressValue.value),
        };
    });

    return (
        <View style={styles.progressContainer}>
            <Svg width={24} height={24}>
                {/* Background Circle */}
                <Circle
                    cx={12}
                    cy={12}
                    r={9}
                    stroke="rgba(255, 107, 0, 0.2)"
                    strokeWidth={2}
                    fill="transparent"
                />
                {/* Progress Circle */}
                <AnimatedCircle
                    cx={12}
                    cy={12}
                    r={9}
                    stroke="#FF6B00"
                    strokeWidth={2}
                    fill="transparent"
                    strokeDasharray={CIRCLE_LENGTH}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    // Start from the top (12 o'clock position)
                    rotation="-90"
                    originX="12"
                    originY="12"
                />
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    progressContainer: {
        position: 'absolute',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CircularProgress;