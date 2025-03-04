import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { ArrowLeft, Search, X, Calendar, MapPin } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import apiClient from "@/services/ApiClient";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventType } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import { styles } from "./styles";

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

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

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

  // Initial search function
  const searchEvents = useCallback(
    async (reset = true) => {
      if (!searchQuery.trim()) {
        // If search is cleared, show stored markers again
        if (storedMarkers.length > 0) {
          const initialEvents = storedMarkers.map(markerToEventType);
          setEventResults(initialEvents);
        } else {
          setEventResults([]);
        }
        setHasMoreResults(false);
        setNextCursor(undefined);
        return;
      }

      if (reset) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }
      setError(null);

      try {
        // Use the cursor for pagination if we're loading more
        const cursorToUse = reset ? undefined : nextCursor;

        const response = await apiClient.searchEvents(
          searchQuery,
          10, // Limit
          cursorToUse
        );

        // Map API results to EventType
        const newResults = response.results.map((result) => ({
          id: result.id,
          title: result.title,
          description: result.description || "",
          time: new Date(result.eventDate).toLocaleString(),
          location: result.address || "Location not specified",
          distance: "",
          emoji: result.emoji || "📍",
          categories: result.categories?.map((c) => c.name) || [],
        }));

        // Update pagination state
        setNextCursor(response.nextCursor);
        setHasMoreResults(!!response.nextCursor);

        // If resetting, replace results. Otherwise, append to existing results
        if (reset) {
          setEventResults(newResults);
        } else {
          // Check for duplicates before appending
          const existingIds = new Set(eventResults.map((event) => event.id));
          const uniqueNewResults = newResults.filter((event) => !existingIds.has(event.id));

          setEventResults((prev) => [...prev, ...uniqueNewResults]);
        }

        setHasSearched(true);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search events. Please try again.");
        if (reset) {
          setEventResults([]);
        }
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [searchQuery, nextCursor, eventResults, storedMarkers]
  );

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery.trim() && !hasSearched) {
      return;
    }

    // Use a debounce to avoid too many API calls
    const debounceTimer = setTimeout(() => {
      // Reset search when query changes
      searchEvents(true);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchEvents]);

  // Handle loading more results
  const handleLoadMore = () => {
    if (!isLoading && !isFetchingMore && hasMoreResults && searchQuery.trim()) {
      searchEvents(false);
    }
  };

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
    // Add navigation logic here
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
    searchEvents(true);
  };

  // Render footer with loading indicator when fetching more
  const renderFooter = () => {
    if (!isFetchingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text style={styles.loadingFooterText}>Loading more...</Text>
      </View>
    );
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
        {isLoading && eventResults.length === 0 ? (
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
            ListFooterComponent={renderFooter}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              keyboardVisible && { paddingBottom: keyboardHeight },
              eventResults.length === 0 && { flexGrow: 1 },
            ]}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
          />
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => searchEvents(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SearchView;
