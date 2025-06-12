import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventListItem, {
  EventListItemProps,
} from "@/components/Event/EventListItem";
import { apiClient } from "@/services/ApiClient";
import { Category } from "@/services/api/base/types";
import { AuthWrapper } from "@/components/AuthWrapper";

// Type for events from the API
type EventListItemType = Omit<EventListItemProps, "onPress">;

const CategoryEventsScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [events, setEvents] = useState<EventListItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  // Fetch initial category data
  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const categories = await apiClient.categories.getCategories();
        const foundCategory = categories.find((cat) => cat.id === id);
        if (foundCategory) {
          setCategory(foundCategory);
        } else {
          setError("Category not found");
        }
      } catch (err) {
        console.error("Error fetching category:", err);
        setError("Failed to load category");
      }
    };

    fetchCategory();
  }, [id]);

  // Fetch events for the category
  const fetchEvents = useCallback(
    async (refresh = false) => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);

        const result = await apiClient.events.getEventsByCategory(id, {
          limit: 20,
          cursor: refresh ? undefined : nextCursor,
        });

        if (refresh) {
          setEvents(result.events as EventListItemType[]);
        } else {
          setEvents((prev) => [
            ...prev,
            ...(result.events as EventListItemType[]),
          ]);
        }

        setNextCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (err) {
        console.error("Error fetching category events:", err);
        setError("Failed to load events");
      } finally {
        setIsLoading(false);
      }
    },
    [id, nextCursor],
  );

  // Initial load
  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEventPress = useCallback(
    (event: EventListItemType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  const renderEventItem = useCallback(
    (event: EventListItemType) => (
      <EventListItem {...event} onPress={handleEventPress} />
    ),
    [handleEventPress],
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchEvents();
  }, [fetchEvents, hasMore, isLoading]);

  const handleRefresh = useCallback(async () => {
    await fetchEvents(true);
  }, [fetchEvents]);

  return (
    <AuthWrapper>
      <Screen
        isScrollable={false}
        bannerTitle={category?.name || "Category Events"}
        bannerDescription={`Events in ${category?.name || "this category"}`}
        bannerEmoji={category?.emoji || "📅"}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <InfiniteScrollFlatList
          data={events}
          renderItem={renderEventItem}
          fetchMoreData={handleLoadMore}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          isRefreshing={isLoading && events.length === 0}
          hasMore={hasMore && !error}
          error={error}
          emptyListMessage="No events found in this category"
          onRetry={handleRefresh}
        />
      </Screen>
    </AuthWrapper>
  );
};

export default CategoryEventsScreen;
