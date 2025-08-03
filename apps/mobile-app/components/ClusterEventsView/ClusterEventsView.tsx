import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import EventListItem from "../Event/EventListItem";
import InfiniteScrollFlatList from "../Layout/InfintieScrollFlatList";
import Screen from "../Layout/Screen";
import { COLORS } from "../Layout/ScreenLayout";

interface EventsViewProps {
  events: EventType[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onRetry?: () => void;
  onBack?: () => void;
}

const EventsView: React.FC<EventsViewProps> = ({
  events,
  isLoading = false,
  isRefreshing = false,
  hasMore = false,
  error = null,
  onRefresh,
  onLoadMore,
  onRetry,
  onBack,
}) => {
  const router = useRouter();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  }, [router, onBack]);

  const handleEventPress = useCallback(
    (event: EventType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/details?eventId=${event.id}` as never);
    },
    [router],
  );

  const renderEventItem = useCallback(
    (event: EventType) => {
      const eventListItemProps = {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.address || "Unknown location",
        distance: event.distance,
        emoji: event.emoji,
        eventDate: event.eventDate,
        endDate: event.endDate
          ? new Date(event.endDate).toISOString()
          : undefined,
        categories:
          event.categories?.map((cat) => ({ id: cat.id, name: cat.name })) ||
          [],
        isRecurring: event.isRecurring,
        onPress: () => handleEventPress(event),
      };

      return <EventListItem {...eventListItemProps} />;
    },
    [handleEventPress],
  );

  return (
    <Screen
      showBackButton={true}
      onBack={handleBack}
      style={styles.screen}
      isScrollable={false}
      bannerTitle="Cluster Events"
      bannerDescription="Events in this cluster"
      bannerEmoji="🔍"
    >
      <InfiniteScrollFlatList
        data={events ?? []}
        renderItem={renderEventItem}
        fetchMoreData={onLoadMore || (() => Promise.resolve())}
        onRefresh={onRefresh}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        error={error}
        onRetry={onRetry}
        emptyListMessage="No events found"
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: 24,
  },
});

export default EventsView;
