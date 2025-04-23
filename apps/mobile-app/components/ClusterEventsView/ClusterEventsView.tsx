import apiClient from "@/services/ApiClient";
import { useLocationStore } from "@/stores/useLocationStore";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, MapPin, Star, Tag } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  Layout,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import EventItem from "../EventItem/EventItem";
import ScreenLayout from "../Layout/ScreenLayout";
import Card from "../Layout/Card";
import Header from "../Layout/Header";
import Tabs, { TabItem } from "../Layout/Tabs";
import { COLORS } from "../Layout/ScreenLayout";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Types
interface CategoryType {
  id: string;
  name: string;
}

interface HubDataType {
  featuredEvent: EventType | null;
  eventsByCategory: {
    category: CategoryType;
    events: EventType[];
  }[];
  eventsByLocation: {
    location: string;
    events: EventType[];
  }[];
  eventsToday: EventType[];
  clusterName: string;
  clusterDescription: string;
  clusterEmoji: string;
}

interface EventsListSectionProps {
  title: string;
  icon: React.ElementType;
  events: EventType[];
  onEventPress: (event: EventType) => void;
  onPageChange?: (index: number) => void;
  currentPage?: number;
  useScrollView?: boolean;
}

// Styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainScrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  clusterNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  clusterEmoji: {
    fontSize: 24,
  },
  clusterName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  clusterDescription: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },
  // Section styles
  sectionContainer: {
    marginTop: 24,
    marginBottom: 12,
  },
  featuredSection: {
    marginBottom: 24,
    marginTop: 16,
  },
  featuredTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  featuredTitleIcon: {
    fontSize: 24,
  },
  featuredTitleText: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLabel: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sectionLabelText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    marginRight: 4,
  },
  // Featured event styles
  featuredImageContainer: {
    width: "100%",
    height: 100,
    backgroundColor: COLORS.cardBackground,
    overflow: "hidden",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  featuredTag: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  featuredTagText: {
    color: COLORS.accent,
    fontSize: 9,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    marginLeft: 2,
    letterSpacing: 0.5,
  },
  featuredEventContent: {
    padding: 16,
    position: "relative",
  },
  featuredEventHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingRight: 70,
  },
  featuredEventEmoji: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  featuredEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    letterSpacing: -0.2,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 12,
  },
  featuredEventDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  featuredEventDetails: {
    flexDirection: "row",
    gap: 8,
  },
  featuredEventDetail: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  featuredEventDetailText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  timeBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  timeBadgeToday: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  timeBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  timeBadgeTextToday: {
    color: COLORS.accent,
  },

  // Tab styles
  tabsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    marginVertical: 20,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 2,
    flexDirection: "row",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  // Events list styles
  eventsListContainer: {
    width: "100%",
    height: 450,
    marginBottom: 0,
  },
  eventsListInner: {
    flex: 1,
    height: 450,
  },
  listHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  listHeaderText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyListContainer: {
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyListText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  eventCard: {
    backgroundColor: COLORS.cardBackgroundAlt,
    padding: 12,
    marginHorizontal: 0,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  eventEmojiText: {
    fontSize: 18,
    textAlign: "center",
    color: COLORS.textPrimary,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 6,
  },
  eventDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  eventDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  eventDetailText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  eventActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevronContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  // Highlights section
  highlightsContainer: {
    marginVertical: 24,
  },
  highlightsList: {
    marginTop: 12,
  },
  highlightCard: {
    width: 180,
    marginRight: 16,
    backgroundColor: COLORS.cardBackgroundAlt,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  highlightImageContainer: {
    width: "100%",
    height: 100,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  highlightImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  highlightContent: {
    padding: 12,
  },
  highlightTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 8,
  },
  highlightInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  highlightInfoText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },
  // Page indicator
  pageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});

// Memoized TabButton component
const TabButton = memo<{
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onPress: () => void;
}>(({ icon: Icon, label, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.tab, isActive && styles.activeTab]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon
      size={16}
      color={isActive ? COLORS.accent : COLORS.textSecondary}
      style={styles.tabIcon}
    />
    <Text style={[styles.tabText, isActive && styles.activeTabText]}>{label}</Text>
  </TouchableOpacity>
));

// Memoized AnimatedEventCard component
const AnimatedEventCard = memo<{
  event: EventType;
  onPress: () => void;
  index: number;
}>(({ event, onPress, index }) => {
  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} layout={Layout.springify()}>
      <EventItem
        event={event}
        onPress={onPress}
        index={index}
        variant="default"
        showChevron={true}
      />
    </Animated.View>
  );
});

// Memoized HighlightCard component
const HighlightCard = memo<{
  event: EventType;
  onPress: () => void;
}>(({ event, onPress }) => (
  <TouchableOpacity style={styles.highlightCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.highlightImageContainer}>
      {event.imageUrl ? (
        <Image source={{ uri: event.imageUrl }} style={styles.highlightImage} />
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: COLORS.cardBackground,
          }}
        >
          <Text style={styles.eventEmojiText}>{event.emoji || "🎉"}</Text>
        </View>
      )}
    </View>
    <View style={styles.highlightContent}>
      <Text style={styles.highlightTitle} numberOfLines={2} ellipsizeMode="tail">
        {event.title}
      </Text>
      <View style={styles.highlightInfoRow}>
        <Calendar size={12} color={COLORS.textSecondary} />
        <Text style={styles.highlightInfoText}>
          {new Date(event.eventDate).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.highlightInfoRow}>
        <MapPin size={12} color={COLORS.textSecondary} />
        <Text style={styles.highlightInfoText} numberOfLines={1}>
          {event.location}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
));

// Replace the parseLocation function with this simpler truncate function
const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

const ClusterDescription = memo<{
  description: string;
}>(({ description }) => {
  return (
    <Card>
      <Text style={styles.clusterDescription}>{description}</Text>
    </Card>
  );
});

// Add this helper function before the FeaturedEvent component
const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return "TODAY";
  }

  if (diffDays <= 7) {
    return `${diffDays}D`;
  }

  const diffWeeks = Math.ceil(diffDays / 7);
  return `${diffWeeks}W`;
};

// Memoized FeaturedEvent component
const FeaturedEvent = memo<{
  event: EventType;
  onPress: () => void;
}>(({ event, onPress }) => {
  const eventDate = new Date(event.eventDate);
  const timeString = getRelativeTimeString(eventDate);
  const isToday = timeString === "TODAY";

  return (
    <Card>
      <View style={styles.featuredEventContent}>
        <View style={[styles.timeBadge, isToday && styles.timeBadgeToday]}>
          <Text style={[styles.timeBadgeText, isToday && styles.timeBadgeTextToday]}>
            {timeString}
          </Text>
        </View>

        <View style={styles.featuredEventHeader}>
          <View style={styles.featuredEventEmoji}>
            <Text style={{ fontSize: 16 }}>{event.emoji || "🎉"}</Text>
          </View>
          <Text style={styles.featuredEventTitle} numberOfLines={1}>
            {event.title}
          </Text>
        </View>

        <View style={styles.divider} />

        {event.description && (
          <Text style={styles.featuredEventDescription} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        <View style={styles.featuredEventDetails}>
          <View style={styles.featuredEventDetail}>
            <Calendar size={10} color={COLORS.textSecondary} />
            <Text style={styles.featuredEventDetailText}>{eventDate.toLocaleDateString()}</Text>
          </View>
          <View style={styles.featuredEventDetail}>
            <MapPin size={10} color={COLORS.textSecondary} />
            <Text style={styles.featuredEventDetailText} numberOfLines={1}>
              {truncateText(event.location)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
});

// Memoized EventsListSection component
const EventsListSection = memo<EventsListSectionProps>(
  ({
    title,
    icon: Icon,
    events,
    onEventPress,
    onPageChange,
    currentPage,
    useScrollView = false,
  }) => {
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
      if (currentPage !== undefined && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: currentPage,
          animated: true,
        });
      }
    }, [currentPage]);

    const renderItem = useCallback(
      ({ item, index }: { item: EventType; index: number }) => (
        <AnimatedEventCard event={item} onPress={() => onEventPress(item)} index={index} />
      ),
      [onEventPress]
    );

    const keyExtractor = useCallback((item: EventType) => item.id, []);

    return (
      <View style={styles.eventsListContainer}>
        <View style={styles.listHeader}>
          <Icon size={18} color={COLORS.accent} />
          <Text style={styles.listHeaderText}>{title}</Text>
        </View>
        <View style={styles.eventsListInner}>
          {events.length === 0 ? (
            <View style={[styles.emptyListContainer, { height: 450 }]}>
              <Text style={styles.emptyListText}>No events found</Text>
            </View>
          ) : useScrollView ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {events.map((event, index) => (
                <AnimatedEventCard
                  key={event.id}
                  event={event}
                  onPress={() => onEventPress(event)}
                  index={index}
                />
              ))}
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              data={events}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingBottom: 16 }}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: 80,
                offset: 80 * index,
                index,
              })}
            />
          )}
        </View>
      </View>
    );
  }
);

// Main component
const ClusterEventsView: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"categories" | "locations" | "today">("categories");
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [currentLocationIndex, setCurrentLocationIndex] = useState<number>(0);
  const [hubData, setHubData] = useState<HubDataType | null>(null);

  const scrollY = useSharedValue(0);
  const markers = useLocationStore((state) => state.markers);
  const selectedItem = useLocationStore((state) => state.selectedItem);

  // Animation for header
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [0, 50], [1, 0.98]),
      transform: [
        {
          translateY: interpolate(scrollY.value, [0, 50], [0, -2]),
        },
      ],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Memoized handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabPress = useCallback((tab: "categories" | "locations" | "today") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const handleEventPress = useCallback(
    (event: EventType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/details?eventId=${event.id}` as never);
    },
    [router]
  );

  // Memoized fetch function
  const fetchClusterHubData = useCallback(async () => {
    try {
      setIsLoading(true);
      const markerIds =
        selectedItem?.type === "cluster"
          ? (selectedItem as any).childrenIds || []
          : markers.map((marker) => marker.id);

      if (markerIds.length === 0) {
        throw new Error("No markers found");
      }

      const data = await apiClient.getClusterHubData(markerIds);
      setHubData(data);
    } catch (error) {
      console.error("Error fetching cluster hub data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [markers, selectedItem]);

  useEffect(() => {
    fetchClusterHubData();
  }, [fetchClusterHubData]);

  // Memoized page indicators
  const renderCategoryPageIndicator = useMemo(() => {
    if (!hubData?.eventsByCategory.length) return null;

    return (
      <View style={styles.pageIndicator}>
        {hubData.eventsByCategory.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentCategoryIndex && styles.activeDot]}
          />
        ))}
      </View>
    );
  }, [hubData?.eventsByCategory, currentCategoryIndex]);

  const renderLocationPageIndicator = useMemo(() => {
    if (!hubData?.eventsByLocation.length) return null;

    return (
      <View style={styles.pageIndicator}>
        {hubData.eventsByLocation.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentLocationIndex && styles.activeDot]}
          />
        ))}
      </View>
    );
  }, [hubData?.eventsByLocation, currentLocationIndex]);

  // Move these hook declarations outside of useMemo
  const renderCategoryItem = useCallback(
    ({ item }: { item: { category: CategoryType; events: EventType[] } }) => (
      <View style={{ width: SCREEN_WIDTH - 32 }}>
        <EventsListSection
          title={item.category.name}
          icon={Tag}
          events={item.events}
          onEventPress={handleEventPress}
        />
      </View>
    ),
    [handleEventPress]
  );

  const renderLocationItem = useCallback(
    ({ item }: { item: { location: string; events: EventType[] } }) => (
      <View style={{ width: SCREEN_WIDTH - 32 }}>
        <EventsListSection
          title={item.location}
          icon={MapPin}
          events={item.events}
          onEventPress={handleEventPress}
        />
      </View>
    ),
    [handleEventPress]
  );

  const categoryKeyExtractor = useCallback(
    (item: { category: CategoryType; events: EventType[] }) => item.category.id,
    []
  );
  const locationKeyExtractor = useCallback(
    (item: { location: string; events: EventType[] }) => item.location,
    []
  );

  // Now useMemo can use these memoized functions
  const renderActiveTabContent = useMemo(() => {
    if (!hubData) return null;

    switch (activeTab) {
      case "categories":
        return (
          <>
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={hubData.eventsByCategory}
              keyExtractor={categoryKeyExtractor}
              renderItem={renderCategoryItem}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (newIndex !== currentCategoryIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentCategoryIndex(newIndex);
                }
              }}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH - 32,
                offset: (SCREEN_WIDTH - 32) * index,
                index,
              })}
            />
            {renderCategoryPageIndicator}
          </>
        );
      case "locations":
        return (
          <>
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={hubData.eventsByLocation}
              keyExtractor={locationKeyExtractor}
              renderItem={renderLocationItem}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                if (newIndex !== currentLocationIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentLocationIndex(newIndex);
                }
              }}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH - 32,
                offset: (SCREEN_WIDTH - 32) * index,
                index,
              })}
            />
            {renderLocationPageIndicator}
          </>
        );
      case "today":
        return (
          <EventsListSection
            title="Events Today"
            icon={Calendar}
            events={hubData.eventsToday}
            onEventPress={handleEventPress}
            useScrollView={true}
          />
        );
      default:
        return null;
    }
  }, [
    hubData,
    activeTab,
    currentCategoryIndex,
    currentLocationIndex,
    handleEventPress,
    renderCategoryPageIndicator,
    renderLocationPageIndicator,
    renderCategoryItem,
    renderLocationItem,
    categoryKeyExtractor,
    locationKeyExtractor,
  ]);

  // Memoized main content
  const renderContent = useMemo(() => {
    if (!hubData) return null;

    type TabValue = "categories" | "locations" | "today";

    const tabItems: TabItem<TabValue>[] = [
      { icon: Tag, label: "Categories", value: "categories" },
      { icon: MapPin, label: "Locations", value: "locations" },
      { icon: Calendar, label: "Today", value: "today" },
    ];

    return (
      <>
        <Animated.View
          style={styles.featuredSection}
          entering={FadeInDown.duration(600).delay(100).springify()}
          layout={LinearTransition.springify()}
        >
          <View style={styles.featuredTitle}>
            <Text style={styles.featuredTitleIcon}>⭐️</Text>
            <Text style={styles.featuredTitleText}>Featured</Text>
          </View>

          {hubData.featuredEvent ? (
            <FeaturedEvent
              event={hubData.featuredEvent}
              onPress={() => handleEventPress(hubData.featuredEvent as EventType)}
            />
          ) : (
            <Card>
              <View style={{ padding: 24, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: COLORS.textSecondary, fontFamily: "SpaceMono" }}>
                  No featured event available
                </Text>
              </View>
            </Card>
          )}
        </Animated.View>

        <Animated.View
          style={styles.sectionContainer}
          entering={FadeInDown.duration(600).delay(50).springify()}
          layout={LinearTransition.springify()}
        >
          <View style={styles.clusterNameContainer}>
            <Text style={styles.clusterEmoji}>{hubData.clusterEmoji}</Text>
            <Text style={styles.clusterName}>{hubData.clusterName}</Text>
          </View>
          <ClusterDescription description={hubData.clusterDescription} />
        </Animated.View>

        <Tabs<TabValue>
          items={tabItems}
          activeTab={activeTab}
          onTabPress={handleTabPress}
          delay={200}
        />

        <Animated.View
          entering={FadeInDown.duration(600).delay(300).springify()}
          layout={LinearTransition.springify()}
        >
          {renderActiveTabContent}
        </Animated.View>
      </>
    );
  }, [hubData, activeTab, handleTabPress, handleEventPress, renderActiveTabContent]);

  // Render loading state
  if (isLoading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // If no data
  if (!hubData) {
    return null;
  }

  return (
    <ScreenLayout>
      <Header title="Cluster" onBack={handleBack} style={headerAnimatedStyle} />

      <Animated.ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={true}
      >
        {renderContent}
      </Animated.ScrollView>
    </ScreenLayout>
  );
};

export default ClusterEventsView;
