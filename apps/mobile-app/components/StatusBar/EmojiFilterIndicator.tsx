import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface EmojiFilterIndicatorProps {
    emoji?: string;
    onPress?: () => void;
}

export const EmojiFilterIndicator: React.FC<EmojiFilterIndicatorProps> = ({
    emoji = '🎉',
    onPress
}) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.9),
            withSpring(1)
        );
        opacity.value = withSequence(
            withTiming(0.7, { duration: 100 }),
            withTiming(1, { duration: 100 })
        );
        onPress?.();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    return (
        <Pressable onPress={handlePress}>
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.iconContainer}>
                    <Text style={styles.emoji}>{emoji}</Text>
                </View>
                <Text style={styles.text}>Filter</Text>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 14,
        lineHeight: 14,
    },
    text: {
        fontSize: 12,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        lineHeight: 16,
        color: "#EC4899",
        letterSpacing: 0.2,
    },
}); 