import { useFilterStore } from "@/stores/useFilterStore";
import React, { useMemo, useEffect } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
    BounceIn,
    BounceOut,
    Layout,
    SlideInRight,
    SlideOutLeft,
    FadeIn,
    FadeOut,
    withTiming,
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();
const BOUNCE_IN = BounceIn.duration(500).springify().damping(12);
const BOUNCE_OUT = BounceOut.duration(400);
const SLIDE_IN = SlideInRight.duration(400).springify();
const SLIDE_OUT = SlideOutLeft.duration(300);
const FADE_IN = FadeIn.duration(300);
const FADE_OUT = FadeOut.duration(200);

interface FilterIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

const FilterIndicator: React.FC<FilterIndicatorProps> = React.memo(
    ({ position = "top-right" }) => {
        const router = useRouter();
        // Get active filters and loading state from the store
        const activeFilterIds = useFilterStore((state) => state.activeFilterIds);
        const filters = useFilterStore((state) => state.filters);
        const isLoading = useFilterStore((state) => state.isLoading);
        const fetchFilters = useFilterStore((state) => state.fetchFilters);

        // Width animation value
        const containerWidth = useSharedValue(60);

        // Fetch filters on mount
        useEffect(() => {
            fetchFilters();
        }, []);

        // Memoize position style
        const positionStyle = useMemo(() => {
            switch (position) {
                case "top-right":
                    return { top: 50, right: 16 };
                case "bottom-right":
                    return { bottom: 50, right: 16 };
                case "bottom-left":
                    return { bottom: 50, left: 16 };
                case "top-left":
                    return { top: 100, left: 16 };
                case "custom":
                    return {};
                default:
                    return { top: 50, left: 16 };
            }
        }, [position]);

        // Get active filters
        const activeFilters = useMemo(() => {
            if (isLoading) return [];
            return filters.filter((filter) => activeFilterIds.includes(filter.id));
        }, [filters, activeFilterIds, isLoading]);

        // Get the display content based on number of active filters
        const displayContent = useMemo(() => {
            if (isLoading) {
                return {
                    emoji: "⏳",
                    text: "Loading filters...",
                    isActive: false,
                };
            }

            if (activeFilters.length === 0) {
                return {
                    emoji: "🌍",
                    text: "",
                    isActive: false,
                };
            } else if (activeFilters.length === 1) {
                const filter = activeFilters[0];
                return {
                    emoji: filter.emoji || "🔍",
                    text: `${filter.name}`,
                    isActive: true,
                };
            } else {
                return {
                    emoji: "🔍",
                    text: `${activeFilters.length} filters`,
                    isActive: true,
                };
            }
        }, [activeFilters, isLoading]);

        // Update width animation when active filters change
        useEffect(() => {
            if (displayContent.isActive) {
                // Expand when filters are active
                containerWidth.value = withTiming(140, { duration: 300 });
            } else {
                // Collapse to just show the emoji when no filters
                containerWidth.value = withTiming(60, { duration: 300 });
            }
        }, [displayContent.isActive]);

        // Animated styles for container width
        const animatedContainerStyle = useAnimatedStyle(() => {
            return {
                width: containerWidth.value,
            };
        });

        return (
            <Pressable
                onPress={() => router.push("/filter")}
                style={({ pressed }) => [
                    styles.container,
                    positionStyle,
                    !displayContent.isActive && styles.inactiveContainer,
                    pressed && styles.pressedContainer,
                ]}
            >
                <Animated.View
                    style={[
                        styles.wrapper,
                        animatedContainerStyle
                    ]}
                    layout={SPRING_LAYOUT}
                >
                    <Animated.View
                        style={[
                            styles.indicator,
                            !displayContent.isActive && styles.inactiveIndicator,
                        ]}
                        layout={SPRING_LAYOUT}
                    >
                        <Text style={styles.emojiText}>{displayContent.emoji}</Text>
                    </Animated.View>

                    {displayContent.text ? (
                        <Animated.View
                            style={styles.contentContainer}
                            entering={SLIDE_IN}
                            exiting={SLIDE_OUT}
                        >
                            <Animated.Text
                                style={[
                                    styles.filterText,
                                    !displayContent.isActive && styles.inactiveText,
                                ]}
                                numberOfLines={1}
                                entering={FADE_IN}
                                exiting={FADE_OUT}
                            >
                                {displayContent.text}
                            </Animated.Text>
                        </Animated.View>
                    ) : null}
                </Animated.View>
            </Pressable>
        );
    }
);

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
    wrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#333",
        borderRadius: 16,
        padding: 8,
        paddingRight: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
    },
    pressedContainer: {
        transform: [{ scale: 0.98 }],
    },
    inactiveContainer: {
        backgroundColor: "#333",
        borderColor: "rgba(255, 255, 255, 0.05)",
    },
    indicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        backgroundColor: "#93c5fd",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
        flexShrink: 0,
    },
    inactiveIndicator: {
        backgroundColor: "rgba(147, 197, 253, 0.5)",
    },
    emojiText: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 18,
    },
    contentContainer: {
        flexDirection: "column",
        flex: 1,
        flexShrink: 1,
    },
    filterText: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 12,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    inactiveText: {
        color: "rgba(255, 255, 255, 0.6)",
    },
});

export default FilterIndicator;