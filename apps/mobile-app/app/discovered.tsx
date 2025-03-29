import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Pressable, Dimensions } from "react-native";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutUp,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
    useSharedValue,
    Easing,
} from "react-native-reanimated";
import { Sparkles, MapPin, Calendar, Clock } from "lucide-react-native";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, DiscoveredEventData } from "@/services/EventBroker";

const { width } = Dimensions.get("window");

export default function DiscoveredEventScreen() {
    const router = useRouter();
    const { eventId } = useLocalSearchParams();
    const [event, setEvent] = useState<DiscoveredEventData | null>(null);
    const { subscribe } = useEventBroker();

    // Animation values
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(1);

    // Subscribe to discovery events
    useEffect(() => {
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event) => {
            if (event.event.id === eventId) {
                setEvent(event.event);
            }
        });

        return () => unsubscribe();
    }, [subscribe, eventId]);

    // Start celebration animation
    useEffect(() => {
        if (event) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 300, easing: Easing.elastic(1.2) }),
                    withTiming(1, { duration: 300, easing: Easing.elastic(1.2) })
                ),
                2,
                false
            );

            rotation.value = withRepeat(
                withSequence(
                    withTiming(360, { duration: 1000, easing: Easing.linear }),
                    withTiming(0, { duration: 0 })
                ),
                2,
                false
            );
        }
    }, [event]);

    // Animated styles
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` },
        ],
        opacity: opacity.value,
    }));

    if (!event) {
        return null;
    }

    const eventDate = new Date(event.eventDate);
    const formattedDate = eventDate.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const formattedTime = eventDate.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <View style={styles.container}>
            <Animated.View
                style={[styles.content, animatedStyle]}
                entering={SlideInDown.springify()}
                exiting={SlideOutUp.springify()}
            >
                <View style={styles.header}>
                    <View style={styles.emojiContainer}>
                        <Text style={styles.emoji}>{event.emoji}</Text>
                    </View>
                    <Text style={styles.title}>{event.title}</Text>
                </View>

                <View style={styles.details}>
                    <View style={styles.detailRow}>
                        <MapPin size={16} color="#FFD700" />
                        <Text style={styles.detailText}>{event.address || "Location details coming soon"}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Calendar size={16} color="#FFD700" />
                        <Text style={styles.detailText}>{formattedDate}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Clock size={16} color="#FFD700" />
                        <Text style={styles.detailText}>{formattedTime}</Text>
                    </View>
                </View>

                {event.description && (
                    <View style={styles.descriptionContainer}>
                        <Text style={styles.description}>{event.description}</Text>
                    </View>
                )}

                <Pressable
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                    onPress={() => router.back()}
                >
                    <Text style={styles.buttonText}>View on Map</Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1a1a1a",
        padding: 16,
        justifyContent: "center",
    },
    content: {
        backgroundColor: "rgba(51, 51, 51, 0.92)",
        borderRadius: 24,
        padding: 24,
        width: width - 32,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    header: {
        alignItems: "center",
        marginBottom: 24,
    },
    emojiContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255, 215, 0, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    emoji: {
        fontSize: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: "600",
        color: "#fff",
        textAlign: "center",
        fontFamily: "SpaceMono",
    },
    details: {
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    detailText: {
        color: "#f8f9fa",
        fontSize: 16,
        marginLeft: 12,
        fontFamily: "SpaceMono",
    },
    descriptionContainer: {
        marginBottom: 24,
    },
    description: {
        color: "#f8f9fa",
        fontSize: 16,
        lineHeight: 24,
        fontFamily: "SpaceMono",
    },
    button: {
        backgroundColor: "#FFD700",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "SpaceMono",
    },
}); 