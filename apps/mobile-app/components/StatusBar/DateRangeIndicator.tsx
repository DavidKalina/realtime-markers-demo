import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Modal } from 'react-native';
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
import DateRangeCalendar from "@/components/DateRangeCalendar";

export const DateRangeIndicator: React.FC = () => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const { filters, activeFilterIds, updateFilter, applyFilters, createFilter, isLoading } = useFilterStore();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Sync date range on mount
    useEffect(() => {
        // If there are no active filters but we have filters, activate the first one
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
        // If there are no filters at all, show "Set Range"
        if (filters.length === 0) {
            return "Set Range";
        }

        // If there are no active filters, show "Set Range"
        if (activeFilterIds.length === 0) {
            return "Set Range";
        }

        // Get the active filter with a date range
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
        setShowCalendar(true);
    };

    const handleDateRangeSelect = async (startDate: string | null, endDate: string | null) => {
        setIsLocalLoading(true);

        // If no dates are provided, default to 2 weeks from today
        if (!startDate || !endDate) {
            const today = new Date();
            const twoWeeksFromNow = addDays(today, 14);
            startDate = format(today, 'yyyy-MM-dd');
            endDate = format(twoWeeksFromNow, 'yyyy-MM-dd');
        }

        // Get either the active filter or fall back to the oldest filter
        let targetFilter =
            filters.find((f) => activeFilterIds.includes(f.id)) ||
            (filters.length > 0
                ? filters.reduce((oldest, current) => {
                    return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
                })
                : null);

        try {
            // If no filter exists, create a new one
            if (!targetFilter) {
                targetFilter = await createFilter({
                    name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
                    criteria: {
                        dateRange: { start: startDate, end: endDate }
                    },
                });
            } else {
                // Update the filter with new date range while preserving other criteria
                const updatedFilter = {
                    ...targetFilter,
                    // Only update the name if there's no semantic query
                    ...(targetFilter.semanticQuery ? {} : {
                        name: `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d")}`,
                    }),
                    criteria: {
                        ...targetFilter.criteria,
                        dateRange: { start: startDate, end: endDate },
                    },
                };
                // First update the filter
                await updateFilter(targetFilter.id, updatedFilter);
                // Then ensure it's the only active filter
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
    };

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
        letterSpacing: 0.2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
}); 