import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocationStore } from "@/stores/useLocationStore";
import apiClient from "@/services/ApiClient";
import { ArrowLeft, Calendar, MapPin, Tag, Star, TrendingUp, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedScrollHandler, interpolate, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Types
interface CategoryType {
  id: string;
  name: string;
}

interface EventType {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
  location: string;
  eventDate: string;
  category?: CategoryType;
  imageUrl?: string;
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
}

// Theme
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  cardBackgroundAlt: "#232323",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  accentDark: "#3b82f6",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(147, 197, 253, 0.1)",
  buttonBorder: "rgba(255, 255, 255, 0.05)",
  shadow: "rgba(0, 0, 0, 0.5)",
};

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
    paddingBottom: 32,
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
  featuredEvent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  featuredImageContainer: {
    width: "100%",
    height: 200,
    backgroundColor: COLORS.cardBackground,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  featuredEmojiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredTag: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  featuredTagText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  featuredEventContent: {
    padding: 24,
  },
  featuredEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    letterSpacing: -0.2,
    marginBottom: 16,
    lineHeight: 32,
  },
  featuredEventDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 20,
  },
  featuredEventDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featuredEventDetail: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  featuredEventDetailText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    marginLeft: 8,
  },
  // Tab styles
  tabsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    padding: 4,
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
    minHeight: 200,
  },
  eventsListInner: {
    flex: 1,
  },
  listHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
  },
  listHeaderText: {
    color: COLORS.textPrimary,
    fontSize: 14,
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

// Memoized TabButton
const TabButton = React.memo<{
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

// Memoized EventCard
const EventCard = React.memo<{
  event: EventType;
  onPress: () => void;
}>(({ event, onPress }) => (
  <TouchableOpacity
    style={styles.eventCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.eventEmojiContainer}>
      <Text style={styles.eventEmojiText}>{event.emoji || "🎉"}</Text>
    </View>
    <View style={styles.eventInfo}>
      <Text style={styles.eventTitle} numberOfLines={1} ellipsizeMode="tail">
        {event.title}
      </Text>
      <View style={styles.eventDetails}>
        <View style={styles.eventDetail}>
          <Calendar size={12} color={COLORS.textSecondary} />
          <Text style={styles.eventDetailText}>
            {new Date(event.eventDate).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.eventDetail}>
          <MapPin size={12} color={COLORS.textSecondary} />
          <Text style={styles.eventDetailText} numberOfLines={1}>
            {event.location}
          </Text>
        </View>
      </View>
    </View>
    <View style={styles.eventActions}>
      <View style={styles.chevronContainer}>
        <ChevronRight size={16} color={COLORS.textSecondary} />
      </View>
    </View>
  </TouchableOpacity>
));

// Memoized EventsListSection
const EventsListSection = React.memo<{
  title: string;
  icon: React.ElementType;
  events: EventType[];
  onEventPress: (event: EventType) => void;
  onPageChange?: (index: number) => void;
  currentPage?: number;
}>(({ title, icon: Icon, events, onEventPress, onPageChange, currentPage }) => {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (currentPage !== undefined && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: currentPage,
        animated: true,
      });
    }
  }, [currentPage]);

  const renderEventCard = useCallback(({ item }: { item: EventType }) => (
    <EventCard event={item} onPress={() => onEventPress(item)} />
  ), [onEventPress]);

  return (
    <View style={styles.eventsListContainer}>
      <View style={styles.eventsListInner}>
        {events.length === 0 ? (
          <View style={styles.emptyListContainer}>
            <Text style={styles.emptyListText}>No events found</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={events}
            renderItem={renderEventCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            nestedScrollEnabled={true}
          />
        )}
      </View>
    </View>
  );
});

// Memoized FeaturedEvent
const FeaturedEvent = React.memo<{
  event: EventType;
  onPress: () => void;
}>(({ event, onPress }) => {
  const emojiScale = useSharedValue(1);
  const emojiOffset = useSharedValue(0);

  useEffect(() => {
    emojiScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    emojiOffset.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const emojiAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: emojiScale.value },
        { translateY: emojiOffset.value }
      ]
    };
  });

  const eventDate = useMemo(() => new Date(event.eventDate), [event.eventDate]);
  const isToday = useMemo(() => eventDate.toDateString() === new Date().toDateString(), [eventDate]);
  const isTomorrow = useMemo(() => {
    const tomorrow = new Date(eventDate);
    tomorrow.setDate(tomorrow.getDate() - 1);
    return tomorrow.toDateString() === new Date().toDateString();
  }, [eventDate]);

  const renderCategoryTag = useMemo(() => {
    if (!event.category) return null;
    return (
      <View style={[styles.featuredTag, {
        top: 16,
        right: 16,
        left: 'auto',
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        borderColor: "rgba(255, 255, 255, 0.3)",
      }]}>
        <Tag size={12} color={COLORS.textPrimary} />
        <Text style={[styles.featuredTagText, { color: COLORS.textPrimary }]}>
          {event.category.name}
        </Text>
      </View>
    );
  }, [event.category]);

  const renderDateTag = useMemo(() => (
    <View style={[styles.featuredTag, {
      top: 16,
      right: event.category ? 120 : 16,
      left: 'auto',
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      borderColor: "rgba(255, 255, 255, 0.3)",
    }]}>
      <Calendar size={12} color={COLORS.textPrimary} />
      <Text style={[styles.featuredTagText, { color: COLORS.textPrimary }]}>
        {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : eventDate.toLocaleDateString()}
      </Text>
    </View>
  ), [event.category, eventDate, isToday, isTomorrow]);

  return (
    <TouchableOpacity
      style={styles.featuredEvent}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.featuredImageContainer}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={styles.featuredImage} />
        ) : (
          <View style={styles.featuredEmojiContainer}>
            <Animated.View style={emojiAnimatedStyle}>
              <Text style={{ fontSize: 48 }}>{event.emoji || "🎉"}</Text>
            </Animated.View>
          </View>
        )}
        <View style={styles.featuredTag}>
          <Star size={12} color={COLORS.accent} />
          <Text style={styles.featuredTagText}>FEATURED</Text>
        </View>
        {renderCategoryTag}
        {renderDateTag}
      </View>

      <View style={styles.featuredEventContent}>
        <Text style={styles.featuredEventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {event.description && (
          <Text style={styles.featuredEventDescription} numberOfLines={3}>
            {event.description}
          </Text>
        )}
        <View style={styles.featuredEventDetails}>
          <View style={styles.featuredEventDetail}>
            <Calendar size={16} color={COLORS.textSecondary} />
            <Text style={styles.featuredEventDetailText}>
              {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.featuredEventDetail}>
            <MapPin size={16} color={COLORS.textSecondary} />
            <Text style={styles.featuredEventDetailText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

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

  // Memoized handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleTabPress = useCallback((tab: "categories" | "locations" | "today") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const handleEventPress = useCallback((event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/details?eventId=${event.id}` as never);
  }, [router]);

  // Animation for header
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [0, 50],
        [1, 0.98]
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, 50],
            [0, -2]
          ),
        },
      ],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Fetch data
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

  // Memoized render functions
  const renderCategoryPageIndicator = useMemo(() => {
    if (!hubData?.eventsByCategory.length) return null;

    return (
      <View style={styles.pageIndicator}>
        {hubData.eventsByCategory.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentCategoryIndex && styles.activeDot,
            ]}
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
            style={[
              styles.dot,
              index === currentLocationIndex && styles.activeDot,
            ]}
          />
        ))}
      </View>
    );
  }, [hubData?.eventsByLocation, currentLocationIndex]);

  // Memoized tab content
  const renderActiveTabContent = useMemo(() => {
    switch (activeTab) {
      case "categories":
        return (
          <>
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={hubData?.eventsByCategory || []}
              keyExtractor={(item) => item.category.id}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                if (newIndex !== currentCategoryIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentCategoryIndex(newIndex);
                }
              }}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH - 32 }}>
                  <EventsListSection
                    title={item.category.name}
                    icon={Tag}
                    events={item.events}
                    onEventPress={handleEventPress}
                  />
                </View>
              )}
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
              data={hubData?.eventsByLocation || []}
              keyExtractor={(item) => item.location}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                if (newIndex !== currentLocationIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentLocationIndex(newIndex);
                }
              }}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH - 32 }}>
                  <EventsListSection
                    title={item.location}
                    icon={MapPin}
                    events={item.events}
                    onEventPress={handleEventPress}
                  />
                </View>
              )}
            />
            {renderLocationPageIndicator}
          </>
        );
      case "today":
        return (
          <EventsListSection
            title="Events Today"
            icon={Calendar}
            events={hubData?.eventsToday || []}
            onEventPress={handleEventPress}
          />
        );
      default:
        return null;
    }
  }, [activeTab, hubData, currentCategoryIndex, currentLocationIndex, handleEventPress, renderCategoryPageIndicator, renderLocationPageIndicator]);

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no data
  if (!hubData) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover Events</Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Featured Event Section */}
        <View style={styles.sectionContainer}>
          {hubData?.featuredEvent ? (
            <FeaturedEvent
              event={hubData.featuredEvent}
              onPress={() => handleEventPress(hubData.featuredEvent as EventType)}
            />
          ) : (
            <View style={[styles.featuredEvent, { padding: 24, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: COLORS.textSecondary, fontFamily: 'SpaceMono' }}>
                No featured event available
              </Text>
            </View>
          )}
        </View>

        {/* Tab Section */}
        <View style={styles.tabsContainer}>
          <TabButton
            icon={Tag}
            label="Categories"
            isActive={activeTab === "categories"}
            onPress={() => handleTabPress("categories")}
          />
          <TabButton
            icon={MapPin}
            label="Locations"
            isActive={activeTab === "locations"}
            onPress={() => handleTabPress("locations")}
          />
          <TabButton
            icon={Calendar}
            label="Today"
            isActive={activeTab === "today"}
            onPress={() => handleTabPress("today")}
          />
        </View>

        {/* Render content based on active tab */}
        {renderActiveTabContent}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default React.memo(ClusterEventsView);