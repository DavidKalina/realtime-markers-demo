import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Modal } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import { Calendar } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useFilterStore } from "@/stores/useFilterStore";
import { format, parseISO } from "date-fns";
import DateRangeCalendar from "@/components/DateRangeCalendar";

const ANIMATION_CONFIG = {
    damping: 10,
    stiffness: 200,
};

const ROTATION_CONFIG = {
    duration: 100,
    easing: Easing.inOut(Easing.ease),
};

const DateRangeIndicator: React.FC = () => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const { filters, activeFilterIds, updateFilter, applyFilters, createFilter, isLoading } = useFilterStore();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Sync date range on mount
    useEffect(() => {
        if (activeFilterIds.length === 0 && filters.length > 0) {
            applyFilters([filters[0].id]);
        }
    }, []);

    // Reset local loading state when modal closes
    useEffect(() => {
        if (!showCalendar) {
            setIsLocalLoading(false);
        }
    }, [showCalendar]);

    // Get active filters with date ranges
    const activeDateFilters = useMemo(() => {
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
    const dateRangeText = useMemo(() => {
        if (filters.length === 0 || activeFilterIds.length === 0) {
            return "Set Range";
        }

        const activeFilter = filters.find(f => activeFilterIds.includes(f.id));
        if (!activeFilter?.criteria?.dateRange) {
            return "Set Range";
        }

        const { start, end } = activeFilter.criteria.dateRange;
        if (!start || !end) {
            return "Set Range";
        }

        return `${format(parseISO(start), "M/d")} – ${format(parseISO(end), "M/d")}`;
    }, [filters, activeFilterIds]);

    const handlePress = useCallback(() => {
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
        setShowCalendar(true);
    }, []);

    const handleDateRangeSelect = useCallback(async (startDate: string | null, endDate: string | null) => {
        if (!startDate || !endDate) return;

        setIsLocalLoading(true);
        let targetFilter = filters.find(f => activeFilterIds.includes(f.id));

        try {
            if (!targetFilter) {
                targetFilter = await createFilter({
                    name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
                    criteria: {
                        dateRange: { start: startDate, end: endDate }
                    },
                });
            } else {
                const updatedFilter = {
                    ...targetFilter,
                    ...(targetFilter.semanticQuery ? {} : {
                        name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
                    }),
                    criteria: {
                        ...targetFilter.criteria,
                        dateRange: { start: startDate, end: endDate },
                    },
                };
                await updateFilter(targetFilter.id, updatedFilter);
                await applyFilters([targetFilter.id]);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Error updating date range:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsLocalLoading(false);
            setShowCalendar(false);
        }
    }, [filters, activeFilterIds, createFilter, updateFilter, applyFilters]);

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
        <>
            <Pressable onPress={handlePress}>
                <Animated.View style={[styles.container, animatedStyle]}>
                    <View style={styles.iconContainer}>
                        <Calendar size={12} color="#60A5FA" />
                    </View>
                    <Text style={styles.text}>{dateRangeText}</Text>
                </Animated.View>
            </Pressable>

            <Modal
                visible={showCalendar}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.modalOverlay}>
                    <DateRangeCalendar
                        startDate={filters.find(f => activeFilterIds.includes(f.id))?.criteria.dateRange?.start}
                        endDate={filters.find(f => activeFilterIds.includes(f.id))?.criteria.dateRange?.end}
                        onDateRangeSelect={handleDateRangeSelect}
                        onClose={() => setShowCalendar(false)}
                        isLoading={isLocalLoading}
                    />
                </View>
            </Modal>
        </>
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
        letterSpacing: 0.1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default React.memo(DateRangeIndicator); 