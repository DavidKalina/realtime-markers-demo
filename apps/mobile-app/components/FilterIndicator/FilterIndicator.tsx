import { useFilterStore } from "@/stores/useFilterStore";
import React, { useMemo, useEffect } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Filter, FilterX } from "lucide-react-native";
import Animated, {
  Layout,
  FadeIn,
  FadeOut,
  withTiming,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

// Pre-defined animations for reuse
const SPRING_LAYOUT = Layout.springify();

interface FilterIndicatorProps { }

const FilterIndicator: React.FC<FilterIndicatorProps> = React.memo(() => {
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

  // Get active filters
  const activeFilters = useMemo(() => {
    if (isLoading) return [];
    return filters.filter((filter) => activeFilterIds.includes(filter.id));
  }, [filters, activeFilterIds, isLoading]);

  // Get the display content based on number of active filters
  const displayContent = useMemo(() => {
    if (isLoading) {
      return {
        icon: Filter,
        text: "Loading filters...",
        isActive: false,
        useIcon: true,
      };
    }

    if (activeFilters.length === 0) {
      return {
        icon: Filter,
        text: "Showing all",
        isActive: false,
        useIcon: true,
      };
    } else {
      const filter = activeFilters[0];
      return {
        icon: FilterX,
        text: `${filter.name} filter`,
        isActive: true,
        useIcon: false,
        emoji: filter.emoji || "🔍",
      };
    }
  }, [activeFilters, isLoading]);

  // Update width animation when active filters change
  useEffect(() => {
    if (displayContent.isActive) {
      // Expand when filters are active
      containerWidth.value = withTiming(180, { duration: 300 });
    } else {
      // Collapse to just show the emoji when no filters
      containerWidth.value = withTiming(32, { duration: 300 });
    }
  }, [displayContent.isActive]);

  // Animated styles for container width and padding
  const animatedContainerStyle = useAnimatedStyle(() => ({
    width: 140, // Match QueueIndicator's maxWidth
    height: 40,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  }));

  return (
    <Pressable
      onPress={() => router.push("/filter")}
      style={({ pressed }) => [styles.container, pressed && styles.pressedContainer]}
    >
      <Animated.View
        style={[styles.indicator, animatedContainerStyle]}
        layout={SPRING_LAYOUT}
      >
        <View style={styles.iconContainer}>
          {displayContent.useIcon ? (
            React.createElement(displayContent.icon, {
              size: 16,
              color: "rgba(255, 255, 255, 0.7)",
            })
          ) : (
            <Text style={styles.emojiText}>{displayContent.emoji}</Text>
          )}
        </View>

        <Animated.View style={styles.contentContainer} entering={FadeIn} exiting={FadeOut}>
          <Animated.Text
            style={[styles.filterText, !displayContent.isActive && styles.inactiveText]}
            numberOfLines={1}
          >
            {displayContent.text}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  contentContainer: {
    flexDirection: "column",
    flex: 1,
  },
  filterText: {
    color: "#f8f9fa",
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  inactiveText: {
    color: "#f8f9fa",
  },
  emojiText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 16,
    color: "rgba(255, 255, 255, 0.7)",
  },
});

export default FilterIndicator;
