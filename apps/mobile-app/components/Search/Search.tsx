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
} from "react-native";
import { ArrowLeft, Search, X, Calendar, MapPin } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { EventType } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import useEventSearch from "@/hooks/useEventSearch";
import { styles } from "./styles";

const SearchView: React.FC = () => {
  const router = useRouter();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Get stored markers from location store to show nearby events initially
  const storedMarkers = useLocationStore((state) => state.markers);

  // Use our custom hook
  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    isFetchingMore,
    error,
    hasSearched,
    searchEvents,
    handleLoadMore,
    clearSearch,
  } = useEventSearch({ initialMarkers: storedMarkers });

  const searchInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

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

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    router.back();
  };

  // Handle clear search with haptic feedback
  const handleClearSearch = () => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  };

  // Handle select event
  const handleSelectEvent = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    // Add navigation logic here
    router.push(`details?eventId=${event.id}` as never);
  };

  // Handle search submission
  const handleSearch = () => {
    Keyboard.dismiss();
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
            <TouchableOpacity onPress={handleClearSearch}>
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
