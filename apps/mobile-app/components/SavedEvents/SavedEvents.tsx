import { apiClient } from "@/services/ApiClient";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Bookmark, Heart, Scan, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import EventList from "../EventList/EventList";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import Tabs, { TabItem } from "../Layout/Tabs";

type TabType = "saved" | "discovered" | "friends";

// Main SavedEventsView component
const SavedEventsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("saved");

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const tabItems: TabItem<TabType>[] = [
    { icon: Bookmark, label: "Saved", value: "saved" },
    { icon: Scan, label: "Discovered", value: "discovered" },
    { icon: Users, label: "Friends", value: "friends" },
  ];

  return (
    <ScreenLayout>
      <Header title="My Events" onBack={handleBack} />

      <Tabs<TabType>
        items={tabItems}
        activeTab={activeTab}
        onTabPress={handleTabSwitch}
        style={styles.tabsContainer}
      />

      <View style={styles.contentArea}>
        {activeTab === "saved" && <SavedEventsList />}
        {activeTab === "discovered" && <DiscoveredEventsList />}
        {activeTab === "friends" && <FriendsSavedEventsList />}
      </View>
    </ScreenLayout>
  );
};

// Separate component for Saved Events
const SavedEventsList: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  const fetchEvents = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setEvents([]);
        } else if (!refresh && isLoading === false) {
          setIsFetchingMore(true);
        }

        const response = await apiClient.events.getSavedEvents({
          limit: pageSize,
          cursor: refresh ? undefined : cursor,
        });

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setEvents(response.events);
        } else {
          const existingEventsMap = new Map(
            events.map((event) => [
              `${event.id}-${event.eventDate}-${event.location}`,
              event,
            ]),
          );

          const newEvents = response.events.filter((event) => {
            const key = `${event.id}-${event.eventDate}-${event.location}`;
            return !existingEventsMap.has(key);
          });

          setEvents((prev) => [...prev, ...newEvents]);
        }

        setError(null);
      } catch (err) {
        setError("Failed to load saved events. Please try again.");
        console.error("Error fetching saved events:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingMore(false);
      }
    },
    [cursor, events.length],
  );

  useEffect(() => {
    setCursor(undefined);
    setHasMore(true);
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchEvents(true);
  }, [fetchEvents]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursor) {
      fetchEvents();
    }
  }, [
    isFetchingMore,
    isRefreshing,
    hasMore,
    cursor,
    fetchEvents,
    lastLoadMoreAttempt,
  ]);

  return (
    <EventList
      events={events}
      isLoading={isLoading}
      isFetchingMore={isFetchingMore}
      error={error}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      onRetry={() => fetchEvents(true)}
      emptyStateTitle="No saved events"
      emptyStateDescription="Events you save will appear here. Start exploring to find events you're interested in!"
      emptyStateIcon={
        <Heart size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
      }
      showChevron={false}
    />
  );
};

// Separate component for Discovered Events
const DiscoveredEventsList: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  const fetchEvents = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setEvents([]);
        } else if (!refresh && isLoading === false) {
          setIsFetchingMore(true);
        }

        const response = await apiClient.events.getUserDiscoveredEvents({
          limit: pageSize,
          cursor: refresh ? undefined : cursor,
        });

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setEvents(response.events);
        } else {
          const existingEventsMap = new Map(
            events.map((event) => [
              `${event.id}-${event.eventDate}-${event.location}`,
              event,
            ]),
          );

          const newEvents = response.events.filter((event) => {
            const key = `${event.id}-${event.eventDate}-${event.location}`;
            return !existingEventsMap.has(key);
          });

          setEvents((prev) => [...prev, ...newEvents]);
        }

        setError(null);
      } catch (err) {
        setError("Failed to load discovered events. Please try again.");
        console.error("Error fetching discovered events:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingMore(false);
      }
    },
    [cursor, events.length],
  );

  useEffect(() => {
    setCursor(undefined);
    setHasMore(true);
    fetchEvents();
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchEvents(true);
  }, [fetchEvents]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursor) {
      fetchEvents();
    }
  }, [
    isFetchingMore,
    isRefreshing,
    hasMore,
    cursor,
    fetchEvents,
    lastLoadMoreAttempt,
  ]);

  return (
    <EventList
      events={events}
      isLoading={isLoading}
      isFetchingMore={isFetchingMore}
      error={error}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      onRetry={() => fetchEvents(true)}
      emptyStateTitle="No discovered events"
      emptyStateDescription="Events you discover through scanning will appear here. Try scanning some event flyers!"
      emptyStateIcon={
        <Scan size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
      }
      showChevron={false}
    />
  );
};

// Add new component for Friends' Saved Events
const FriendsSavedEventsList: React.FC = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  const fetchEvents = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setEvents([]);
        } else if (!refresh && isLoading === false) {
          setIsFetchingMore(true);
        }

        const response = await apiClient.events.getFriendsSavedEvents({
          limit: pageSize,
          cursor: refresh ? undefined : cursor,
        });

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setEvents(response.events);
        } else {
          const existingEventsMap = new Map(
            events.map((event) => [
              `${event.id}-${event.eventDate}-${event.location}`,
              event,
            ]),
          );

          const newEvents = response.events.filter((event) => {
            const key = `${event.id}-${event.eventDate}-${event.location}`;
            return !existingEventsMap.has(key);
          });

          setEvents((prev) => [...prev, ...newEvents]);
        }

        setError(null);
      } catch (err) {
        setError("Failed to load friends' saved events. Please try again.");
        console.error("Error fetching friends' saved events:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingMore(false);
      }
    },
    [cursor, events.length],
  );

  useEffect(() => {
    setCursor(undefined);
    setHasMore(true);
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchEvents(true);
  }, [fetchEvents]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursor) {
      fetchEvents();
    }
  }, [
    isFetchingMore,
    isRefreshing,
    hasMore,
    cursor,
    fetchEvents,
    lastLoadMoreAttempt,
  ]);

  const renderEventItem = useCallback(
    (event: EventType) => (
      <Text style={styles.savedByText}>
        Saved by {event.savedBy?.displayName || event.savedBy?.email}
      </Text>
    ),
    [],
  );

  return (
    <EventList
      events={events}
      isLoading={isLoading}
      isFetchingMore={isFetchingMore}
      error={error}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      onRetry={() => fetchEvents(true)}
      emptyStateTitle="No events from friends"
      emptyStateDescription="Events saved by your friends will appear here. Add more friends to discover events together!"
      emptyStateIcon={
        <Users size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
      }
      showChevron={true}
      renderExtraContent={renderEventItem}
    />
  );
};

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabsContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  savedByText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
});

export default SavedEventsView;
