import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import Screen, { Section } from "../Layout/Screen";
import InfiniteScrollFlatList from "../Layout/InfintieScrollFlatList";
import { COLORS } from "../Layout/ScreenLayout";
import EventListItem from "../Event/EventListItem";

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
    (event: EventType) => (
      <EventListItem {...event} onPress={() => handleEventPress(event)} />
    ),
    [handleEventPress],
  );

  const sections: Section[] = [
    {
      title: "Cluster Events",
      icon: MapPin,
      content: (
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
      ),
    },
  ];

  return (
    <Screen
      showBackButton={true}
      onBack={handleBack}
      sections={sections}
      style={styles.screen}
      isScrollable={false}
    />
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
