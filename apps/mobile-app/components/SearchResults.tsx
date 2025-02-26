import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

// Types to use for the component
interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  eventDate: string;
  categories: Category[];
  status: string;
  address?: string;
  _score?: number; // For search results
}

interface SearchResultsProps {
  searchResults: Event[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreData: boolean;
  onLoadMore: () => void;
  refreshControl?: React.ReactElement;
}

const SearchResults = ({
  searchResults,
  isLoading,
  isLoadingMore,
  hasMoreData,
  onLoadMore,
  refreshControl,
}: SearchResultsProps) => {
  // Keep a reference to the FlatList
  const flatListRef = useRef<FlatList>(null);

  // Track last seen result count to detect changes
  const lastResultCountRef = useRef<number>(0);

  // Use useMemo to deduplicate results and create a stable reference
  // This prevents duplicate IDs which cause React errors
  const dedupedResults = useMemo(() => {
    // Create a map to deduplicate by ID
    const uniqueMap = new Map<string, Event>();

    // Add each item to the map, overwriting any duplicate IDs
    searchResults.forEach((item) => {
      if (item && item.id) {
        uniqueMap.set(item.id, item);
      }
    });

    // Convert back to array
    const uniqueResults = Array.from(uniqueMap.values());

    // Log any deduplication that happened
    if (uniqueResults.length !== searchResults.length) {
      console.warn(
        `Deduplication removed ${searchResults.length - uniqueResults.length} duplicate items`
      );
    }

    return uniqueResults;
  }, [searchResults]);

  // Ensure we scroll to top when results change completely (not during load more)
  useEffect(() => {
    const currentCount = dedupedResults.length;

    // If we have results, and either:
    // 1. We previously had no results, or
    // 2. We have fewer results than before (indicating a new search)
    // Then scroll to top
    if (
      flatListRef.current &&
      currentCount > 0 &&
      (lastResultCountRef.current === 0 || currentCount < lastResultCountRef.current) &&
      !isLoadingMore
    ) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }

    // Update the last count reference
    lastResultCountRef.current = currentCount;
  }, [dedupedResults.length, isLoadingMore]);

  // Format the event date nicely
  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if it's today or tomorrow
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${format(date, "h:mm a")}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${format(date, "h:mm a")}`;
    } else {
      return format(date, "EEE, MMM d, yyyy h:mm a");
    }
  };

  // Render category badges
  const renderCategories = (categories: Category[], eventId: string) => {
    // Limit to displaying max 2 categories
    const displayCategories = categories.slice(0, 2);
    const remaining = categories.length - 2;

    return (
      <View style={styles.categoriesContainer}>
        {displayCategories.map((category, index) => (
          <View key={`${eventId}-cat-${category.id}-${index}`} style={styles.categoryBadge}>
            {category.icon && <Text style={styles.categoryIcon}>{category.icon}</Text>}
            <Text style={styles.categoryName}>{category.name}</Text>
          </View>
        ))}

        {remaining > 0 && (
          <View key={`${eventId}-cat-more`} style={styles.categoryBadge}>
            <Text style={styles.categoryName}>+{remaining} more</Text>
          </View>
        )}
      </View>
    );
  };

  // Render item for the FlatList
  const renderItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      activeOpacity={0.7}
      onPress={() => {
        router.push(`/results?eventId=${item.id}`);
      }}
    >
      <View style={styles.eventHeader}>
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{item.emoji || "📍"}</Text>
        </View>
        <Text style={styles.eventDate}>{formatEventDate(item.eventDate)}</Text>
      </View>

      <Text style={styles.eventTitle}>{item.title}</Text>

      {item.address && (
        <View style={styles.addressContainer}>
          <Ionicons name="location-outline" size={14} color="#aaa" />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      )}

      {/* Show status badge for pending/rejected events */}
      {item.status !== "VERIFIED" && (
        <View
          style={[
            styles.statusBadge,
            item.status === "PENDING" ? styles.pendingStatus : styles.rejectedStatus,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status === "PENDING" ? "Pending Review" : "Rejected"}
          </Text>
        </View>
      )}

      {/* Show relevance score for search results if available */}
      {item._score !== undefined && (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{(item._score * 100).toFixed(0)}% match</Text>
        </View>
      )}

      {item.categories && renderCategories(item.categories, item.id)}
    </TouchableOpacity>
  );

  // Footer component with loading state or "Load More" button
  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#3498db" />
        </View>
      );
    }

    if (hasMoreData && dedupedResults.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  // This is a critical fix for the duplicate key warning
  const keyExtractor = (item: Event) => {
    if (!item || !item.id) {
      // If we somehow get an item without ID, log it and return a fallback
      console.error("Event without ID detected:", item);
      return `missing-id-${Math.random()}`;
    }
    return item.id;
  };

  return (
    <FlatList
      ref={flatListRef}
      data={dedupedResults}
      extraData={dedupedResults.length}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.container}
      onEndReached={hasMoreData && !isLoading && !isLoadingMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      refreshControl={refreshControl}
      removeClippedSubviews={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      // Add key to force complete recreation of FlatList when data fundamentally changes
      key={`results-list-${dedupedResults.length === 0 ? "empty" : "nonempty"}`}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 80, // Extra padding at bottom for load more
  },
  eventCard: {
    backgroundColor: "#333",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 20,
  },
  eventDate: {
    color: "#aaa",
    fontSize: 14,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  addressText: {
    color: "#aaa",
    fontSize: 14,
    marginLeft: 4,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 152, 219, 0.2)",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryIcon: {
    marginRight: 4,
    fontSize: 12,
  },
  categoryName: {
    color: "#3498db",
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  pendingStatus: {
    backgroundColor: "rgba(241, 196, 15, 0.2)",
  },
  rejectedStatus: {
    backgroundColor: "rgba(231, 76, 60, 0.2)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  scoreContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(52, 152, 219, 0.2)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreText: {
    color: "#3498db",
    fontSize: 12,
    fontWeight: "500",
  },
  footer: {
    padding: 16,
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "#2c3e50",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    alignSelf: "center",
    marginTop: 8,
  },
  loadMoreText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SearchResults;
