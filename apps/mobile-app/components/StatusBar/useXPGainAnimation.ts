import { useState, useCallback } from 'react';
import Animated, {
    useSharedValue,
    withTiming,
    withSequence,
    withDelay,
} from 'react-native-reanimated';

interface UseXPGainAnimationProps {
    onAnimationComplete?: () => void;
}

interface XPGainAnimation {
    xpGainOpacity: Animated.SharedValue<number>;
    xpGainTranslateY: Animated.SharedValue<number>;
    xpGainAmount: number;
    showXPGain: (amount: number) => void;
}

export const useXPGainAnimation = ({ onAnimationComplete }: UseXPGainAnimationProps = {}): XPGainAnimation => {
    const [xpGainAmount, setXpGainAmount] = useState(0);
    const xpGainOpacity = useSharedValue(0);
    const xpGainTranslateY = useSharedValue(0);

    const showXPGain = useCallback((amount: number) => {
        setXpGainAmount(amount);

        // Reset values before starting new animation
        xpGainOpacity.value = 0;
        xpGainTranslateY.value = 0;

        // Start animation sequence
        xpGainOpacity.value = withSequence(
            withTiming(1, { duration: 200 }),
            withDelay(1000, withTiming(0, { duration: 300 }))
        );

        xpGainTranslateY.value = withSequence(
            withTiming(-5, { duration: 200 }),
            withDelay(1000, withTiming(0, { duration: 300 }))
        );

        // Call completion callback after animation
        setTimeout(() => {
            onAnimationComplete?.();
        }, 1500);
    }, [onAnimationComplete]);

    return {
        xpGainOpacity,
        xpGainTranslateY,
        xpGainAmount,
        showXPGain,
    };
}; 