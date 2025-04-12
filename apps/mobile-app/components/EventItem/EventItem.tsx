import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Calendar, MapPin, ChevronRight } from "lucide-react-native";
import Animated, {
    FadeInDown,
    FadeOut,
    Layout,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from "react-native-reanimated";
import { EventType } from "@/types/types";

// Unified color theme
const COLORS = {
    background: "#1a1a1a",
    cardBackground: "#2a2a2a",
    cardBackgroundAlt: "#232323",
    textPrimary: "#f8f9fa",
    textSecondary: "#a0a0a0",
    accent: "#93c5fd",
    accentDark: "#3b82f6",
    divider: "rgba(255, 255, 255, 0.08)",
    buttonBackground: "rgba(147, 197, 253, 0.1)",
    buttonBorder: "rgba(255, 255, 255, 0.05)",
    shadow: "rgba(0, 0, 0, 0.5)",
};

interface EventItemProps {
    event: EventType;
    onPress: (event: EventType) => void;
    index?: number;
    variant?: 'default' | 'compact' | 'featured';
    showChevron?: boolean;
    showDistance?: boolean;
}

const EventItem: React.FC<EventItemProps> = ({
    event,
    onPress,
    index = 0,
    variant = 'default',
    showChevron = true,
    showDistance = false,
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.98, {
            damping: 25,
            stiffness: 400,
        });
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, {
            damping: 25,
            stiffness: 400,
        });
    }, []);

    const handlePress = useCallback(() => {
        onPress(event);
    }, [event, onPress]);

    const getStyles = () => {
        switch (variant) {
            case 'compact':
                return compactStyles;
            case 'featured':
                return featuredStyles;
            default:
                return defaultStyles;
        }
    };

    const styles = getStyles();

    return (
        <Animated.View
            style={[styles.eventCard, animatedStyle]}
            entering={FadeInDown.duration(600).delay(index * 100).springify()}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.duration(300)}
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <View style={styles.eventCardContent}>
                    <View style={styles.emojiContainer}>
                        <Text style={styles.resultEmoji}>{event.emoji || "📍"}</Text>
                    </View>

                    <View style={styles.resultTextContainer}>
                        <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                            {event.title}
                        </Text>

                        <View style={styles.detailsContainer}>
                            <View style={styles.resultDetailsRow}>
                                <Calendar size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                                <Text
                                    style={styles.resultDetailText}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {event.time}
                                </Text>
                            </View>

                            <View style={styles.resultDetailsRow}>
                                <MapPin size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                                <Text
                                    style={styles.resultDetailText}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {showDistance && event.distance ? event.distance : event.location}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {showChevron && (
                        <View style={styles.chevronContainer}>
                            <ChevronRight size={16} color={COLORS.textSecondary} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const defaultStyles = StyleSheet.create({
    eventCard: {
        backgroundColor: COLORS.cardBackground,
        padding: 12,
        marginHorizontal: 0,
        marginVertical: 6,
        borderRadius: 12,
        flexDirection: "column",
        borderWidth: 1,
        borderColor: COLORS.divider,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    eventCardContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    emojiContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.buttonBackground,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
    },
    resultEmoji: {
        fontSize: 20,
    },
    resultTextContainer: {
        flex: 1,
        justifyContent: "center",
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.textPrimary,
        fontFamily: "SpaceMono",
        marginBottom: 6,
    },
    detailsContainer: {
        gap: 4,
    },
    resultDetailsRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    resultDetailText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontFamily: "SpaceMono",
        flex: 1,
    },
    chevronContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.buttonBackground,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.buttonBorder,
    },
});

const compactStyles = StyleSheet.create({
    ...defaultStyles,
    eventCard: {
        ...defaultStyles.eventCard,
        padding: 8,
        marginVertical: 4,
    },
    emojiContainer: {
        ...defaultStyles.emojiContainer,
        width: 32,
        height: 32,
    },
    resultTitle: {
        ...defaultStyles.resultTitle,
        fontSize: 13,
        marginBottom: 4,
    },
    resultDetailText: {
        ...defaultStyles.resultDetailText,
        fontSize: 12,
    },
});

const featuredStyles = StyleSheet.create({
    ...defaultStyles,
    eventCard: {
        ...defaultStyles.eventCard,
        padding: 16,
        marginVertical: 8,
    },
    emojiContainer: {
        ...defaultStyles.emojiContainer,
        width: 48,
        height: 48,
    },
    resultTitle: {
        ...defaultStyles.resultTitle,
        fontSize: 16,
        marginBottom: 8,
    },
    resultDetailText: {
        ...defaultStyles.resultDetailText,
        fontSize: 14,
    },
});

export default EventItem; 