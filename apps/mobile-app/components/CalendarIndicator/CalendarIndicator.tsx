import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Modal } from 'react-native';
import Animated, { BounceIn, LinearTransition } from 'react-native-reanimated';
import { Calendar } from 'lucide-react-native';
import { useFilterStore } from '@/stores/useFilterStore';
import * as Haptics from 'expo-haptics';
import DateRangeCalendar from '../DateRangeCalendar';

const CalendarIndicator: React.FC = () => {
    const { filters, updateFilter } = useFilterStore();
    const [showCalendar, setShowCalendar] = useState(false);

    // Get active filters with date ranges
    const activeDateFilters = useMemo(() => {
        return filters.filter(f => f.isActive && f.criteria?.dateRange);
    }, [filters]);

    // Format date range for display
    const dateRangeText = useMemo(() => {
        if (activeDateFilters.length === 0) return null;

        const filter = activeDateFilters[0]; // Take the first active filter with date range
        const { start, end } = filter.criteria.dateRange || {};

        if (!start && !end) return null;

        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;

        if (startDate && endDate) {
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) return "1d";
            if (diffDays < 7) return `${diffDays}d`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
            return `${Math.floor(diffDays / 30)}m`;
        }

        return start ? "From" : "Until";
    }, [activeDateFilters]);

    const handlePress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowCalendar(true);
    }, []);

    const handleDateRangeSelect = useCallback((startDate: string, endDate: string) => {
        if (activeDateFilters.length > 0) {
            const filter = activeDateFilters[0];
            updateFilter(filter.id, {
                ...filter,
                criteria: {
                    ...filter.criteria,
                    dateRange: { start: startDate, end: endDate }
                }
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowCalendar(false);
    }, [activeDateFilters, updateFilter]);

    return (
        <>
            <Animated.View
                entering={BounceIn}
                layout={LinearTransition.springify()}
            >
                <Pressable onPress={handlePress} style={styles.pressable}>
                    <View style={[
                        styles.indicator,
                        activeDateFilters.length > 0 && styles.indicatorActive
                    ]}>
                        <View style={[
                            styles.iconContainer,
                            activeDateFilters.length > 0 && styles.iconContainerActive
                        ]}>
                            <Calendar size={14} color={activeDateFilters.length > 0 ? "#93c5fd" : "#f8f9fa"} />
                        </View>

                        {dateRangeText && (
                            <View style={styles.textContainer}>
                                <Text style={styles.dateText}>{dateRangeText}</Text>
                            </View>
                        )}
                    </View>
                </Pressable>
            </Animated.View>

            <Modal
                visible={showCalendar}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.modalOverlay}>
                    <DateRangeCalendar
                        startDate={activeDateFilters[0]?.criteria.dateRange?.start}
                        endDate={activeDateFilters[0]?.criteria.dateRange?.end}
                        onDateRangeSelect={handleDateRangeSelect}
                        onClose={() => setShowCalendar(false)}
                    />
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    pressable: {
        width: 'auto',
    },
    indicator: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(51, 51, 51, 0.92)",
        borderRadius: 16,
        padding: 8,
        height: 40,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    indicatorActive: {
        backgroundColor: "rgba(51, 51, 51, 0.95)",
        borderColor: "rgba(147, 197, 253, 0.3)",
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    iconContainerActive: {
        backgroundColor: "rgba(147, 197, 253, 0.15)",
    },
    textContainer: {
        marginLeft: 8,
        paddingRight: 4,
    },
    dateText: {
        color: "#93c5fd",
        fontSize: 12,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CalendarIndicator; 