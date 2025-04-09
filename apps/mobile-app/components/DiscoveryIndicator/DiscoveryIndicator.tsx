import { useEventBroker } from "@/hooks/useEventBroker";
import { CameraAnimateToLocationEvent, DiscoveredEventData, DiscoveryEvent, EventTypes } from "@/services/EventBroker";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    BounceIn,
    LinearTransition,
    ZoomIn,
    ZoomOut
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

    // Add simulation effect
    useEffect(() => {
        const timer = setTimeout(() => {
            const testEvents = [
                {
                    id: `test-${Date.now()}-1`,
                    event: {
                        id: `test-${Date.now()}-1`,
                        emoji: "🎉",
                        title: "Test Event 1",
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.95,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location: {
                            coordinates: [-122.4194, 37.7749] // San Francisco
                        }
                    },
                    timestamp: Date.now()
                },
                {
                    id: `test-${Date.now()}-2`,
                    event: {
                        id: `test-${Date.now()}-2`,
                        emoji: "🎭",
                        title: "Test Event 2",
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.85,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location: {
                            coordinates: [-73.935242, 40.730610] // New York
                        }
                    },
                    timestamp: Date.now()
                },
                {
                    id: `test-${Date.now()}-3`,
                    event: {
                        id: `test-${Date.now()}-3`,
                        emoji: "🎨",
                        title: "Test Event 3",
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.75,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location: {
                            coordinates: [-118.2437, 34.0522] // Los Angeles
                        }
                    },
                    timestamp: Date.now()
                },
                {
                    id: `test-${Date.now()}-4`,
                    event: {
                        id: `test-${Date.now()}-4`,
                        emoji: "🎪",
                        title: "Test Event 4",
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.90,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location: {
                            coordinates: [-87.6298, 41.8781] // Chicago
                        }
                    },
                    timestamp: Date.now()
                },
                {
                    id: `test-${Date.now()}-5`,
                    event: {
                        id: `test-${Date.now()}-5`,
                        emoji: "🎡",
                        title: "Test Event 5",
                        eventDate: new Date().toISOString(),
                        confidenceScore: 0.80,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location: {
                            coordinates: [-95.3698, 29.7604] // Houston
                        }
                    },
                    timestamp: Date.now()
                }
            ];

            // Fire off events with a small delay between each
            testEvents.forEach((event, index) => {
                setTimeout(() => {
                    publish<DiscoveryEvent>(EventTypes.EVENT_DISCOVERED, {
                        timestamp: Date.now(),
                        source: "simulation",
                        event: event.event
                    });
                }, index * 500); // 500ms delay between each event
            });
        }, 5000); // Wait 5 seconds before starting

        return () => clearTimeout(timer);
    }, []);

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
                            entering={ZoomIn.springify().damping(15).mass(0.8)}
                            exiting={ZoomOut.springify().damping(15).mass(0.8)}
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
                            entering={ZoomIn.springify().damping(15).mass(0.8)}
                            exiting={ZoomOut.springify().damping(15).mass(0.8)}
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
        width: 160,
    },
    itemContainer: {
        width: 160,
    },
    pressable: {
        width: '100%',
    },
    indicator: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2C3333",
        borderRadius: 6,
        padding: 6,
        paddingRight: 6,
        width: 140,
        height: 36,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    iconContainer: {
        width: 20,
        height: 20,
        borderRadius: 3,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 6,
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.05)",
    },
    titleText: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    emojiText: {
        fontSize: 10,
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