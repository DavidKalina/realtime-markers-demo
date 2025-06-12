import React, { useCallback, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";
import { AuthWrapper } from "@/components/AuthWrapper";

// Type for events from the API
type EventType = Omit<EventListItemProps, "onPress">;

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
    (event: EventType) => {
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
        return "Search";
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
    (event: EventType) => (
      <EventListItem
        {...event}
        eventDate={new Date(event.eventDate)}
        onPress={handleEventPress}
      />
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
    <AuthWrapper>
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
          data={eventResults as unknown as EventType[]}
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
    </AuthWrapper>
  );
};

export default SearchListScreen;
