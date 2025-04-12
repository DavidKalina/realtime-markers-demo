import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { AlertCircle, Search as SearchIcon, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue
} from "react-native-reanimated";
import EventItem from "../EventItem/EventItem";
import Card from "../Layout/Card";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import Input from "../Input/Input";

const SearchView = () => {
  const router = useRouter();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollY = useSharedValue(0);

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

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

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

  const renderItem = useCallback(({ item, index }: { item: EventType; index: number }) => (
    <EventItem
      event={item}
      onPress={handleSelectEvent}
      index={index}
      variant="default"
      showChevron={true}
      showDistance={true}
    />
  ), [handleSelectEvent]);

  return (
    <ScreenLayout>
      <Header
        title="Search Events"
        onBack={handleBack}
        rightIcon={<SearchIcon size={18} color="#93c5fd" />}
      />

      <View style={styles.contentArea}>
        {/* Enhanced Search Input */}
        <View style={styles.searchInputContainer}>
          <Input
            ref={searchInputRef}
            icon={SearchIcon}
            rightIcon={searchQuery !== "" ? X : undefined}
            onRightIconPress={handleClearSearch}
            placeholder="Search events, venues, categories..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={true}
          />
          {isLoading && searchQuery !== "" && (
            <View style={styles.searchSpinnerContainer}>
              <ActivityIndicator size="small" color="#4dabf7" />
            </View>
          )}
        </View>

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
            renderItem={renderItem}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <Text style={styles.resultsText}>
                  {hasSearched
                    ? `${eventResults.length} ${eventResults.length === 1 ? "result" : "results"} found`
                    : "Showing nearby events"}
                </Text>
              </View>
            )}
            ListEmptyComponent={() => (
              hasSearched && (
                <Card style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIconContainer}>
                    <SearchIcon size={36} color="#93c5fd" style={{ opacity: 0.6 }} />
                  </View>
                  <Text style={styles.emptyStateTitle}>No results found</Text>
                  <Text style={styles.emptyStateDescription}>
                    We couldn't find any events matching your search. Try different keywords or
                    browse nearby events.
                  </Text>
                </Card>
              )
            )}
            ListFooterComponent={() => (
              isFetchingMore && (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color="#93c5fd" />
                  <Text style={styles.loadingFooterText}>Loading more events...</Text>
                </View>
              )
            )}
            keyExtractor={(item) => `${item.id}-${item.title}-${item.time}`}
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

        {/* Error Display */}
        {error && (
          <Card
            style={styles.errorContainer}
            animated={true}
            noBorder
            noShadow
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
          </Card>
        )}
      </View>
    </ScreenLayout>
  );
};

// Update styles to remove duplicated styles that are now in shared components
const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingTop: 8,
  },
  searchInputContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listHeader: {
    marginVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
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
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  loadingText: {
    color: COLORS.textSecondary,
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
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginLeft: 8,
  },
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  errorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(249, 117, 131, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },
  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: "rgba(249, 117, 131, 0.15)",
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
  searchSpinnerContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
});

export default SearchView;
