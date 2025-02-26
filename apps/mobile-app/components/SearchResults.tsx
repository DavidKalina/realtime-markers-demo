import React from "react";
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
    // Limit to displaying max 3 categories
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
        // Navigation to event detail screen
        // navigation.navigate('EventDetail', { id: item.id });
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

    if (hasMoreData && searchResults.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <FlatList
      data={searchResults}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      contentContainerStyle={styles.container}
      onEndReached={hasMoreData ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      refreshControl={refreshControl}
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
