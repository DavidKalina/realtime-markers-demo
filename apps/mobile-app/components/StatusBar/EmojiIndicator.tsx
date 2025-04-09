import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useFilterStore } from "@/stores/useFilterStore";

const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const ROTATION_CONFIG = {
    duration: 100,
    easing: Easing.inOut(Easing.ease),
};

const EmojiIndicator: React.FC = () => {
    const router = useRouter();
    const { filters, activeFilterIds, applyFilters } = useFilterStore();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Sync emoji on mount
    useEffect(() => {
        if (activeFilterIds.length === 0 && filters.length > 0) {
            applyFilters([filters[0].id]);
        }
    }, []);

    // Get active filters with emoji
    const activeEmojiFilters = useMemo(() => {
        const activeFilters = filters.filter((f) => activeFilterIds.includes(f.id));
        return activeFilters.filter((f) => f?.emoji);
    }, [filters, activeFilterIds]);

    // Get the first emoji from active filters, fallback to target
    const emoji = useMemo(() => {
        if (activeEmojiFilters.length === 0) return '🎯';
        return activeEmojiFilters[0].emoji || '🎯';
    }, [activeEmojiFilters]);

    const handlePress = useMemo(() => () => {
        // Cancel any ongoing animations before starting new ones
        cancelAnimation(scale);
        cancelAnimation(rotation);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
            withSpring(0.95, ANIMATION_CONFIG),
            withSpring(1, ANIMATION_CONFIG)
        );
        rotation.value = withSequence(
            withTiming(-5, ROTATION_CONFIG),
            withTiming(5, ROTATION_CONFIG),
            withTiming(0, ROTATION_CONFIG)
        );
        router.push('/filter');
    }, [router]);

    // Cleanup animations on unmount
    useEffect(() => {
        return () => {
            cancelAnimation(scale);
            cancelAnimation(rotation);
        };
    }, []);

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
                <Text style={styles.text}>Filters</Text>
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
        fontSize: 12,
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#EC4899',
        letterSpacing: 0.2,
    },
});

export default React.memo(EmojiIndicator); 