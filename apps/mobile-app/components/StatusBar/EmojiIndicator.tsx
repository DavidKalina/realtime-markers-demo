import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    Easing
} from 'react-native-reanimated';
import * as Haptics from "expo-haptics";
import { useFilterStore } from "@/stores/useFilterStore";

export const EmojiIndicator: React.FC = () => {
    const { filters, activeFilterIds } = useFilterStore();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Get active filters with emoji
    const activeEmojiFilters = React.useMemo(() => {
        const activeFilters = filters.filter((f) => activeFilterIds.includes(f.id));
        return activeFilters.filter((f) => {
            const hasEmoji = f?.emoji;
            return hasEmoji;
        });
    }, [filters, activeFilterIds]);

    // Get the first emoji from active filters
    const emoji = React.useMemo(() => {
        if (activeEmojiFilters.length === 0) return '🎯';
        return activeEmojiFilters[0].emoji || '🎯';
    }, [activeEmojiFilters]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.95, { damping: 10, stiffness: 200 }),
            withSpring(1, { damping: 10, stiffness: 200 })
        );
        rotation.value = withSequence(
            withTiming(-5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
            withTiming(5, { duration: 100, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) })
        );
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ],
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
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(236, 72, 153, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 10,
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#EC4899',
        letterSpacing: 0.2,
    },
}); 