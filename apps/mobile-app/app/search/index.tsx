import React, { useCallback, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import { COLORS } from "@/components/Layout/ScreenLayout";
import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";

// Define Event type to exactly match EventType from useEventSearch
interface Event {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string; // Changed to string to match EventType
  emoji?: string; // Added emoji field
}

const SearchListScreen = () => {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const searchInputRef = useRef<TextInput>(null);
  const storedMarkers = useLocationStore((state) => state.markers);

  // Use our custom hook for search functionality
  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    error,
    searchEvents,
    handleLoadMore: loadMoreEvents,
    clearSearch,
  } = useEventSearch({ initialMarkers: storedMarkers });

  // Search input handlers
  const handleSearchInput = useCallback(
    (text: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSearchQuery(text);
    },
    [setSearchQuery],
  );

  const handleSearch = useCallback(async () => {
    await searchEvents(true);
  }, [searchEvents]);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEventPress = useCallback(
    (event: Event) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  // Auto-focus the search input when the screen opens
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);
  }, []);

  const getBannerTitle = () => {
    switch (filter) {
      case "nearby":
        return "Nearby Events";
      case "upcoming":
        return "Upcoming Events";
      case "popular":
        return "Popular Events";
      default:
        return "Search Events";
    }
  };

  const getBannerDescription = () => {
    switch (filter) {
      case "nearby":
        return "Events happening near you";
      case "upcoming":
        return "Events coming up soon";
      case "popular":
        return "Most popular events";
      default:
        return "Find events, venues, and categories";
    }
  };

  const renderEventItem = useCallback(
    (event: Event) => (
      <TouchableOpacity
        style={styles.eventItem}
        onPress={() => handleEventPress(event)}
        activeOpacity={0.7}
      >
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            {event.emoji && (
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{event.emoji}</Text>
              </View>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}
              {event.distance && (
                <Text style={styles.distanceText}>{event.distance}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleEventPress],
  );

  const handleLoadMore = useCallback(async (): Promise<void> => {
    try {
      await loadMoreEvents();
    } catch (error) {
      console.error("Error loading more events:", error);
      throw error; // Re-throw to let InfiniteScrollFlatList handle the error
    }
  }, [loadMoreEvents]);

  return (
    <Screen
      isScrollable={false}
      bannerTitle={getBannerTitle()}
      bannerDescription={getBannerDescription()}
      bannerEmoji="🔍"
      showBackButton
      onBack={handleBack}
      noAnimation
    >
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
        loading={isLoading}
        style={{ marginHorizontal: 16, marginBottom: 16 }}
      />
      <InfiniteScrollFlatList
        data={eventResults as unknown as Event[]}
        renderItem={renderEventItem}
        fetchMoreData={handleLoadMore}
        onRefresh={async () => await searchEvents(true)}
        isLoading={isLoading}
        isRefreshing={isLoading && eventResults.length === 0}
        hasMore={!error && eventResults.length > 0}
        error={error}
        emptyListMessage={
          searchQuery.trim()
            ? "No events found matching your search"
            : "No events found"
        }
        onRetry={async () => await searchEvents(true)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  eventItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
  },
  titleContainer: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 4,
  },
  eventDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    opacity: 0.8,
    lineHeight: 20,
    marginBottom: 4,
  },
  distanceText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default SearchListScreen;
