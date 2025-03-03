import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { ArrowLeft, Search, X, Calendar, MapPin, Tag } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import apiClient from "@/services/ApiClient";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventType } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";

// Convert Marker to EventType for consistent handling
const markerToEventType = (marker: Marker): EventType => {
  return {
    id: marker.id,
    title: marker.data.title || "Unnamed Event",
    description: marker.data.description || "",
    time: marker.data.time || "Time not specified",
    location: marker.data.location || "Location not specified",
    distance: marker.data.distance || "",
    emoji: marker.data.emoji || "📍",
    categories: marker.data.categories || [],
  };
};

const SearchScreen: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<EventType[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Get stored markers from location store to show nearby events initially
  const storedMarkers = useLocationStore((state) => state.markers);

  const searchInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiClient.getAllCategories();
        setCategories(categoriesData.map((cat) => cat.name));
      } catch (err) {
        console.error("Failed to load categories:", err);
        // Don't set error state - categories aren't critical
      }
    };

    loadCategories();
  }, []);

  // Initialize with stored markers if available
  useEffect(() => {
    if (storedMarkers.length > 0) {
      const initialEvents = storedMarkers.map(markerToEventType);
      setEventResults(initialEvents);
    }
  }, [storedMarkers]);

  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    // Auto-focus the search input when the screen opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    // Clean up listeners on unmount
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Perform search when query changes or when filter changes
  useEffect(() => {
    if (!searchQuery.trim() && !activeFilter) {
      // If search is cleared and no filter, show stored markers again
      if (storedMarkers.length > 0) {
        const initialEvents = storedMarkers.map(markerToEventType);
        setEventResults(initialEvents);
      } else {
        setEventResults([]);
      }
      return;
    }

    const searchEvents = async () => {
      if (!hasSearched && !searchQuery.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        // Use the API client to search events
        const response = await apiClient.searchEvents(searchQuery);
        let results = response.results.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description || "",
          time: new Date(event.eventDate).toLocaleString(),
          location: event.address || "Location not specified",
          distance: "", // This would be calculated based on user's location
          emoji: event.emoji || "📍",
          categories: event.categories?.map((c) => c.name) || [],
        }));

        // Apply category filter if active
        if (activeFilter) {
          results = results.filter((event) =>
            event.categories.some(
              (category) => category.toLowerCase() === activeFilter.toLowerCase()
            )
          );
        }

        setEventResults(results);
        setHasSearched(true);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search events. Please try again.");
        setEventResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Use a debounce to avoid too many API calls
    const debounceTimer = setTimeout(() => {
      searchEvents();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeFilter, hasSearched, storedMarkers]);

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    router.back();
  };

  // Handle select event
  const handleSelectEvent = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
  };

  // Handle filter selection
  const toggleFilter = (filter: string) => {
    Haptics.selectionAsync();
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  // Clear search query
  const clearSearch = () => {
    Haptics.selectionAsync();
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // Handle search submission
  const handleSearch = () => {
    Keyboard.dismiss();
    setHasSearched(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Events</Text>
      </View>

      {/* Search Input */}
      <Animated.View
        style={styles.searchInputContainer}
        entering={SlideInUp.delay(100).springify().damping(15)}
      >
        <Search size={20} color="#4dabf7" style={{ marginRight: 8 }} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search events, venues, categories..."
          placeholderTextColor="#919191"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery !== "" && (
          <TouchableOpacity onPress={clearSearch}>
            <X size={18} color="#4dabf7" />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loadingText}>Searching events...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={eventResults}
          ListHeaderComponent={() => (
            <>
              {/* Filter Chips */}
              {categories.length > 0 && (
                <Animated.View
                  entering={SlideInUp.delay(150).springify().damping(15)}
                  style={styles.filtersContainer}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 16 }}
                  >
                    {categories.slice(0, 8).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterChip,
                          activeFilter === filter && styles.activeFilterChip,
                        ]}
                        onPress={() => toggleFilter(filter)}
                      >
                        <Tag
                          size={14}
                          color={activeFilter === filter ? "#333" : "#4dabf7"}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.filterChipText,
                            activeFilter === filter && styles.activeFilterChipText,
                          ]}
                        >
                          {filter.toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Animated.View>
              )}

              {/* Results Count */}
              <Animated.View entering={FadeIn.delay(200).duration(400)}>
                <Text style={styles.resultsText}>
                  {hasSearched
                    ? `${eventResults.length} ${
                        eventResults.length === 1 ? "result" : "results"
                      } found`
                    : "Showing nearby events"}
                </Text>
              </Animated.View>
            </>
          )}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(300 + index * 50).duration(300)}>
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSelectEvent(item)}
              >
                <Text style={styles.resultEmoji}>{item.emoji}</Text>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <View style={styles.resultDetailsRow}>
                    <Calendar size={14} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.resultDetailText}>{item.time}</Text>
                    <MapPin size={14} color="#93c5fd" style={{ marginLeft: 8, marginRight: 4 }} />
                    <Text style={styles.resultDetailText}>
                      {item.distance ? item.distance : item.location}
                    </Text>
                  </View>
                  <View style={styles.resultCategoriesRow}>
                    {item.categories?.map((category: string, catIndex: number) => (
                      <View key={catIndex} style={styles.resultCategoryChip}>
                        <Text style={styles.resultCategoryText}>{category}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
          ListEmptyComponent={() =>
            hasSearched && !isLoading ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No events found matching your search.</Text>
                <Text style={styles.noResultsSubtext}>
                  Try a different search term or remove filters.
                </Text>
              </View>
            ) : null
          }
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            keyboardVisible && { paddingBottom: keyboardHeight },
            eventResults.length === 0 && { flexGrow: 1 },
          ]}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SearchScreen;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 0,
    borderBottomColor: "#3a3a3a",
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginLeft: 4,
    marginRight: 4,
  },
  filtersContainer: {
    marginHorizontal: 16,
    paddingBottom: 20,
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#4a4a4a",
  },
  activeFilterChip: {
    backgroundColor: "#4dabf7",
    borderColor: "#4dabf7",
  },
  filterChipText: {
    color: "#f8f9fa",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  activeFilterChipText: {
    color: "#333",
  },
  resultsText: {
    color: "#adb5bd",
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 20,
  },
  searchResultItem: {
    flexDirection: "row",
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#f8f9fa",
    marginBottom: 8,
    fontFamily: "SpaceMono",
  },
  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  resultDetailText: {
    fontSize: 14,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
  },
  resultCategoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  resultCategoryChip: {
    backgroundColor: "#4a4a4a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  resultCategoryText: {
    fontSize: 12,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  noResults: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  noResultsText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  noResultsSubtext: {
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontSize: 14,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#3a3a3a",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#4a4a4a",
    alignItems: "center",
  },
  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#93c5fd",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#333",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
});
