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
import { Calendar } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useFilterStore } from "@/stores/useFilterStore";
import { format, parseISO, addDays } from "date-fns";

export const DateRangeIndicator: React.FC = () => {
    const { filters, activeFilterIds } = useFilterStore();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Get active filters with date ranges
    const activeDateFilters = React.useMemo(() => {
        const activeFilters = filters.filter((f) => activeFilterIds.includes(f.id));
        return activeFilters.filter((f) => {
            const hasDateRange = f.criteria?.dateRange && (
                f.criteria.dateRange.start ||
                f.criteria.dateRange.end
            );
            return hasDateRange;
        });
    }, [filters, activeFilterIds]);

    // Format date range for display
    const dateRangeText = React.useMemo(() => {
        if (activeDateFilters.length === 0) {
            const today = new Date();
            const twoWeeksFromNow = addDays(today, 14);
            return `${format(today, "M/d")} - ${format(twoWeeksFromNow, "M/d")}`;
        }

        const filter = activeDateFilters[0];
        const { start, end } = filter.criteria.dateRange || {};

        if (!start || !end) {
            const today = new Date();
            const twoWeeksFromNow = addDays(today, 14);
            return `${format(today, "M/d")} - ${format(twoWeeksFromNow, "M/d")}`;
        }

        return `${format(parseISO(start), "M/d")} - ${format(parseISO(end), "M/d")}`;
    }, [activeDateFilters]);

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
                    <Calendar size={12} color="#60A5FA" />
                </View>
                <Text style={styles.text}>{dateRangeText}</Text>
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
        backgroundColor: 'rgba(96, 165, 250, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        color: '#60A5FA',
        letterSpacing: 0.2,
    },
}); 