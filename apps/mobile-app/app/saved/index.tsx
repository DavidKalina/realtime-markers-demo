import React, { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { Bookmark, MapPin } from "lucide-react-native";
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

const SavedIndexScreen = () => {
  const router = useRouter();
  const storedMarkers = useLocationStore((state) => state.markers);

  // Use our custom hook for saved events
  const {
    eventResults: savedEvents,
    setSearchQuery: setSavedQuery,
    searchEvents: searchSaved,
  } = useEventSearch({ initialMarkers: storedMarkers });

  // Set initial search query for saved events
  React.useEffect(() => {
    setSavedQuery("saved");
    searchSaved(true);
  }, [setSavedQuery, searchSaved]);

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
        // TODO: Replace with proper route type once /saved/list is registered in the app's routing system
        pathname: "/saved/list",
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
        title: "Saved Events",
        icon: Bookmark,
        content: (
          <List
            items={savedEvents.map(convertToListItem)}
            onItemPress={(item) =>
              handleEventPress(savedEvents.find((e) => e.id === item.id)!)
            }
            scrollable={false}
            onViewAllPress={() => handleViewAllPress("saved")}
            emptyState={{
              icon: Bookmark,
              title: "No Saved Events",
              description: "Events you save will appear here",
            }}
          />
        ),
        onPress: () => handleViewAllPress("saved"),
        actionButton: {
          label: "View All",
          onPress: () => handleViewAllPress("saved"),
          variant: "outline" as const,
        },
      },
    ],
    [savedEvents, convertToListItem, handleEventPress, handleViewAllPress],
  );

  return (
    <Screen
      onBack={() => router.back()}
      bannerTitle="Saved Events"
      bannerDescription="Events you've saved for later"
      bannerEmoji="🔖"
      sections={sections}
    />
  );
};

export default SavedIndexScreen;
