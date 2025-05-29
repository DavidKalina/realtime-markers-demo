import React, { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { Bookmark, MapPin } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import List from "@/components/Layout/List";
import { useSavedEvents } from "@/hooks/useSavedEvents";

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
  const { events: savedEvents, isLoading, error, refresh } = useSavedEvents();

  const handleEventPress = useCallback(
    (event: Event) => {
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  const handleViewAllPress = useCallback(
    (filter: string) => {
      router.push({
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
              title: isLoading
                ? "Loading..."
                : error
                  ? "Error Loading Events"
                  : "No Saved Events",
              description: isLoading
                ? "Please wait while we load your saved events"
                : error
                  ? "Tap to try again"
                  : "Events you save will appear here",
            }}
            refreshing={isLoading}
            onRefresh={refresh}
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
    [
      savedEvents,
      convertToListItem,
      handleEventPress,
      handleViewAllPress,
      isLoading,
      error,
      refresh,
    ],
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
