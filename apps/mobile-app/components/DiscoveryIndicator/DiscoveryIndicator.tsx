import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, DiscoveredEventData, DiscoveryEvent, EventTypes } from "@/services/EventBroker";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    BounceIn,
    LinearTransition,
    ZoomIn,
    ZoomOut,
    FadeInDown,
    FadeOutUp,
    withSequence,
    withTiming,
    withDelay,
    withSpring
} from "react-native-reanimated";

interface DiscoveryIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

interface DiscoveryItem {
    id: string;
    event: DiscoveredEventData;
    timestamp: number;
}


const DiscoveryIndicator: React.FC<DiscoveryIndicatorProps> = ({ position = "top-right" }) => {
    const [discoveries, setDiscoveries] = useState<DiscoveryItem[]>([]);
    const { subscribe, publish } = useEventBroker();

    // Add dummy discoveries for testing
    useEffect(() => {
        const timer = setTimeout(() => {
            const dummyDiscoveries: DiscoveryItem[] = [
                {
                    id: 'dummy1',
                    event: {
                        id: 'dummy1',
                        title: 'Test Event 1',
                        emoji: '🎉',
                        location: {
                            coordinates: [0, 0]
                        },
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.8,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    timestamp: Date.now()
                },
                {
                    id: 'dummy2',
                    event: {
                        id: 'dummy2',
                        title: 'Test Event 2',
                        emoji: '🎭',
                        location: {
                            coordinates: [0, 0]
                        },
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.8,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    timestamp: Date.now()
                },
                {
                    id: 'dummy3',
                    event: {
                        id: 'dummy3',
                        title: 'Test Event 3',
                        emoji: '🎨',
                        location: {
                            coordinates: [0, 0]
                        },
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.8,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    },
                    timestamp: Date.now()
                }
            ];

            setDiscoveries(dummyDiscoveries);

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                setDiscoveries([]);
            }, 10000);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const positionStyle = useMemo(() => {
        const baseSpacing = 4; // Reduced from 50 to bring closer to edge
        const itemSpacing = 8;
        const maxItems = 5;

        switch (position) {
            case "top-left":
                return {
                    top: 90,
                    left: baseSpacing,
                    maxHeight: maxItems * (40 + itemSpacing)
                };
            case "bottom-right":
                return {
                    bottom: baseSpacing,
                    right: baseSpacing,
                    maxHeight: maxItems * (40 + itemSpacing)
                };
            case "bottom-left":
                return {
                    bottom: baseSpacing,
                    left: baseSpacing,
                    maxHeight: maxItems * (40 + itemSpacing)
                };
            case "top-right":
                return {
                    top: baseSpacing,
                    right: baseSpacing,
                    maxHeight: maxItems * (40 + itemSpacing)
                };
            default:
                return {
                    top: 150,
                    left: baseSpacing,
                    maxHeight: maxItems * (40 + itemSpacing)
                };
        }
    }, [position]);


    // Subscribe to discovery events
    useEffect(() => {
        const unsubscribe = subscribe(EventTypes.EVENT_DISCOVERED, (event: DiscoveryEvent) => {
            setDiscoveries(prev => {
                // Don't add duplicates
                if (prev && prev.some(d => d.id === event.event.id)) {
                    return prev;
                }

                const newDiscovery: DiscoveryItem = {
                    id: event.event.id,
                    event: { ...event.event },
                    timestamp: new Date().getTime()
                };

                // Add new discovery to the front of the array
                const newDiscoveries = [newDiscovery, ...(prev || [])];

                // Auto-dismiss after 10 seconds
                setTimeout(() => {
                    // Just remove the item - the exiting animation will handle the fade out
                    setDiscoveries(current => {
                        if (!current) return [];
                        return current.filter(item => item.id !== newDiscovery.id);
                    });
                }, 10000);

                // Limit the number of displayed items
                return newDiscoveries.slice(0, 10);
            });
        });

        return () => {
            unsubscribe();
        };
    }, [subscribe]);

    const handlePress = (discovery: DiscoveryItem) => {
        if (discovery?.event?.location?.coordinates) {
            publish<CameraAnimateToLocationEvent>(EventTypes.CAMERA_ANIMATE_TO_LOCATION, {
                coordinates: discovery.event.location.coordinates,
                timestamp: new Date().getTime(),
                source: "discovery_indicator"
            });
        }

        // Mark as fading out but don't change opacity - let the exiting animation handle it
        // Just remove the item - the exiting animation will handle the fade out
        setTimeout(() => {
            setDiscoveries(current =>
                current.filter(item => item.id !== discovery.id)
            );
        }, 50);
    };

    return (
        <View style={[styles.container, position === "custom" ? null : positionStyle]}>
            {position === "custom" ? (
                <View style={styles.wrapper}>
                    {discoveries && discoveries.map((item, index) => (
                        <Animated.View
                            key={item.id}
                            style={[
                                styles.itemContainer,
                                index > 0 && { marginTop: 8 }
                            ]}
                            entering={FadeInDown
                                .springify()
                                .damping(15)
                                .mass(0.8)
                                .delay(index * 100)}
                            exiting={FadeOutUp
                                .springify()
                                .damping(15)
                                .mass(0.8)
                                .delay(index * 100)}

                            layout={LinearTransition.springify()}
                        >
                            <Pressable
                                onPress={() => handlePress(item)}
                                style={styles.pressable}
                            >
                                <View style={styles.indicator}>
                                    <View style={styles.iconContainer}>
                                        <Text style={styles.emojiText}>{item.event?.emoji || "🎉"}</Text>
                                    </View>

                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Text style={styles.titleText} numberOfLines={1}>
                                            New Discovery
                                        </Text>
                                    </View>

                                    <View style={styles.tapIndicator}>
                                        <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.6)" />
                                    </View>
                                </View>
                            </Pressable>
                        </Animated.View>
                    ))}
                </View>
            ) : (
                <Animated.View style={styles.wrapper}>
                    {discoveries && discoveries.map((item, index) => (
                        <Animated.View
                            key={item.id}
                            style={[
                                styles.itemContainer,
                                index > 0 && { marginTop: 8 }
                            ]}
                            entering={FadeInDown
                                .springify()
                                .damping(15)
                                .mass(0.8)
                                .delay(index * 100)}
                            exiting={FadeOutUp
                                .springify()
                                .damping(15)
                                .mass(0.8)
                                .delay(index * 100)}
                            layout={LinearTransition.springify()}
                        >
                            <Pressable
                                onPress={() => handlePress(item)}
                                style={styles.pressable}
                            >
                                <View style={styles.indicator}>
                                    <View style={styles.iconContainer}>
                                        <Text style={styles.emojiText}>{item.event?.emoji || "🎉"}</Text>
                                    </View>

                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Text style={styles.titleText} numberOfLines={1}>
                                            New Discovery
                                        </Text>
                                    </View>

                                    <View style={styles.tapIndicator}>
                                        <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.6)" />
                                    </View>
                                </View>
                            </Pressable>
                        </Animated.View>
                    ))}
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        zIndex: 1000,
    },
    wrapper: {
        width: 180,
    },
    itemContainer: {
        width: 180,
    },
    pressable: {
        width: '100%',
    },
    indicator: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1a1a1a",
        borderRadius: 12,
        padding: 8,
        paddingRight: 8,
        width: 160,
        height: 40,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    titleText: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 12,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    emojiText: {
        fontSize: 12,
        textAlign: "center",
        color: "rgba(255, 255, 255, 0.9)",
    },
    tapIndicator: {
        marginLeft: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DiscoveryIndicator;