import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes, DiscoveryEvent, DiscoveredEventData, CameraAnimateToLocationEvent } from "@/services/EventBroker";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
    Layout,
    SlideInLeft,
    SlideOutLeft,
    SlideInRight,
    SlideOutRight,
    SlideInUp,
    SlideOutUp,
    SlideInDown,
    SlideOutDown,
    withTiming,
    useAnimatedStyle,
    useSharedValue,
    cancelAnimation,
    Easing,
    runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

// Pre-define animations to avoid recreation
const SPRING_LAYOUT = Layout.springify();

// Create position-specific animations
const createAnimations = (position: string) => {
    const springConfig = {
        damping: 20,
        mass: 1.2,
        stiffness: 150,
    };

    switch (position) {
        case "top-left":
            return {
                entering: SlideInLeft.springify().damping(20).mass(1.2).stiffness(150),
                exiting: SlideOutLeft.springify().damping(20).mass(1.2).stiffness(150),
            };
        case "top-right":
            return {
                entering: SlideInRight.springify().damping(20).mass(1.2).stiffness(150),
                exiting: SlideOutRight.springify().damping(20).mass(1.2).stiffness(150),
            };
        case "bottom-left":
            return {
                entering: SlideInUp.springify().damping(20).mass(1.2).stiffness(150),
                exiting: SlideOutUp.springify().damping(20).mass(1.2).stiffness(150),
            };
        case "bottom-right":
            return {
                entering: SlideInDown.springify().damping(20).mass(1.2).stiffness(150),
                exiting: SlideOutDown.springify().damping(20).mass(1.2).stiffness(150),
            };
        default:
            return {
                entering: SlideInRight.springify().damping(20).mass(1.2).stiffness(150),
                exiting: SlideOutRight.springify().damping(20).mass(1.2).stiffness(150),
            };
    }
};

interface DiscoveryIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

const DiscoveryIndicator: React.FC<DiscoveryIndicatorProps> = ({ position = "top-right" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [discoveredEvent, setDiscoveredEvent] = useState<DiscoveredEventData | null>(null);
    const { subscribe, publish } = useEventBroker();

    // Animation values
    const opacity = useSharedValue(1);

    // Timer ref for auto-hiding
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get position styles based on position prop
    const positionStyle = useMemo(() => {
        switch (position) {
            case "top-left":
                return { top: 150, left: 16 }; // Position below FilterIndicator
            case "bottom-right":
                return { bottom: 50, right: 16 };
            case "bottom-left":
                return { bottom: 50, left: 16 };
            case "top-right":
                return { top: 50, right: 16 }

            default:
                return { top: 150, left: 16 }; // Position below FilterIndicator
        }
    }, [position]);

    // Get animations based on position
    const animations = useMemo(() => createAnimations(position), [position]);

    // Subscribe to discovery events
    useEffect(() => {
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event: DiscoveryEvent) => {

            setDiscoveredEvent(event.event);
            setIsVisible(true);

            // Reset animation values
            opacity.value = 1;

            // Clear any existing timeout
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            // Auto-hide after 10 seconds
            hideTimeoutRef.current = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    "worklet";
                    runOnJS(setIsVisible)(false);
                });
            }, 10000);
        });

        return () => {
            unsubscribe();
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            cancelAnimation(opacity);
        };
    }, [subscribe, opacity]);

    // Create animated styles
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    // Handle press to view event
    const handlePress = () => {
        if (discoveredEvent) {
            publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
                coordinates: discoveredEvent.location.coordinates,
                timestamp: new Date().getTime(),
                source: "discovery_indicator"
            })

            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }

            opacity.value = withTiming(0, { duration: 300 }, () => {
                "worklet";
                runOnJS(setIsVisible)(false);
            });
        }
    };

    if (!isVisible) return null;

    return (
        <Pressable
            onPress={handlePress}
            style={[styles.container, positionStyle]}
        >
            <Animated.View
                style={[styles.indicator, animatedStyle]}
                layout={SPRING_LAYOUT}
                entering={animations.entering}
                exiting={animations.exiting}
            >
                <View style={styles.iconContainer}>
                    <Text style={styles.emojiText}>{discoveredEvent?.emoji || "🎉"}</Text>
                </View>

                {/* Direct text with absolute styling to ensure visibility */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={styles.titleText} numberOfLines={1}>
                        New Discovery
                    </Text>
                </View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        zIndex: 1000,
    },
    indicator: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(51, 51, 51, 0.92)",
        borderRadius: 16,
        padding: 8,
        paddingRight: 12,
        width: 140,
        height: 40,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        backgroundColor: "rgba(255, 215, 0, 0.2)",
    },
    titleText: {
        color: "#f8f9fa", // Using same color as ConnectionIndicator
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    emojiText: {
        fontSize: 14,
        textAlign: "center",
    },
});

export default DiscoveryIndicator;