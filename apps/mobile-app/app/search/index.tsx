import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search as SearchIcon, X } from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem from "@/components/Event/EventListItem";
import LandingPageContent from "@/components/LandingPage/LandingPageContent";
import useEventInfiniteSearch from "@/hooks/useEventInfiniteSearch";
import useLandingPageData from "@/hooks/useLandingPageData";
import { useUserLocation } from "@/contexts/LocationContext";
import { AuthWrapper } from "@/components/AuthWrapper";
import { EventResponse } from "@realtime-markers/types";

// Type for events from the API
type EventType = EventResponse;

const SearchListScreen = () => {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const searchInputRef = useRef<TextInput>(null);
  const { userLocation } = useUserLocation();

  // Use the new infinite search hook
  const {
    searchQuery,
    setSearchQuery,
    allItems: eventResults,
    isLoading: isSearchLoading,
    error: searchError,
    hasMore,
    fetchNextPage,
    clearSearch,
  } = useEventInfiniteSearch({
    initialParams: { limit: 10 },
  });

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
        // For infinite search, we don't have a direct refresh method
        // The search will automatically update when the query changes
      } else {
        await refreshLanding();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [searchQuery, refreshLanding]);

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
      await fetchNextPage();
    } catch (error) {
      console.error("Error loading more events:", error);
      throw error; // Re-throw to let InfiniteScrollFlatList handle the error
    }
  }, [fetchNextPage]);

  // Determine what content to show
  const showLandingPage = !searchQuery.trim();

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
            data={eventResults}
            renderItem={renderEventItem}
            fetchMoreData={handleLoadMore}
            onRefresh={handleRefresh}
            isLoading={isSearchLoading}
            isRefreshing={isRefreshing}
            hasMore={hasMore}
            error={searchError ? String(searchError) : null}
            emptyListMessage={
              searchQuery.trim()
                ? "No events found matching your search"
                : "No events found"
            }
            onRetry={async () => {
              // For infinite search, we can't directly retry a specific search
              // The search will automatically retry when the query changes
            }}
          />
        )}
      </Screen>
    </AuthWrapper>
  );
};

export default SearchListScreen;
