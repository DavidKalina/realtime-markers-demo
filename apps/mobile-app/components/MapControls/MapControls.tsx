import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Calendar, Filter } from 'lucide-react-native';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useFilterStore } from "@/stores/useFilterStore";
import { format, parseISO, addDays } from "date-fns";
import DateRangeCalendar from "@/components/DateRangeCalendar";

export const MapControls: React.FC = () => {
    const router = useRouter();
    const [showCalendar, setShowCalendar] = useState(false);
    const { filters, activeFilterIds, updateFilter, applyFilters, createFilter } = useFilterStore();

    // Create separate scale values for each button
    const filterScale = useSharedValue(1);
    const calendarScale = useSharedValue(1);

    const handlePress = (path: string, scale: Animated.SharedValue<number>) => {
        // Initial press animation
        scale.value = withSequence(
            withTiming(0.85, { duration: 100 }),
            withSpring(1, { damping: 10, stiffness: 200 })
        );

        // Trigger haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setTimeout(() => {
            if (path === '/filter') {
                router.push(path);
            } else {
                setShowCalendar(true);
            }
        }, 100);
    };

    const handleDateRangeSelect = async (startDate: string | null, endDate: string | null) => {
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
        setShowCalendar(false);
    };

    const filterAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: filterScale.value }],
    }));

    const calendarAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: calendarScale.value }],
    }));

    return (
        <>
            <View style={styles.container}>
                <Pressable
                    onPress={() => handlePress('/filter', filterScale)}
                    style={styles.button}
                >
                    <Animated.View style={[styles.iconContainer, filterAnimatedStyle]}>
                        <Filter size={14} color="#FFFFFF" />
                    </Animated.View>
                </Pressable>
                <Pressable
                    onPress={() => handlePress('calendar', calendarScale)}
                    style={styles.button}
                >
                    <Animated.View style={[styles.iconContainer, calendarAnimatedStyle]}>
                        <Calendar size={14} color="#FFFFFF" />
                    </Animated.View>
                </Pressable>
            </View>

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
                    />
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 20,
        top: '50%',
        transform: [{ translateY: -40 }],
        flexDirection: 'column',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#333333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        padding: 8,
    },
    iconContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
}); 