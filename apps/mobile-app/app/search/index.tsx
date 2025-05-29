import React, { useCallback, useMemo, useEffect } from "react";
import { useRouter } from "expo-router";
import { MapPin, Clock } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List from "@/components/Layout/List";
import useEventSearch from "@/hooks/useEventSearch";
import { useLocationStore } from "@/stores/useLocationStore";

// Define Event type to match EventType from useEventSearch
interface Event {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
}

const SearchIndexScreen = () => {
  const router = useRouter();
  const storedMarkers = useLocationStore((state) => state.markers);

  // Use our custom hook for search functionality
  const {
    eventResults: nearbyEvents,
    setSearchQuery: setNearbyQuery,
    searchEvents: searchNearby,
  } = useEventSearch({ initialMarkers: storedMarkers });

  const {
    eventResults: upcomingEvents,
    setSearchQuery: setUpcomingQuery,
    searchEvents: searchUpcoming,
  } = useEventSearch({ initialMarkers: storedMarkers });

  // Set initial search queries
  useEffect(() => {
    setNearbyQuery("nearby");
    setUpcomingQuery("upcoming");
  }, [setNearbyQuery, setUpcomingQuery]);

  // Trigger initial searches
  useEffect(() => {
    searchNearby(true);
    searchUpcoming(true);
  }, [searchNearby, searchUpcoming]);

  const handleEventPress = useCallback(
    (event: Event) => {
      router.push({
        pathname: "/details" as const,
        params: { id: event.id },
      });
    },
    [router],
  );

  const handleViewAllPress = useCallback(
    (filter: string) => {
      router.push({
        pathname: "/search/list" as const,
        params: { filter },
      });
    },
    [router],
  );

  // Convert events to list items
  const convertToListItem = useCallback(
    (event: Event) => ({
      id: event.id,
      icon: MapPin,
      title: event.title,
      description: event.location,
      badge: event.distance,
    }),
    [],
  );

  // Memoize sections
  const sections = useMemo(
    () => [
      {
        title: "Nearby Events",
        icon: MapPin,
        content: (
          <List
            items={nearbyEvents.map(convertToListItem)}
            onItemPress={(item) =>
              handleEventPress(nearbyEvents.find((e) => e.id === item.id)!)
            }
            scrollable={false}
            onViewAllPress={() => handleViewAllPress("nearby")}
            emptyState={{
              icon: MapPin,
              title: "No Nearby Events",
              description: "Events near you will appear here",
            }}
          />
        ),
        onPress: () => handleViewAllPress("nearby"),
        actionButton: {
          label: "View All",
          onPress: () => handleViewAllPress("nearby"),
          variant: "outline" as const,
        },
      },
      {
        title: "Upcoming Events",
        icon: Clock,
        content: (
          <List
            items={upcomingEvents.map(convertToListItem)}
            onItemPress={(item) =>
              handleEventPress(upcomingEvents.find((e) => e.id === item.id)!)
            }
            scrollable={false}
            onViewAllPress={() => handleViewAllPress("upcoming")}
            emptyState={{
              icon: Clock,
              title: "No Upcoming Events",
              description: "Upcoming events will appear here",
            }}
          />
        ),
        onPress: () => handleViewAllPress("upcoming"),
        actionButton: {
          label: "View All",
          onPress: () => handleViewAllPress("upcoming"),
          variant: "outline" as const,
        },
      },
    ],
    [
      nearbyEvents,
      upcomingEvents,
      convertToListItem,
      handleEventPress,
      handleViewAllPress,
    ],
  );

  // Memoize footer buttons
  const footerButtons = useMemo(
    () => [
      {
        label: "Search Events",
        onPress: () => handleViewAllPress(""),
        variant: "primary" as const,
      },
    ],
    [handleViewAllPress],
  );

  return (
    <Screen
      onBack={() => router.back()}
      bannerTitle="Discover Events"
      bannerDescription="Find events happening near you and around the world"
      bannerEmoji="🔍"
      sections={sections}
      footerButtons={footerButtons}
    />
  );
};

export default SearchIndexScreen;
