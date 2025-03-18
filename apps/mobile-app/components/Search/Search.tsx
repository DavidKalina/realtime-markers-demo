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
  Animated,
  StyleSheet,
} from "react-native";
import { ArrowLeft, Search, X, Calendar, MapPin, Clock, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { EventType } from "@/types/types";
import { useLocationStore } from "@/stores/useLocationStore";
import useEventSearch from "@/hooks/useEventSearch";

const SearchView: React.FC = () => {
  const router = useRouter();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animation for header shadow
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

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

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 500);

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [fadeAnim]);

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
        <Text style={styles.loadingFooterText}>Loading more events...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerShadowOpacity,
            borderBottomColor: headerShadowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", "#3a3a3a"],
            }),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Events</Text>

        <View style={styles.headerIconContainer}>
          <Search size={18} color="#93c5fd" />
        </View>
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {/* Enhanced Search Input */}
        <Animated.View
          style={[
            styles.searchInputContainer,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.searchIconContainer}>
            <Search size={18} color="#4dabf7" />
          </View>
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
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <X size={16} color="#4dabf7" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Main Content */}
        {isLoading && eventResults.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#93c5fd" />
            <Text style={styles.loadingText}>Searching events...</Text>
          </View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={eventResults}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsText}>
                    {hasSearched
                      ? `${eventResults.length} ${
                          eventResults.length === 1 ? "result" : "results"
                        } found`
                      : "Showing nearby events"}
                  </Text>
                </View>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.eventCard}
                onPress={() => handleSelectEvent(item)}
                activeOpacity={0.8}
              >
                <View style={styles.eventCardContent}>
                  {/* Emoji Container */}
                  <View style={styles.emojiContainer}>
                    <Text style={styles.resultEmoji}>{item.emoji || "📍"}</Text>
                  </View>

                  {/* Event Details */}
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                      {item.title}
                    </Text>

                    {/* Event Details with improved icons */}
                    <View style={styles.detailsContainer}>
                      <View style={styles.resultDetailsRow}>
                        <Clock size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text
                          style={styles.resultDetailText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.time}
                        </Text>
                      </View>

                      <View style={styles.resultDetailsRow}>
                        <MapPin size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                        <Text
                          style={styles.resultDetailText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.distance ? item.distance : item.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() =>
              hasSearched && !isLoading ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIconContainer}>
                    <Search size={36} color="#93c5fd" style={{ opacity: 0.6 }} />
                  </View>
                  <Text style={styles.emptyStateTitle}>No results found</Text>
                  <Text style={styles.emptyStateDescription}>
                    We couldn't find any events matching your search. Try different keywords or
                    browse nearby events.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={renderFooter}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              keyboardVisible && { paddingBottom: keyboardHeight },
              eventResults.length === 0 && hasSearched && { flexGrow: 1 },
            ]}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
          />
        )}

        {/* Improved Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <AlertCircle size={18} color="#f97583" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => searchEvents(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    backgroundColor: "#333",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 0,
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Content area
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },

  // Enhanced Search Input
  searchInputContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },

  searchGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  searchIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },

  clearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(73, 171, 247, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },

  searchInput: {
    flex: 1,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },

  // List styles
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  listHeader: {
    marginVertical: 8,
  },

  resultsContainer: {
    paddingVertical: 8,
  },

  resultsText: {
    fontSize: 14,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
  },

  // Event card
  eventCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },

  eventCardContent: {
    flexDirection: "row",
    padding: 14,
    alignItems: "center",
  },

  emojiContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  resultEmoji: {
    fontSize: 22,
  },

  resultTextContainer: {
    flex: 1,
    justifyContent: "center",
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },

  detailsContainer: {
    gap: 4,
  },

  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  resultDetailText: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: "#adb5bd",
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 16,
  },

  loadingFooter: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  loadingFooterText: {
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginLeft: 8,
  },

  // Error state
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
    flexDirection: "row",
    alignItems: "center",
  },

  errorIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(249, 117, 131, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    flex: 1,
  },

  retryButton: {
    backgroundColor: "rgba(249, 117, 131, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  retryButtonText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    fontSize: 14,
  },
});

export default SearchView;
