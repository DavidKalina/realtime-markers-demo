import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Clock, MapPin, Search, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn
} from "react-native-reanimated";

// Memoize the SearchResultCard component
const SearchResultCard: React.FC<{
  item: EventType;
  index: number;
  onPress: (event: EventType) => void;
  entering: any;
}> = React.memo(({ item, index, onPress, entering }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, {
      damping: 25,
      stiffness: 400,
    });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 25,
      stiffness: 400,
    });
  }, []);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Animated.View
      style={[styles.eventCard, animatedStyle]}
      entering={entering}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(25).stiffness(400)}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.eventCardContent}>
          <View style={styles.emojiContainer}>
            <Text style={styles.resultEmoji}>{item.emoji || "📍"}</Text>
          </View>

          <View style={styles.resultTextContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
                {item.title}
              </Text>
            </View>

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
    </Animated.View>
  );
});

const SearchView = () => {
  const router = useRouter();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fadeAnim = useSharedValue(0);
  const scrollY = useSharedValue(0);

  // Animation for header shadow
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const borderBottomColor = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      'clamp'
    );

    return {
      borderBottomColor: borderBottomColor === 0 ? 'transparent' : '#3a3a3a',
    } as ViewStyle;
  });

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
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
  const listRef = useAnimatedRef<FlatList>();

  // Simplify the search input handler
  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    searchEvents(true);
  }, [searchEvents]);

  // Memoize handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    router.back();
  }, []);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const handleSelectEvent = useCallback((event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    router.push(`details?eventId=${event.id}` as never);
  }, []);

  // Memoize the getItemLayout function
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 74, // Height of each item (including margin)
    offset: 74 * index,
    index,
  }), []);

  // Memoize the keyExtractor function
  const keyExtractor = useCallback((item: EventType) => {
    return `${item.id}-${item.title}-${item.time}`;
  }, []);

  // Memoize the renderItem function
  const renderItem = useCallback(({ item, index }: { item: EventType; index: number }) => (
    <SearchResultCard
      item={item}
      index={index}
      onPress={handleSelectEvent}
      entering={ZoomIn.duration(300).springify().damping(25).stiffness(400)}
    />
  ), [handleSelectEvent]);

  // Memoize the ListHeaderComponent
  const ListHeaderComponent = useCallback(() => (
    <Animated.View
      style={styles.listHeader}
      entering={FadeIn}
      layout={LinearTransition.springify()}
    >
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {hasSearched
            ? `${eventResults.length} ${eventResults.length === 1 ? "result" : "results"} found`
            : "Showing nearby events"}
        </Text>
      </View>
    </Animated.View>
  ), [hasSearched, eventResults.length]);

  // Memoize the ListEmptyComponent
  const ListEmptyComponent = useCallback(() => {
    if (!hasSearched || isLoading) return null;
    return (
      <Animated.View
        style={styles.emptyStateContainer}
        entering={FadeIn}
        exiting={FadeOut}
        layout={LinearTransition.springify()}
      >
        <View style={styles.emptyStateIconContainer}>
          <Search size={36} color="#93c5fd" style={{ opacity: 0.6 }} />
        </View>
        <Text style={styles.emptyStateTitle}>No results found</Text>
        <Text style={styles.emptyStateDescription}>
          We couldn't find any events matching your search. Try different keywords or
          browse nearby events.
        </Text>
      </Animated.View>
    );
  }, [hasSearched, isLoading]);

  // Memoize the ListFooterComponent
  const ListFooterComponent = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <Animated.View
        style={styles.loadingFooter}
        entering={FadeIn}
        exiting={FadeOut}
        layout={LinearTransition.springify()}
      >
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text style={styles.loadingFooterText}>Loading more events...</Text>
      </Animated.View>
    );
  }, [isFetchingMore]);

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
      fadeAnim.value = withSpring(1, {
        damping: 15,
        stiffness: 200,
      });
    }, 500);

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [fadeAnim]);

  // Render footer with loading indicator when fetching more
  const renderFooter = () => {
    if (!isFetchingMore) return null;

    return (
      <Animated.View
        style={styles.loadingFooter}
        entering={FadeIn}
        exiting={FadeOut}
        layout={LinearTransition.springify()}
      >
        <ActivityIndicator size="small" color="#93c5fd" />
        <Text style={styles.loadingFooterText}>Loading more events...</Text>
      </Animated.View>
    );
  };

  // Search input animated style
  const searchInputAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      {
        translateY: interpolate(
          fadeAnim.value,
          [0, 1],
          [10, 0]
        ),
      },
    ],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[styles.header, headerAnimatedStyle]}
        entering={FadeIn.duration(300).springify().damping(25).stiffness(400)}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Events</Text>

        <Animated.View
          style={styles.headerIconContainer}
          layout={LinearTransition.springify()}
        >
          <Search size={18} color="#93c5fd" />
        </Animated.View>
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {/* Enhanced Search Input */}
        <Animated.View
          style={[styles.searchInputContainer]}
          entering={FadeIn.duration(200)}
          layout={LinearTransition.springify().damping(25).stiffness(400)}
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
            onChangeText={handleSearchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              handleSearch();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={true}
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
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            getItemLayout={getItemLayout}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={ListHeaderComponent}
            renderItem={renderItem}
            ListEmptyComponent={ListEmptyComponent}
            ListFooterComponent={ListFooterComponent}
            keyExtractor={keyExtractor}
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
          <Animated.View
            style={styles.errorContainer}
            entering={FadeIn}
            exiting={FadeOut}
            layout={LinearTransition.springify()}
          >
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
          </Animated.View>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },

  searchIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
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

  inputRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },

  searchSpinner: {
    marginRight: 8,
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

  qrIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});

export default SearchView;
