import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import { Wifi } from 'lucide-react-native';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';

export const ConnectionIndicator: React.FC = () => {
    const networkState = useNetworkQuality();
    const scale = useSharedValue(1);
    const currentText = useSharedValue('Offline');
    const currentColor = useSharedValue('#9CA3AF');
    const currentBgColor = useSharedValue('rgba(156, 163, 175, 0.2)');

    // Get network quality description and colors
    const getQualityInfo = () => {
        if (!networkState.isConnected) {
            return {
                text: 'Offline',
                color: '#9CA3AF', // Gray
                bgColor: 'rgba(156, 163, 175, 0.2)'
            };
        }
        const strength = networkState.strength;
        if (strength >= 80) {
            return {
                text: 'Excellent',
                color: '#22C55E', // Bright Green
                bgColor: 'rgba(34, 197, 94, 0.2)'
            };
        }
        if (strength >= 60) {
            return {
                text: 'Good',
                color: '#4ADE80', // Faded Green
                bgColor: 'rgba(74, 222, 128, 0.2)'
            };
        }
        if (strength >= 40) {
            return {
                text: 'Fair',
                color: '#FACC15', // Yellow
                bgColor: 'rgba(250, 204, 21, 0.2)'
            };
        }
        if (strength >= 20) {
            return {
                text: 'Poor',
                color: '#F87171', // Red
                bgColor: 'rgba(248, 113, 113, 0.2)'
            };
        }
        return {
            text: 'Very Poor',
            color: '#EF4444', // Darker Red
            bgColor: 'rgba(239, 68, 68, 0.2)'
        };
    };

    // Update state when network quality changes
    useEffect(() => {
        const newState = getQualityInfo();
        currentText.value = newState.text;
        currentColor.value = newState.color;
        currentBgColor.value = newState.bgColor;
    }, [networkState.isConnected, networkState.strength]);

    const handlePress = () => {
        scale.value = withSpring(0.95, { damping: 10, stiffness: 200 });
    };

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
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        letterSpacing: 0.2,
    },
}); 