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
        // Get the currently active filter (if any)
        const activeFilter = filters.find(f => activeFilterIds.includes(f.id));

        if (activeFilter) {
            // If we have an active filter, update its criteria
            if (startDate === null && endDate === null) {
                // First remove date range from criteria while preserving other criteria
                const { dateRange, ...restCriteria } = activeFilter.criteria;
                const updatedFilter = {
                    ...activeFilter,
                    criteria: restCriteria
                };
                // Update the filter first
                updateFilter(activeFilter.id, updatedFilter).then(() => {
                    // Then clear all active filters
                    clearFilters();
                });
            } else if (startDate && endDate) {
                // Update the filter with the new date range while preserving other criteria
                const updatedFilter = {
                    ...activeFilter,
                    criteria: {
                        ...activeFilter.criteria,
                        dateRange: { start: startDate, end: endDate }
                    }
                };
                updateFilter(activeFilter.id, updatedFilter);
            }
        } else if (startDate && endDate) {
            // Always check for existing date-only filters before creating a new one
            const existingDateOnlyFilter = filters.find(filter => {
                // Check if this is a date-only filter or has empty criteria
                const isDateOnly =
                    (filter.criteria.dateRange && // Has date range
                        !filter.criteria.location && // No location
                        !filter.semanticQuery && // No semantic query
                        Object.keys(filter.criteria).length === 1) || // Only has date range criteria
                    Object.keys(filter.criteria).length === 0; // Or has empty criteria

                console.log('Checking filter:', {
                    id: filter.id,
                    name: filter.name,
                    criteria: filter.criteria,
                    isDateOnly
                });

                return isDateOnly;
            });

            console.log('Found existing date-only filter:', existingDateOnlyFilter);

            if (existingDateOnlyFilter) {
                // Update the existing date-only filter
                const updatedFilter = {
                    ...existingDateOnlyFilter,
                    name: `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d')}`,
                    criteria: {
                        dateRange: { start: startDate, end: endDate }
                    }
                };
                console.log('Updating existing filter:', updatedFilter);
                updateFilter(existingDateOnlyFilter.id, updatedFilter).then(() => {
                    // Apply the updated filter
                    applyFilters([existingDateOnlyFilter.id]);
                });
            } else {
                console.log('No existing date-only filter found, creating new one');
                // Create a new filter if no existing date-only filter found
                const name = `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d')}`;
                const newFilter = {
                    name,
                    criteria: {
                        dateRange: { start: startDate, end: endDate }
                    }
                };
                createFilter(newFilter).then((createdFilter) => {
                    applyFilters([createdFilter.id]);
                });
            }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowCalendar(false);
    }, [filters, activeFilterIds, updateFilter, createFilter, applyFilters, clearFilters]);

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