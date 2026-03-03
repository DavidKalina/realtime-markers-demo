import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import LandingPageContent from "@/components/LandingPage/LandingPageContent";
import LandingPageBottomFilters from "@/components/LandingPage/LandingPageBottomFilters";
import useEventSearch from "@/hooks/useEventSearch";
import useLandingPageData from "@/hooks/useLandingPageData";
import useLeaderboard from "@/hooks/useLeaderboard";
import { useCategoryPreferences } from "@/hooks/useCategoryPreferences";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
// Type for events from the API
type EventType = Omit<EventListItemProps, "onPress">;

const DISTANCE_STORAGE_KEY = "landing_distance_preference";

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

  // Distance & city filter state
  const [selectedDistance, setSelectedDistance] = useState(15);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Category include/exclude filter state (shared with map screen)
  const {
    includedCategoryIds,
    excludedCategoryIds,
    handleCategoryFilterChange,
  } = useCategoryPreferences();

  // Load persisted distance preference
  useEffect(() => {
    AsyncStorage.getItem(DISTANCE_STORAGE_KEY).then((val) => {
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) setSelectedDistance(parsed);
      }
    });
  }, []);

  const handleDistanceChange = useCallback((distance: number) => {
    Haptics.selectionAsync();
    setSelectedDistance(distance);
    setSelectedCity(null);
    AsyncStorage.setItem(DISTANCE_STORAGE_KEY, String(distance));
  }, []);

  const handleCityChange = useCallback((city: string | null) => {
    Haptics.selectionAsync();
    setSelectedCity(city);
  }, []);

  const hasUserLocation = !!userLocation;

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
    communityLimit: 5,
    discoveryLimit: 8,
    trendingLimit: 5,
    radius: hasUserLocation ? selectedDistance : undefined,
    city: selectedCity || undefined,
    includeCategoryIds:
      includedCategoryIds.length > 0 ? includedCategoryIds : undefined,
    excludeCategoryIds:
      excludedCategoryIds.length > 0 ? excludedCategoryIds : undefined,
  });

  // Leaderboard data (keyed off resolved city from landing page response)
  const resolvedCity = landingData?.resolvedCity || null;
  const { leaderboard } = useLeaderboard(resolvedCity);
  const currentUser = apiClient.getCurrentUser();

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
    (event: EventType, index: number) => (
      <EventListItem
        {...event}
        eventDate={new Date(event.eventDate)}
        onPress={handleEventPress}
        index={index}
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

  // Show landing page only when there's no active search
  const showLandingPage = !searchQuery.trim() && !hasSearched;

  return (
    <Screen
      isScrollable={false}
      bannerTitle={getBannerTitle()}
      bannerDescription={getBannerDescription()}
      bannerEmoji="🔍"
      showBackButton
      onBack={handleBack}
      noAnimation
      bottomContent={
        showLandingPage ? (
          <LandingPageBottomFilters
            selectedDistance={selectedDistance}
            onDistanceChange={handleDistanceChange}
            availableCities={landingData?.availableCities || []}
            selectedCity={selectedCity}
            onCityChange={handleCityChange}
            categories={landingData?.popularCategories || []}
            includedCategoryIds={includedCategoryIds}
            excludedCategoryIds={excludedCategoryIds}
            onCategoryFilterChange={handleCategoryFilterChange}
          />
        ) : undefined
      }
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
          leaderboard={leaderboard}
          leaderboardCity={resolvedCity || undefined}
          currentUserId={currentUser?.id}
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
          emptyEmoji={searchQuery.trim() ? "🔍" : "📭"}
          emptyTitle={
            searchQuery.trim() ? "No results found" : "No events found"
          }
          emptySubtitle={
            searchQuery.trim()
              ? `Nothing matched "${searchQuery.trim()}"`
              : "There are no events in this area yet"
          }
          emptyAction={
            searchQuery.trim()
              ? { label: "Clear Search", onPress: handleClearSearch }
              : undefined
          }
          onRetry={async () => await searchEvents(true)}
        />
      )}
    </Screen>
  );
};

export default SearchListScreen;
