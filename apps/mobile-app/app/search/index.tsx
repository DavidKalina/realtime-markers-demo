import React, { useCallback, useEffect, useRef, useState } from "react";
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
import LandingPageContent from "@/components/LandingPage/LandingPageContent";
import useEventSearch from "@/hooks/useEventSearch";
import useLandingPageData from "@/hooks/useLandingPageData";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserLocation } from "@/contexts/LocationContext";
import { AuthWrapper } from "@/components/AuthWrapper";

// Type for events from the API
type EventType = Omit<EventListItemProps, "onPress">;

const SearchListScreen = () => {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const searchInputRef = useRef<TextInput>(null);
  const storedMarkers = useLocationStore((state) => state.markers);
  const { userLocation } = useUserLocation();

  // Use our custom hook for search functionality
  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading: isSearchLoading,
    error: searchError,
    searchEvents,
    handleLoadMore: loadMoreEvents,
    clearSearch,
    hasSearched,
  } = useEventSearch({ initialMarkers: storedMarkers });

  // Use landing page data hook
  const {
    landingData,
    isLoading: isLandingLoading,
    refresh: refreshLanding,
  } = useLandingPageData({
    userLat: userLocation?.[1], // latitude is second element
    userLng: userLocation?.[0], // longitude is first element
    featuredLimit: 5,
    upcomingLimit: 10,
  });

  // Track if we're showing landing page or search results
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (searchQuery.trim()) {
        await searchEvents(true);
      } else {
        await refreshLanding();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [searchQuery, searchEvents, refreshLanding]);

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

  // Determine what content to show
  const showLandingPage = !searchQuery.trim() && !hasSearched;

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
          loading={isSearchLoading}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />

        {showLandingPage ? (
          <LandingPageContent
            data={landingData}
            isLoading={isLandingLoading}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        ) : (
          <InfiniteScrollFlatList
            data={eventResults as unknown as EventType[]}
            renderItem={renderEventItem}
            fetchMoreData={handleLoadMore}
            onRefresh={handleRefresh}
            isLoading={isSearchLoading}
            isRefreshing={isRefreshing}
            hasMore={!searchError && eventResults.length > 0}
            error={searchError}
            emptyListMessage={
              searchQuery.trim()
                ? "No events found matching your search"
                : "No events found"
            }
            onRetry={async () => await searchEvents(true)}
          />
        )}
      </Screen>
    </AuthWrapper>
  );
};

export default SearchListScreen;
