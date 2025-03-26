import { useFilterStore } from "@/stores/useFilterStore";
import { Filter as FilterIcon } from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
    BounceIn,
    BounceOut,
    Layout,
} from "react-native-reanimated";

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();
const BOUNCE_IN = BounceIn.duration(500).springify().damping(12);
const BOUNCE_OUT = BounceOut.duration(400);

interface FilterIndicatorProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "custom";
}

const FilterIndicator: React.FC<FilterIndicatorProps> = React.memo(
    ({ position = "top-right" }) => {
        const router = useRouter();
        // Get active filters from the store
        const activeFilterIds = useFilterStore((state) => state.activeFilterIds);
        const filters = useFilterStore((state) => state.filters);

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
            return filters.filter((filter) => activeFilterIds.includes(filter.id));
        }, [filters, activeFilterIds]);

        // Get the display content based on number of active filters
        const displayContent = useMemo(() => {
            if (activeFilters.length === 0) {
                return {
                    emoji: "🌍",
                    text: "All Events",
                    isActive: false,
                };
            } else if (activeFilters.length === 1) {
                const filter = activeFilters[0];
                return {
                    emoji: filter.emoji || "🔍",
                    text: `${filter.name} filter`,
                    isActive: true,
                };
            } else {
                return {
                    emoji: "🔍",
                    text: `${activeFilters.length} filters active`,
                    isActive: true,
                };
            }
        }, [activeFilters]);

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
                        styles.indicator,
                        !displayContent.isActive && styles.inactiveIndicator,
                    ]}
                    layout={SPRING_LAYOUT}
                >
                    <Text style={styles.emojiText}>{displayContent.emoji}</Text>
                </Animated.View>

                <View style={styles.contentContainer}>
                    <Animated.Text
                        style={[
                            styles.filterText,
                            !displayContent.isActive && styles.inactiveText,
                        ]}
                        layout={SPRING_LAYOUT}
                        numberOfLines={1}
                    >
                        {displayContent.text}
                    </Animated.Text>
                </View>
            </Pressable>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#333",
        borderRadius: 16,
        padding: 8,
        paddingRight: 10,
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        maxWidth: 220,
        minWidth: 140,
        flexShrink: 1,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    pressedContainer: {
        backgroundColor: "#2a2a2a",
        transform: [{ scale: 0.98 }],
    },
    inactiveContainer: {
        backgroundColor: "#333",
        borderColor: "rgba(255, 255, 255, 0.05)",
    },
    indicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
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
        fontSize: 14,
        textAlign: "center",
        lineHeight: 14,
    },
    contentContainer: {
        flexDirection: "column",
        flex: 1,
        flexShrink: 1,
    },
    filterText: {
        color: "rgba(255, 255, 255, 0.9)",
        fontSize: 10,
        fontFamily: "SpaceMono",
        fontWeight: "600",
    },
    inactiveText: {
        color: "rgba(255, 255, 255, 0.6)",
    },
});

export default FilterIndicator; 