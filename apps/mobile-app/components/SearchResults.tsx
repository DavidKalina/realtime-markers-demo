import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

interface SearchresultsProps {
  isLoading: boolean;
  searchResults: any[];
}

const SearchResults: React.FC<SearchresultsProps> = ({ isLoading, searchResults }) => {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ScrollView style={styles.resultsContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#69db7c" style={styles.loader} />
      ) : (
        searchResults?.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventCard}
            onPress={() => router.push(`/results?eventId=${event.id}`)}
          >
            <Text style={styles.eventEmoji}>{event.emoji}</Text>
            <View style={styles.eventDetails}>
              <Text style={styles.eventTitle}>{event.title}</Text>

              {/* Status Badge */}
              {event.status && (
                <View style={[styles.statusBadge, styles.statusPENDING]}>
                  <Text style={styles.statusText}>{event.status}</Text>
                </View>
              )}

              <Text style={styles.eventDate}>{formatDate(event.eventDate)}</Text>

              <Text style={styles.eventLocation} numberOfLines={1}>
                📍 {event.address}
              </Text>

              {/* Categories - if present */}
              {event.categories && event.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {event.categories.slice(0, 2).map((category: any) => (
                    <View key={category.id} style={styles.categoryChip}>
                      <Text style={styles.categoryText}>{category.name}</Text>
                    </View>
                  ))}
                  {event.categories.length > 2 && (
                    <View style={styles.categoryChip}>
                      <Text style={styles.categoryText}>+{event.categories.length - 2} more</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loader: {
    marginVertical: 20,
  },
  eventCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#333",
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  eventEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontFamily: "BungeeInline",
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#CCC",
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    fontFamily: "SpaceMono",
    color: "#CCC",
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#444",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusPENDING: {
    backgroundColor: "#ffd43b",
  },
  statusVERIFIED: {
    backgroundColor: "#69db7c",
  },
  statusREJECTED: {
    backgroundColor: "#ff6b6b",
  },
  statusEXPIRED: {
    backgroundColor: "#868e96",
  },
  statusText: {
    color: "#000",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "bold",
  },
});

export default SearchResults;
