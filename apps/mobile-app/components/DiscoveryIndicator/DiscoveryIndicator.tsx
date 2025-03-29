import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, DiscoveryEvent, DiscoveredEventData } from "@/services/EventBroker";
import { Sparkles } from "lucide-react-native";
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
    Layout,
    SlideInLeft,
    SlideOutLeft,
    FadeIn,
    FadeOut,
    withRepeat,
    withSequence,
    withTiming,
    useAnimatedStyle,
    useSharedValue,
    cancelAnimation,
    Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();
const SLIDE_IN = SlideInLeft.springify()
    .damping(20)
    .mass(1.2)
    .stiffness(150);
const SLIDE_OUT = SlideOutLeft.springify()
    .damping(20)
    .mass(1.2)
    .stiffness(150);
const FADE_IN = FadeIn.duration(400).delay(100);

interface DiscoveryIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

const DiscoveryIndicator: React.FC<DiscoveryIndicatorProps> = React.memo(({ position = "top-right" }) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [discoveredEvent, setDiscoveredEvent] = useState<DiscoveredEventData | null>(null);
    const { subscribe } = useEventBroker();

    // Animation values
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const opacity = useSharedValue(1);

    // Timer ref for auto-hiding
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Memoize position style
    const positionStyle = React.useMemo(() => {
        switch (position) {
            case "top-right":
                return { top: 150, left: 16 }; // Position below ConnectionIndicator
            case "bottom-right":
                return { bottom: 50, right: 16 };
            case "bottom-left":
                return { bottom: 50, left: 16 };
            case "top-left":
                return { top: 150, left: 16 }; // Position below ConnectionIndicator
            case "custom":
                return {};
            default:
                return { top: 150, left: 16 };
        }
    }, [position]);

    // Subscribe to discovery events
    useEffect(() => {
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event: DiscoveryEvent) => {
            setDiscoveredEvent(event.event);
            setIsVisible(true);

            // Clear any existing timeout
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            // Start celebration animation
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

            // Auto-hide after 5 seconds
            hideTimeoutRef.current = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    "worklet";
                    setIsVisible(false);
                });
            }, 5000);
        });

        return () => {
            unsubscribe();
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [subscribe]);

    // Animated styles
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` },
        ],
        opacity: opacity.value,
    }));

    // Handle press to view event
    const handlePress = () => {
        if (discoveredEvent) {
            router.push(`/discovered?eventId=${discoveredEvent.id}`);
            setIsVisible(false);
        }
    };

    if (!isVisible || !discoveredEvent) {
        return null;
    }

    return (
        <Pressable
            onPress={handlePress}
            style={({ pressed }) => [styles.container, positionStyle, pressed && styles.pressedContainer]}
        >
            <Animated.View
                style={[styles.indicator, animatedStyle]}
                layout={SPRING_LAYOUT}
                entering={SLIDE_IN}
                exiting={SLIDE_OUT}
            >
                <View style={styles.iconContainer}>
                    <Sparkles size={16} color="#FFD700" />
                </View>

                <View style={styles.contentContainer}>
                    <Animated.Text style={styles.titleText} numberOfLines={1}>
                        New Event Discovered!
                    </Animated.Text>
                    <Animated.Text style={styles.eventText} numberOfLines={1}>
                        {discoveredEvent.emoji} {discoveredEvent.title}
                    </Animated.Text>
                </View>
            </Animated.View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    indicator: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(51, 51, 51, 0.92)",
        borderRadius: 16,
        padding: 8,
        paddingRight: 10,
        maxWidth: 140,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
    },
    pressedContainer: {
        transform: [{ scale: 0.98 }],
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        backgroundColor: "rgba(255, 215, 0, 0.1)",
    },
    contentContainer: {
        flexDirection: "column",
        flex: 1,
    },
    titleText: {
        color: "#FFD700",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    eventText: {
        color: "#f8f9fa",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "500",
    },
});

export default DiscoveryIndicator; 