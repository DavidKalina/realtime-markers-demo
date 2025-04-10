import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    cancelAnimation,
} from 'react-native-reanimated';
import { Wifi } from 'lucide-react-native';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';

const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const QUALITY_COLORS = {
    offline: {
        text: 'Offline',
        color: '#9CA3AF',
        bgColor: 'rgba(156, 163, 175, 0.2)'
    },
    excellent: {
        text: 'Excellent',
        color: '#22C55E',
        bgColor: 'rgba(34, 197, 94, 0.2)'
    },
    good: {
        text: 'Good',
        color: '#4ADE80',
        bgColor: 'rgba(74, 222, 128, 0.2)'
    },
    fair: {
        text: 'Fair',
        color: '#FACC15',
        bgColor: 'rgba(250, 204, 21, 0.2)'
    },
    poor: {
        text: 'Poor',
        color: '#F87171',
        bgColor: 'rgba(248, 113, 113, 0.2)'
    },
    veryPoor: {
        text: 'Very Poor',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.2)'
    }
};

const ConnectionIndicator: React.FC = () => {
    const networkState = useNetworkQuality();
    const scale = useSharedValue(1);
    const currentText = useSharedValue('Offline');
    const currentColor = useSharedValue('#9CA3AF');
    const currentBgColor = useSharedValue('rgba(156, 163, 175, 0.2)');

    const getQualityInfo = useMemo(() => {
        return () => {
            if (!networkState.isConnected) {
                return QUALITY_COLORS.offline;
            }
            const strength = networkState.strength;
            if (strength >= 80) return QUALITY_COLORS.excellent;
            if (strength >= 60) return QUALITY_COLORS.good;
            if (strength >= 40) return QUALITY_COLORS.fair;
            if (strength >= 20) return QUALITY_COLORS.poor;
            return QUALITY_COLORS.veryPoor;
        };
    }, [networkState.isConnected, networkState.strength]);

    useEffect(() => {
        const newState = getQualityInfo();
        currentText.value = newState.text;
        currentColor.value = newState.color;
        currentBgColor.value = newState.bgColor;
    }, [getQualityInfo]);

    const handlePress = useMemo(() => () => {
        // Cancel any ongoing animation before starting a new one
        cancelAnimation(scale);
        scale.value = withSpring(0.95, ANIMATION_CONFIG);
    }, []);

    // Cleanup animations on unmount
    useEffect(() => {
        return () => {
            cancelAnimation(scale);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const indicatorStyle = useAnimatedStyle(() => ({
        backgroundColor: currentBgColor.value
    }));

    const textStyle = useAnimatedStyle(() => ({
        color: currentColor.value
    }));

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <Animated.View style={[styles.indicator, indicatorStyle]}>
                <Wifi size={10} color={currentColor.value} />
            </Animated.View>
            <Animated.Text style={[styles.text, textStyle]}>
                {currentText.value}
            </Animated.Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    indicator: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 11,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        letterSpacing: 0.2,
    },
});

export default React.memo(ConnectionIndicator); 