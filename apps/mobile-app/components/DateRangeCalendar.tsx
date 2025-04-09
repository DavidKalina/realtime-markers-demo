import { addMonths, eachDayOfInterval, endOfMonth, format, isSameMonth, isToday, parseISO, startOfMonth, subMonths, addDays } from 'date-fns';
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

// Unified color theme (from EventDetailsHeader)
const COLORS = {
    background: "#2a2a2a",
    cardBackground: "#2C3333",
    textPrimary: "#f8f9fa",
    textSecondary: "#93c5fd", // Blue
    accent: "#93c5fd", // Blue

    divider: "rgba(147, 197, 253, 0.12)",
    buttonBackground: "rgba(147, 197, 253, 0.1)",
    buttonBorder: "rgba(147, 197, 253, 0.15)",

    success: "#40c057",
    successBackground: "rgba(64, 192, 87, 0.12)",
    successBorder: "rgba(64, 192, 87, 0.2)",

    iconUser: "#ff922b", // Orange
    iconEngagement: "#a5d8ff", // Light Blue
    iconVerified: "#69db7c", // Green
    iconDateTime: "#ffd43b", // Yellow
    iconLocation: "#ff8787", // Red
    iconCategories: "#da77f2", // Purple
    iconDefault: "#93c5fd", // Default blue
};

// Helper for dimmed text color
const getDimmedTextColor = (baseColor: string, opacity: number = 0.5) => {
    if (baseColor.startsWith('#') && baseColor.length === 7) {
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `rgba(173, 181, 189, ${opacity})`; // Fallback grey
};

// Helper for RGBA background from hex
const getRgbaBackground = (hexColor: string, opacity: number) => {
    if (hexColor.startsWith('#') && hexColor.length === 7) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `rgba(147, 197, 253, ${opacity})`; // Fallback accent
};

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

    // Initialize with default 2-week range if no dates are provided
    useEffect(() => {
        if (!selectedStartDate || !selectedEndDate) {
            const today = new Date();
            const twoWeeksFromNow = addDays(today, 14);
            setSelectedStartDate(format(today, 'yyyy-MM-dd'));
            setSelectedEndDate(format(twoWeeksFromNow, 'yyyy-MM-dd'));
        }
    }, []);

    // Helper function to check if a date is in the past
    const isPastDate = useCallback((date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    }, []);

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
        if (isPastDate(date)) return;

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
    }, [selectedStartDate, selectedEndDate, isPastDate]);

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

    // Handle reset - set to default 2-week range
    const handleReset = useCallback(() => {
        const today = new Date();
        const twoWeeksFromNow = addDays(today, 14);
        setSelectedStartDate(format(today, 'yyyy-MM-dd'));
        setSelectedEndDate(format(twoWeeksFromNow, 'yyyy-MM-dd'));
        onDateRangeSelect(format(today, 'yyyy-MM-dd'), format(twoWeeksFromNow, 'yyyy-MM-dd'));
    }, [onDateRangeSelect]);

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
        const isDisabled = isPastDate(date);

        return {
            container: [
                styles.dayContainer,
                isSelected && styles.selectedDay,
                isInRange && styles.rangeDay,
                isStart && styles.startDay,
                isEnd && styles.endDay,
                isDisabled && styles.disabledDay,
            ],
            text: [
                styles.dayText,
                isSelected && styles.selectedDayText,
                !isSameMonth(date, currentMonth) && styles.otherMonthDay,
                isToday(date) && styles.todayText,
                isDisabled && styles.disabledDayText,
            ],
        };
    }, [selectedStartDate, selectedEndDate, currentMonth, isPastDate]);

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
                    <X size={20} color={COLORS.textPrimary} />
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
                            color={canGoBack ? COLORS.accent : getDimmedTextColor(COLORS.textPrimary, 0.4)}
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
                        <ChevronRight size={20} color={COLORS.accent} />
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
                        onPress={handleReset}
                        activeOpacity={0.7}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                            <Text style={styles.resetButtonText}>Reset</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.confirmButton,
                            isLoading && styles.confirmButtonLoading,
                        ]}
                        onPress={handleConfirmSelection}
                        disabled={isLoading}
                        activeOpacity={0.7}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color={COLORS.textPrimary} />
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
        backgroundColor: COLORS.cardBackground, // Themed background
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
        borderColor: COLORS.buttonBorder, // Themed border
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider, // Themed divider
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary, // Themed text
        fontFamily: 'SpaceMono',
        marginRight: 36,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: getRgbaBackground(COLORS.textPrimary, 0.1), // Subtle background
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
        color: COLORS.textPrimary, // Themed text
        fontFamily: 'SpaceMono',
    },
    monthNavButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.buttonBackground, // Themed button bg
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthNavButtonDisabled: {
        backgroundColor: getRgbaBackground(COLORS.buttonBackground, 0.5), // Dimmed background
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
        color: getDimmedTextColor(COLORS.textPrimary, 0.6), // Dimmed primary text
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
        color: COLORS.textPrimary, // Themed text
        fontFamily: 'SpaceMono',
    },
    selectedDay: {
        backgroundColor: COLORS.accent, // Blue accent
    },
    selectedDayText: {
        color: COLORS.textPrimary, // Primary text on blue bg
        fontWeight: '600',
    },
    rangeDay: {
        backgroundColor: getRgbaBackground(COLORS.accent, 0.2), // Blue range bg
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
        color: getDimmedTextColor(COLORS.textPrimary, 0.4), // Dimmed text
    },
    todayText: {
        color: COLORS.accent, // Blue accent for today
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider, // Themed divider
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
        color: COLORS.textPrimary, // Themed text
        fontFamily: 'SpaceMono',
        marginBottom: 4,
    },
    dateRangeDuration: {
        fontSize: 14,
        color: COLORS.accent, // Blue accent for duration text
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
        backgroundColor: getRgbaBackground(COLORS.accent, 0.1), // Blue themed bg
        borderWidth: 1,
        borderColor: getRgbaBackground(COLORS.accent, 0.2), // Blue themed border
    },
    resetButtonText: {
        color: COLORS.accent, // Blue themed text
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'SpaceMono',
    },
    confirmButton: {
        backgroundColor: COLORS.accent, // Blue accent bg
    },
    confirmButtonDisabled: {
        backgroundColor: getRgbaBackground(COLORS.accent, 0.2), // Blue disabled bg
    },
    confirmButtonText: {
        color: COLORS.textPrimary, // Primary text on blue bg
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'SpaceMono',
    },
    placeholderText: {
        fontSize: 14,
        color: getDimmedTextColor(COLORS.textPrimary, 0.6), // Dimmed placeholder
        fontFamily: 'SpaceMono',
    },
    confirmButtonLoading: {
        opacity: 0.7,
    },
    disabledDay: {
        opacity: 0.4, // Dim more
    },
    disabledDayText: {
        color: getDimmedTextColor(COLORS.textPrimary, 0.4), // Dimmed text
    },
});

export default DateRangeCalendar; 