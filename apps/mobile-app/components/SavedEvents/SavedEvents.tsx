import apiClient from "@/services/ApiClient";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Bookmark, Heart, Scan } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useSharedValue
} from "react-native-reanimated";
import EventItem from "../EventItem/EventItem";
import Card from "../Layout/Card";
import Header from "../Layout/Header";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";

type TabType = 'saved' | 'discovered';

// Memoize the EventCard component
const EventCard: React.FC<{
  item: EventType;
  activeTab: TabType;
  onPress: (event: EventType) => void;
  index: number;
}> = React.memo(({ item, activeTab, onPress, index }) => {
  return (
    <EventItem
      event={item}
      onPress={onPress}
      index={index}
      variant="default"
      showChevron={false}
    />
  );
});

// Separate component for Saved Events
const SavedEventsList: React.FC<{
  onEventPress: (event: EventType) => void;
}> = ({ onEventPress }) => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  const fetchEvents = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
        setCursor(undefined);
        setHasMore(true);
        setEvents([]);
      } else if (!refresh && isLoading === false) {
        setIsFetchingMore(true);
      }

      const response = await apiClient.getSavedEvents({
        limit: pageSize,
        cursor: refresh ? undefined : cursor,
      });

      setHasMore(!!response.nextCursor);
      setCursor(response.nextCursor);

      if (refresh) {
        setEvents(response.events);
      } else {
        const existingEventsMap = new Map(
          events.map(event => [
            `${event.id}-${event.eventDate}-${event.location}`,
            event
          ])
        );

        const newEvents = response.events.filter(event => {
          const key = `${event.id}-${event.eventDate}-${event.location}`;
          return !existingEventsMap.has(key);
        });

        setEvents(prev => [...prev, ...newEvents]);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load saved events. Please try again.');
      console.error('Error fetching saved events:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetchingMore(false);
    }
  }, [cursor, events.length]);

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
  }, [isFetchingMore, isRefreshing, hasMore, cursor, fetchEvents, lastLoadMoreAttempt]);

  const ListFooter = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.loadingFooterText}>Loading more...</Text>
      </View>
    );
  }, [isFetchingMore]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading saved events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Card style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchEvents(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <Heart size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
        </View>
        <Text style={styles.emptyStateTitle}>No saved events</Text>
        <Text style={styles.emptyStateDescription}>
          Events you save will appear here. Start exploring to find events you're interested in!
        </Text>
      </Card>
    );
  }

  return (
    <FlatList
      data={events}
      renderItem={({ item, index }) => (
        <EventCard
          item={item}
          activeTab="saved"
          onPress={onEventPress}
          index={index}
        />
      )}
      keyExtractor={(item) => `${item.id}-${item.time}`}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.2}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      ListFooterComponent={ListFooter}
      contentContainerStyle={styles.listContent}
    />
  );
};

// Separate component for Discovered Events
const DiscoveredEventsList: React.FC<{
  onEventPress: (event: EventType) => void;
}> = ({ onEventPress }) => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);
  const pageSize = 10;

  const fetchEvents = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
        setCursor(undefined);
        setHasMore(true);
        setEvents([]);
      } else if (!refresh && isLoading === false) {
        setIsFetchingMore(true);
      }

      const response = await apiClient.getUserDiscoveredEvents({
        limit: pageSize,
        cursor: refresh ? undefined : cursor,
      });

      setHasMore(!!response.nextCursor);
      setCursor(response.nextCursor);

      if (refresh) {
        setEvents(response.events);
      } else {
        const existingEventsMap = new Map(
          events.map(event => [
            `${event.id}-${event.eventDate}-${event.location}`,
            event
          ])
        );

        const newEvents = response.events.filter(event => {
          const key = `${event.id}-${event.eventDate}-${event.location}`;
          return !existingEventsMap.has(key);
        });

        setEvents(prev => [...prev, ...newEvents]);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load discovered events. Please try again.');
      console.error('Error fetching discovered events:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFetchingMore(false);
    }
  }, [cursor, events.length]);

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
  }, [isFetchingMore, isRefreshing, hasMore, cursor, fetchEvents, lastLoadMoreAttempt]);

  const ListFooter = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.loadingFooterText}>Loading more...</Text>
      </View>
    );
  }, [isFetchingMore]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading discovered events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Card style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchEvents(true)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <Scan size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />
        </View>
        <Text style={styles.emptyStateTitle}>No discovered events</Text>
        <Text style={styles.emptyStateDescription}>
          Events you discover through scanning will appear here. Try scanning some event flyers!
        </Text>
      </Card>
    );
  }

  return (
    <FlatList
      data={events}
      renderItem={({ item, index }) => (
        <EventCard
          item={item}
          activeTab="discovered"
          onPress={onEventPress}
          index={index}
        />
      )}
      keyExtractor={(item) => `${item.id}-${item.time}`}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.2}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      ListFooterComponent={ListFooter}
      contentContainerStyle={styles.listContent}
    />
  );
};

// Main SavedEventsView component
const SavedEventsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('saved');
  const scrollY = useSharedValue(0);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleSelectEvent = useCallback((event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (event.id) {
      router.push(`/details?eventId=${event.id}`);
    }
  }, [router]);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  return (
    <ScreenLayout>
      <Header
        title="My Events"
        onBack={handleBack}
        rightIcon={activeTab === 'saved' ? <Heart size={20} color={COLORS.accent} fill={COLORS.accent} /> : <Scan size={20} color={COLORS.accent} />}
      />

      <Card style={styles.tabContainer} noBorder noShadow>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
          onPress={() => handleTabSwitch('saved')}
          activeOpacity={0.7}
        >
          <Bookmark size={16} color={activeTab === 'saved' ? COLORS.accent : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
            Saved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discovered' && styles.activeTab]}
          onPress={() => handleTabSwitch('discovered')}
          activeOpacity={0.7}
        >
          <Scan size={16} color={activeTab === 'discovered' ? COLORS.accent : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'discovered' && styles.activeTabText]}>
            Discovered
          </Text>
        </TouchableOpacity>
      </Card>

      <View style={styles.contentArea}>
        {activeTab === 'saved' ? (
          <SavedEventsList onEventPress={handleSelectEvent} />
        ) : (
          <DiscoveredEventsList onEventPress={handleSelectEvent} />
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  activeTab: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceMono',
    marginLeft: 8,
    fontWeight: "600",
  },
  activeTabText: {
    color: COLORS.accent,
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginTop: 12,
  },
  loadingFooter: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingFooterText: {
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginLeft: 8,
  },
  errorContainer: {
    margin: 16,
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  emptyStateContainer: {
    margin: 16,
    alignItems: 'center',
    padding: 24,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SavedEventsView;
