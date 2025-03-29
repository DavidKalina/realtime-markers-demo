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
    .damping(20)  // Increased damping for more controlled movement
    .mass(1.2)    // Slightly increased mass for more weight feel
    .stiffness(150); // Reduced stiffness for smoother movement
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
    const opacity = useSharedValue(0); // Start hidden
    const containerWidth = useSharedValue(140); // Match FilterIndicator's width

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
            console.log("[DiscoveryIndicator] Received discovery event:", {
                event: event.event,
                timestamp: new Date().toISOString()
            });

            setDiscoveredEvent(event.event);
            setIsVisible(true);

            // Clear any existing timeout
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            // Start celebration animation
            opacity.value = withTiming(1, { duration: 300, easing: Easing.ease });
            scale.value = withTiming(1.2, { duration: 300, easing: Easing.elastic(1.2) }, () => {
                scale.value = withTiming(1, { duration: 300, easing: Easing.elastic(1.2) });
            });

            // Auto-hide after 10 seconds
            hideTimeoutRef.current = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500, easing: Easing.ease }, () => {
                    "worklet";
                    setIsVisible(false);
                });
            }, 10000);
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
        ],
        opacity: opacity.value,
    }));

    // Handle press to view event
    const handlePress = () => {
        if (discoveredEvent) {
            router.push(`/discovered?eventId=${discoveredEvent.id}`);
            setIsVisible(false);
            opacity.value = withTiming(0, { duration: 300, easing: Easing.ease });
        }
    };

    if (!isVisible) return null;

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
                    <Text style={styles.emojiText}>{discoveredEvent?.emoji || "🎉"}</Text>
                </View>

                <Animated.View style={styles.contentContainer} entering={FADE_IN} exiting={FadeOut}>
                    <Animated.Text style={styles.titleText} numberOfLines={1}>
                        Discovered
                    </Animated.Text>
                </Animated.View>
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
        height: 40,
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
        justifyContent: "center",
    },
    titleText: {
        color: "#FFD700",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    emojiText: {
        fontSize: 14,
        textAlign: "center",
        lineHeight: 16,
        color: "rgba(255, 255, 255, 0.7)",
    },
});

export default DiscoveryIndicator; 