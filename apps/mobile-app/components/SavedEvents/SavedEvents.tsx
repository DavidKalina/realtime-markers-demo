import apiClient from "@/services/ApiClient";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Bookmark, Calendar, Heart, MapPin, Scan } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  FadeOutUp,
  interpolate,
  Layout,
  LinearTransition,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";

type TabType = 'saved' | 'discovered';

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
};

// Memoize the EventCard component
const EventCard: React.FC<{
  item: EventType;
  activeTab: TabType;
  onPress: (event: EventType) => void;
  index: number;
}> = React.memo(({ item, activeTab, onPress, index }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, {
      damping: 25,
      stiffness: 400,
    });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {
      damping: 25,
      stiffness: 400,
    });
  }, []);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Animated.View
      style={[styles.eventCard, animatedStyle]}
      entering={FadeInDown.duration(600).delay(index * 100).springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(300)}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.eventCardContent}>
          <View style={styles.emojiContainer}>
            <Text style={styles.resultEmoji}>{item.emoji || "📍"}</Text>
          </View>

          <View style={styles.resultTextContainer}>
            <Text style={styles.resultTitle} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>

            <View style={styles.detailsContainer}>
              <View style={styles.resultDetailsRow}>
                <Calendar size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                <Text
                  style={styles.resultDetailText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.time}
                </Text>
              </View>

              <View style={styles.resultDetailsRow}>
                <MapPin size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                <Text
                  style={styles.resultDetailText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.location}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.savedBadge}>
            {activeTab === 'saved' ? (
              <Heart size={16} color="#93c5fd" fill="#93c5fd" />
            ) : (
              <Scan size={16} color="#93c5fd" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
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



      // Update cursor and hasMore state
      setHasMore(!!response.nextCursor);
      setCursor(response.nextCursor);

      if (refresh) {
        setEvents(response.events);
      } else {
        // Create a Map of existing events using a composite key
        const existingEventsMap = new Map(
          events.map(event => [
            `${event.id}-${event.eventDate}-${event.location}`,
            event
          ])
        );

        // Filter out duplicates and add new events
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
  }, [cursor]);

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


    // If we've reached the end (hasMore is false), throttle attempts to once every 20 seconds
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        console.log('Throttling load more attempt - too soon after last attempt');
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursor) {
      console.log('Conditions met to load more events with cursor:', cursor);
      fetchEvents();
    } else {
      console.log('Skipping load more due to:', {
        isFetchingMore,
        isRefreshing,
        hasMore,
        hasCursor: !!cursor,
        timeSinceLastAttempt: Date.now() - lastLoadMoreAttempt
      });
    }
  }, [isFetchingMore, isRefreshing, events.length, hasMore, cursor, fetchEvents, lastLoadMoreAttempt]);

  return (
    <EventsList
      events={events}
      onEventPress={onEventPress}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isFetchingMore={isFetchingMore}
      hasMore={hasMore}
      cursor={cursor}
      error={error}
      activeTab="saved"
      isLoading={isLoading}
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
        // Create a Map of existing events using a composite key
        const existingEventsMap = new Map(
          events.map(event => [
            `${event.id}-${event.eventDate}-${event.location}`,
            event
          ])
        );

        // Filter out duplicates and add new events
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
  }, [cursor, events.length, isLoading, pageSize]);

  useEffect(() => {
    setCursor(undefined);
    setHasMore(true);
    fetchEvents();
  }, []); // Only run once on mount

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchEvents(true);
  }, [fetchEvents]);

  const handleLoadMore = useCallback(() => {


    // If we've reached the end (hasMore is false), throttle attempts to once every 20 seconds
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursor) {
      fetchEvents();
    } else {
      console.log('Skipping load more due to:', {
        isFetchingMore,
        isRefreshing,
        hasMore,
        hasCursor: !!cursor,
        timeSinceLastAttempt: Date.now() - lastLoadMoreAttempt
      });
    }
  }, [isFetchingMore, isRefreshing, events.length, hasMore, cursor, fetchEvents, lastLoadMoreAttempt]);

  return (
    <EventsList
      events={events}
      onEventPress={onEventPress}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isFetchingMore={isFetchingMore}
      hasMore={hasMore}
      cursor={cursor}
      error={error}
      activeTab="discovered"
      isLoading={isLoading}
    />
  );
};

interface EventsListProps {
  events: EventType[];
  onEventPress: (event: EventType) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  cursor?: string;
  error?: string | null;
  activeTab: TabType;
  isLoading: boolean;
}

const EventsList = ({
  events,
  onEventPress,
  onLoadMore,
  onRefresh,
  isRefreshing,
  isFetchingMore,
  hasMore,
  cursor,
  error,
  activeTab,
  isLoading
}: EventsListProps) => {
  const listRef = useAnimatedRef<FlatList>();
  const scrollY = useSharedValue(0);
  const router = useRouter();

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const borderBottomColor = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      'clamp'
    );

    return {
      borderBottomColor: borderBottomColor === 0 ? 'transparent' : '#3a3a3a',
    } as ViewStyle;
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleEndReached = useCallback(() => {


    // Only load more if we have scrolled and aren't already loading
    if (!isFetchingMore && !isRefreshing && hasMore && scrollY.value > 0) {
      console.log('Conditions met to load more events');
      onLoadMore();
    } else {
      console.log('Skipping load more due to:', {
        isFetchingMore,
        isRefreshing,
        hasMore,
        scrollY: scrollY.value
      });
    }
  }, [isFetchingMore, isRefreshing, events.length, hasMore, cursor, onLoadMore, scrollY.value]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 74,
    offset: 74 * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: EventType) => {
    return `${item.id}-${item.time}`;
  }, []);

  const renderItem = useCallback(({ item, index }: { item: EventType; index: number }) => (
    <EventCard
      item={item}
      activeTab={activeTab}
      onPress={onEventPress}
      index={index}
    />
  ), [onEventPress, activeTab]);

  const ListHeaderComponent = useCallback(() => (
    <Animated.View
      style={styles.listHeader}
      entering={FadeInDown.duration(600).springify()}
      layout={Layout.duration(300)}
    >
      <View style={styles.counterContainer}>
        <Text style={styles.resultsText}>
          {events.length > 0
            ? `${events.length} events`
            : `No events yet`}
        </Text>
      </View>
    </Animated.View>
  ), [events.length]);

  const ListEmptyComponent = useCallback(() => {
    if (isRefreshing) return null;
    if (isLoading) {
      return (
        <Animated.View
          style={styles.loadingContainer}
          entering={FadeInDown.duration(600).springify()}
          exiting={FadeOut.duration(200)}
          layout={Layout.duration(300)}
        >
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </Animated.View>
      );
    }
    return (
      <Animated.View
        style={styles.emptyStateContainer}
        entering={FadeInDown.duration(600).springify()}
        exiting={FadeOut.duration(200)}
        layout={Layout.duration(300)}
      >
        <View style={styles.emptyStateIconContainer}>
          <Scan size={40} color="#93c5fd" style={{ opacity: 0.6 }} />
        </View>
        <Text style={styles.emptyStateTitle}>
          No events yet
        </Text>
        <Text style={styles.emptyStateDescription}>
          Events you scan will appear here. To discover events, use the scan feature to process event flyers.
        </Text>

        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={() => router.push("/scan")}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Scan size={16} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.emptyStateButtonText}>
              Scan Events
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [isRefreshing, isLoading]);

  const ListFooterComponent = useCallback(() => (
    <Animated.View
      style={styles.loadingFooter}
      entering={FadeInDown.duration(600).springify()}
      exiting={FadeOut.duration(200)}
      layout={Layout.duration(300)}
    >
      {isFetchingMore ? (
        <>
          <ActivityIndicator size="small" color="#93c5fd" />
          <Text style={styles.loadingFooterText}>Loading more...</Text>
        </>
      ) : (
        <View style={styles.loadingFooterSpacer} />
      )}
    </Animated.View>
  ), [isFetchingMore]);

  return (
    <View style={styles.contentArea}>
      <Animated.FlatList
        ref={listRef}
        data={events}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        contentContainerStyle={[
          styles.listContent,
          events.length === 0 && { flexGrow: 1 },
        ]}
      />

      {error && (
        <Animated.View
          style={styles.errorContainer}
          entering={FadeInDown.duration(600).springify()}
          exiting={FadeOutUp.duration(400)}
          layout={Layout.duration(300)}
        >
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

// Main SavedEventsView component
const SavedEventsView: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('saved');
  const scrollY = useSharedValue(0);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const borderBottomColor = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      'clamp'
    );

    return {
      borderBottomColor: borderBottomColor === 0 ? 'transparent' : '#3a3a3a',
    } as ViewStyle;
  });

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleSelectEvent = useCallback((event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (event.id) {
      router.push(`/details?eventId=${event.id}`);
    }
  }, []);

  const handleTabSwitch = useCallback((tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          headerAnimatedStyle,
        ]}
        entering={FadeInDown.duration(600).springify()}
        layout={Layout.duration(300)}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Events</Text>

        <Animated.View
          style={styles.headerIconContainer}
          layout={Layout.duration(300)}
        >
          {activeTab === 'saved' ? (
            <Bookmark size={20} color="#93c5fd" fill="#93c5fd" />
          ) : (
            <Scan size={20} color="#93c5fd" />
          )}
        </Animated.View>
      </Animated.View>

      {/* Tab Toggle */}
      <Animated.View
        style={styles.tabContainer}
        entering={FadeInDown.duration(600).delay(200).springify()}
        layout={Layout.duration(300)}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
          onPress={() => handleTabSwitch('saved')}
          activeOpacity={0.7}
        >
          <Bookmark size={16} color={activeTab === 'saved' ? '#93c5fd' : '#adb5bd'} />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
            Saved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discovered' && styles.activeTab]}
          onPress={() => handleTabSwitch('discovered')}
          activeOpacity={0.7}
        >
          <Scan size={16} color={activeTab === 'discovered' ? '#93c5fd' : '#adb5bd'} />
          <Text style={[styles.tabText, activeTab === 'discovered' && styles.activeTabText]}>
            Discovered
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Content Area */}
      {activeTab === 'saved' ? (
        <SavedEventsList onEventPress={handleSelectEvent} />
      ) : (
        <DiscoveredEventsList onEventPress={handleSelectEvent} />
      )}
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    flex: 1,
    letterSpacing: 0.5,
  },

  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  // List styles
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  listHeader: {
    marginVertical: 12,
  },

  counterContainer: {
    paddingVertical: 8,
  },

  resultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },

  // Event card
  eventCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    marginHorizontal: 0,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  eventCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  resultEmoji: {
    fontSize: 20,
  },

  resultTextContainer: {
    flex: 1,
    justifyContent: "center",
  },

  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },

  detailsContainer: {
    gap: 4,
  },

  resultDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  resultDetailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    flex: 1,
  },

  savedBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
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

  // Empty state
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 50,
  },

  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 24,
  },

  emptyStateButton: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyStateButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 16,
    marginTop: 16,
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

  loadingFooterSpacer: {
    height: 50,
  },

  // Error state
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
    flexDirection: "row",
    alignItems: "center",
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },

  retryButton: {
    backgroundColor: "rgba(249, 117, 131, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  retryButtonText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default SavedEventsView;
