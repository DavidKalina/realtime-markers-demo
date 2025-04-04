import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Modal } from 'react-native';
import Animated, { BounceIn, LinearTransition } from 'react-native-reanimated';
import { Calendar } from 'lucide-react-native';
import { useFilterStore } from '@/stores/useFilterStore';
import * as Haptics from 'expo-haptics';
import DateRangeCalendar from './DateRangeCalendar';
import { format, parseISO } from 'date-fns';

const CalendarIndicator: React.FC = () => {
    const { filters, activeFilterIds, updateFilter, createFilter, applyFilters, clearFilters } = useFilterStore();
    const [showCalendar, setShowCalendar] = useState(false);

    // Get active filters with date ranges
    const activeDateFilters = useMemo(() => {
        // First get all active filters based on activeFilterIds
        const activeFilters = filters.filter(f => activeFilterIds.includes(f.id));
        // Then filter for those with date ranges
        return activeFilters.filter(f => f.criteria?.dateRange);
    }, [filters, activeFilterIds]);

    // Format date range for display
    const dateRangeText = useMemo(() => {
        if (activeDateFilters.length === 0) return null;

        const filter = activeDateFilters[0]; // Take the first active filter with date range
        const { start, end } = filter.criteria.dateRange || {};

        if (!start && !end) return null;

        if (start && end) {
            return `${format(parseISO(start), 'MMM d')} - ${format(parseISO(end), 'MMM d')}`;
        }

        if (start) {
            return `From ${format(parseISO(start), 'MMM d')}`;
        }
        if (end) {
            return `Until ${format(parseISO(end), 'MMM d')}`;
        }
        return null;
    }, [activeDateFilters]);

    const handlePress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowCalendar(true);
    }, []);

    const handleDateRangeSelect = useCallback((startDate: string | null, endDate: string | null) => {
        if (activeDateFilters.length > 0) {
            const filter = activeDateFilters[0];
            const isDateExclusive = Object.keys(filter.criteria).length === 1 && filter.criteria.dateRange;

            // Handle reset case (both dates are null)
            if (startDate === null && endDate === null) {
                if (isDateExclusive) {
                    // If it's a date-exclusive filter, just clear all filters
                    clearFilters();
                } else {
                    // If it's not date-exclusive, just remove the date range criteria
                    const { dateRange, ...restCriteria } = filter.criteria;
                    updateFilter(filter.id, {
                        criteria: restCriteria
                    });
                }
            } else if (startDate && endDate) {
                // Update the filter with the new date range while preserving other criteria
                const updatedCriteria = { ...filter.criteria };
                if (Object.keys(updatedCriteria.dateRange || {}).length === 0) {
                    // If dateRange is empty, remove it before adding the new one
                    delete updatedCriteria.dateRange;
                }
                updateFilter(filter.id, {
                    criteria: {
                        ...updatedCriteria,
                        dateRange: { start: startDate, end: endDate }
                    }
                });
            }
        } else if (startDate && endDate) {
            // Format the date range for the name
            const name = `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d')}`;

            // Create a new filter with ONLY date range criteria
            const newFilter = {
                name,
                criteria: {
                    dateRange: { start: startDate, end: endDate }
                }
            };

            // Create the filter and apply it
            createFilter(newFilter).then((createdFilter) => {
                applyFilters([createdFilter.id]);
            });
        } else if (startDate === null && endDate === null && filters.length > 0) {
            // If clearing date range and we have filters, update the first filter
            const filter = filters[0];
            const { dateRange, ...restCriteria } = filter.criteria;
            updateFilter(filter.id, {
                criteria: restCriteria
            });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowCalendar(false);
    }, [activeDateFilters, filters, updateFilter, createFilter, applyFilters, clearFilters]);

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