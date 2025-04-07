import { addMonths, eachDayOfInterval, endOfMonth, format, isSameMonth, isToday, parseISO, startOfMonth, subMonths } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Animated, {
    SlideInDown,
    SlideOutDown,
    useSharedValue,
    withTiming,
    runOnJS,
    cancelAnimation
} from 'react-native-reanimated';

interface DateRangeCalendarProps {
    startDate?: string;
    endDate?: string;
    onDateRangeSelect: (startDate: string | null, endDate: string | null) => void;
    onClose: () => void;
    isLoading?: boolean;
}

const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
    startDate,
    endDate,
    onDateRangeSelect,
    onClose,
    isLoading = false,
}) => {
    const [selectedStartDate, setSelectedStartDate] = useState<string | undefined>(startDate);
    const [selectedEndDate, setSelectedEndDate] = useState<string | undefined>(endDate);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const isMounted = useRef(true);
    const slideAnim = useSharedValue(0);
    const containerAnim = useSharedValue(0);

    // Cleanup animations
    const cleanupAnimations = useCallback(() => {
        if (!isMounted.current) return;
        cancelAnimation(slideAnim);
        cancelAnimation(containerAnim);
        slideAnim.value = 0;
        containerAnim.value = 0;
    }, [slideAnim, containerAnim]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
            cleanupAnimations();
        };
    }, [cleanupAnimations]);

    // Handle close with animation cleanup
    const handleClose = useCallback(() => {
        cleanupAnimations();
        onClose();
    }, [onClose, cleanupAnimations]);

    // Check if we can navigate to previous month
    const canGoBack = useMemo(() => {
        const today = new Date();
        const currentMonthStart = startOfMonth(currentMonth);
        return currentMonthStart > startOfMonth(today);
    }, [currentMonth]);

    // Get all days in the current month
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Handle date selection
    const handleDayPress = useCallback((date: Date) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Format the date in UTC to avoid timezone issues
        const dateString = format(date, 'yyyy-MM-dd');

        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            // Start new selection
            setSelectedStartDate(dateString);
            setSelectedEndDate(undefined);
        } else {
            // Complete selection
            const start = parseISO(selectedStartDate);
            const end = parseISO(dateString);

            if (end < start) {
                // If end date is before start date, swap them
                setSelectedEndDate(selectedStartDate);
                setSelectedStartDate(dateString);
            } else {
                setSelectedEndDate(dateString);
            }
        }
    }, [selectedStartDate, selectedEndDate]);

    // Handle month navigation
    const handlePrevMonth = useCallback(() => {
        if (canGoBack) {
            setCurrentMonth(prev => subMonths(prev, 1));
        }
    }, [canGoBack]);

    const handleNextMonth = useCallback(() => {
        setCurrentMonth(prev => addMonths(prev, 1));
    }, []);

    // Handle date range selection
    const handleConfirmSelection = useCallback(() => {
        if (selectedStartDate && selectedEndDate) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDateRangeSelect(selectedStartDate, selectedEndDate);
            onClose();
        }
    }, [selectedStartDate, selectedEndDate, onDateRangeSelect, onClose]);

    // Format date range text
    const dateRangeText = useMemo(() => {
        if (!selectedStartDate || !selectedEndDate) return '';

        const start = parseISO(selectedStartDate);
        const end = parseISO(selectedEndDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '1 day';
        if (diffDays === 1) return '1 day';
        if (diffDays < 7) return `${diffDays} days`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
        return `${Math.floor(diffDays / 30)} months`;
    }, [selectedStartDate, selectedEndDate]);

    // Get day styles based on selection state
    const getDayStyles = useCallback((date: Date) => {
        const dateString = format(date, 'yyyy-MM-dd');
        const isSelected = dateString === selectedStartDate || dateString === selectedEndDate;
        const isInRange = selectedStartDate && selectedEndDate &&
            date > parseISO(selectedStartDate) && date < parseISO(selectedEndDate);
        const isStart = dateString === selectedStartDate;
        const isEnd = dateString === selectedEndDate;

        return {
            container: [
                styles.dayContainer,
                isSelected && styles.selectedDay,
                isInRange && styles.rangeDay,
                isStart && styles.startDay,
                isEnd && styles.endDay,
            ],
            text: [
                styles.dayText,
                isSelected && styles.selectedDayText,
                !isSameMonth(date, currentMonth) && styles.otherMonthDay,
                isToday(date) && styles.todayText,
            ],
        };
    }, [selectedStartDate, selectedEndDate, currentMonth]);

    return (
        <Animated.View
            style={styles.container}
            entering={SlideInDown.springify().damping(15).stiffness(100)}
            exiting={SlideOutDown.springify().damping(15).stiffness(100).withCallback((finished) => {
                if (finished) {
                    runOnJS(cleanupAnimations)();
                }
            })}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <X size={20} color="#f8f9fa" />
                </TouchableOpacity>
                <Text style={styles.title}>Calendar</Text>
            </View>

            <View style={styles.calendarContainer}>
                <View style={styles.monthHeader}>
                    <TouchableOpacity
                        onPress={handlePrevMonth}
                        style={[
                            styles.monthNavButton,
                            !canGoBack && styles.monthNavButtonDisabled
                        ]}
                        disabled={!canGoBack}
                        activeOpacity={canGoBack ? 0.7 : 1}
                    >
                        <ChevronLeft
                            size={20}
                            color={canGoBack ? "#93c5fd" : "#666666"}
                        />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {format(currentMonth, 'MMMM yyyy')}
                    </Text>
                    <TouchableOpacity
                        onPress={handleNextMonth}
                        style={styles.monthNavButton}
                        activeOpacity={0.7}
                    >
                        <ChevronRight size={20} color="#93c5fd" />
                    </TouchableOpacity>
                </View>

                <View style={styles.weekDays}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <Text key={day} style={styles.weekDayText}>{day}</Text>
                    ))}
                </View>

                <View style={styles.daysGrid}>
                    {daysInMonth.map((date, index) => {
                        const { container, text } = getDayStyles(date);
                        return (
                            <TouchableOpacity
                                key={date.toISOString()}
                                style={container}
                                onPress={() => handleDayPress(date)}
                            >
                                <Text style={text}>{format(date, 'd')}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View style={styles.footer}>
                <Animated.View
                    style={styles.dateRangeInfo}
                >
                    {selectedStartDate && selectedEndDate ? (
                        <>
                            <Text style={styles.dateRangeText}>
                                {format(parseISO(selectedStartDate), 'MMM d')} - {format(parseISO(selectedEndDate), 'MMM d')}
                            </Text>
                            <Text style={styles.dateRangeDuration}>{dateRangeText}</Text>
                        </>
                    ) : (
                        <Text style={styles.placeholderText}>Select a date range</Text>
                    )}
                </Animated.View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.resetButton]}
                        onPress={() => {
                            setSelectedStartDate(undefined);
                            setSelectedEndDate(undefined);
                            onDateRangeSelect(null, null);
                        }}
                        activeOpacity={0.7}
                        disabled={isLoading}
                    >
                        <Text style={styles.resetButtonText}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.confirmButton,
                            (!selectedStartDate || !selectedEndDate) && styles.confirmButtonDisabled,
                            isLoading && styles.confirmButtonLoading,
                        ]}
                        onPress={handleConfirmSelection}
                        disabled={!selectedStartDate || !selectedEndDate || isLoading}
                        activeOpacity={0.7}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#3a3a3a',
        borderRadius: 16,
        overflow: 'hidden',
        width: '90%',
        maxHeight: '75%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: '#f8f9fa',
        fontFamily: 'SpaceMono',
        marginRight: 36,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarContainer: {
        padding: 16,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    monthText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#f8f9fa',
        fontFamily: 'SpaceMono',
    },
    monthNavButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(147, 197, 253, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthNavButtonDisabled: {
        backgroundColor: 'rgba(147, 197, 253, 0.05)',
        opacity: 0.5,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekDayText: {
        width: 40,
        textAlign: 'center',
        fontSize: 12,
        color: '#adb5bd',
        fontFamily: 'SpaceMono',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderRadius: 20,
    },
    dayText: {
        fontSize: 14,
        color: '#f8f9fa',
        fontFamily: 'SpaceMono',
    },
    selectedDay: {
        backgroundColor: '#93c5fd',
    },
    selectedDayText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    rangeDay: {
        backgroundColor: 'rgba(147, 197, 253, 0.2)',
    },
    startDay: {
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    endDay: {
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
    },
    otherMonthDay: {
        color: '#666666',
    },
    todayText: {
        color: '#93c5fd',
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        gap: 16,
    },
    dateRangeInfo: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateRangeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#f8f9fa',
        fontFamily: 'SpaceMono',
        marginBottom: 4,
    },
    dateRangeDuration: {
        fontSize: 14,
        color: '#93c5fd',
        fontFamily: 'SpaceMono',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    button: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    resetButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    resetButtonText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'SpaceMono',
    },
    confirmButton: {
        backgroundColor: '#93c5fd',
    },
    confirmButtonDisabled: {
        backgroundColor: 'rgba(147, 197, 253, 0.2)',
    },
    confirmButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'SpaceMono',
    },
    placeholderText: {
        fontSize: 14,
        color: '#adb5bd',
        fontFamily: 'SpaceMono',
    },
    confirmButtonLoading: {
        opacity: 0.7,
    },
});

export default DateRangeCalendar; 