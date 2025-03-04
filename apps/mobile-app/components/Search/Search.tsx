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
} from "react-native";
import { ArrowLeft, Search, X, Calendar, MapPin } from "lucide-react-native";
import * as Haptics from "expo-haptics";
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

const SearchView: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<EventType[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Get stored markers from location store to show nearby events initially
  const storedMarkers = useLocationStore((state) => state.markers);

  const searchInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

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
    }, 500);

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      // If search is cleared, show stored markers again
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
        const response = await apiClient.searchEvents(searchQuery);
        let results = response.results.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description || "",
          time: new Date(event.eventDate).toLocaleString(),
          location: event.address || "Location not specified",
          distance: "",
          emoji: event.emoji || "📍",
          categories: event.categories?.map((c) => c.name) || [],
        }));

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
  }, [searchQuery, hasSearched, storedMarkers]);

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

      {/* Simplified Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {/* Search Input */}
        <View style={styles.searchInputContainer}>
          <Search size={18} color="#4dabf7" style={{ marginRight: 8 }} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search events, venues..."
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
              <X size={16} color="#4dabf7" />
            </TouchableOpacity>
          )}
        </View>

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
              <View>
                {/* Results Count */}
                <Text style={styles.resultsText}>
                  {hasSearched
                    ? `${eventResults.length} ${
                        eventResults.length === 1 ? "result" : "results"
                      } found`
                    : "Showing nearby events"}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSelectEvent(item)}
              >
                <Text style={styles.resultEmoji}>{item.emoji}</Text>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.title}
                  </Text>
                  <View style={styles.resultDetailsRow}>
                    <Calendar size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.resultDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.time}
                    </Text>
                  </View>
                  <View style={styles.resultDetailsRow}>
                    <MapPin size={12} color="#93c5fd" style={{ marginRight: 4 }} />
                    <Text style={styles.resultDetailText} numberOfLines={1} ellipsizeMode="tail">
                      {item.distance ? item.distance : item.location}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() =>
              hasSearched && !isLoading ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No events found matching your search.</Text>
                  <Text style={styles.noResultsSubtext}>Try a different search term.</Text>
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
      </View>
    </SafeAreaView>
  );
};

export default SearchView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    backgroundColor: "#333",
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 15,
    marginLeft: 4,
    marginRight: 4,
  },
  resultsText: {
    color: "#adb5bd",
    fontSize: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 20,
  },
  searchResultItem: {
    flexDirection: "row",
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  resultTextContainer: {
    flex: 1,
    overflow: "hidden", // Prevent content from leaking
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#f8f9fa",
    marginBottom: 6,
    fontFamily: "SpaceMono",
  },
  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  resultDetailText: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    flex: 1, // Allow text to take available space
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
