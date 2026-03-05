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
import useEventSearch from "@/hooks/useEventSearch";
import useLandingPageData from "@/hooks/useLandingPageData";
import useThirdSpaceScore from "@/hooks/useThirdSpaceScore";
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
  const [selectedCity] = useState<string | null>(null);

  // Category include/exclude filter state (shared with map screen)
  const { includedCategoryIds, excludedCategoryIds } = useCategoryPreferences();

  // Load persisted distance preference
  useEffect(() => {
    AsyncStorage.getItem(DISTANCE_STORAGE_KEY).then((val) => {
      if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) setSelectedDistance(parsed);
      }
    });
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

  // Third Space Score data (keyed off resolved city from landing page response)
  const resolvedCity = landingData?.resolvedCity || null;
  const { score: thirdSpaceScore } = useThirdSpaceScore(resolvedCity);
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
    (event: EventType, index: number) => {
      let distance = event.distance || "";
      if (!distance && userLocation && event.coordinates) {
        const [lng, lat] = userLocation;
        const [eLng, eLat] = event.coordinates;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const R = 3958.8; // miles
        const dLat = toRad(eLat - lat);
        const dLng = toRad(eLng - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) *
            Math.cos(toRad(eLat)) *
            Math.sin(dLng / 2) ** 2;
        const mi = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = mi < 0.1 ? "Nearby" : `${mi.toFixed(1)} mi`;
      }
      return (
        <EventListItem
          {...event}
          distance={distance}
          eventDate={new Date(event.eventDate)}
          onPress={handleEventPress}
          index={index}
        />
      );
    },
    [handleEventPress, userLocation],
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
          thirdSpaceScore={thirdSpaceScore}
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
