import apiClient from "@/services/ApiClient";
import { useLocationStore } from "@/stores/useLocationStore";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, MapPin, Tag, Check } from "lucide-react-native"; // Added ArrowLeft and Check
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
  Clipboard,
} from "react-native";
import Animated, {
  Extrapolate, // Added Extrapolate
  FadeInDown,
  interpolate,
  Layout,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import EventItem from "../EventItem/EventItem";
import Card from "../Layout/Card";
// import Header from "../Layout/Header"; // We'll integrate header functionality
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import Tabs, { TabItem } from "../Layout/Tabs";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Types (assuming these are the same)
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
  featuredCreator?: {
    id: string;
    displayName: string;
    email: string;
    eventCount: number;
    creatorDescription: string;
    title: string;
    friendCode: string;
  };
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
    // Kept for reference if ScreenLayout changes
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: COLORS.background, // Ensure scrollview has background
  },
  contentContainer: {
    paddingBottom: 32, // Added more bottom padding
    // No horizontal padding here, sections will manage their own
  },

  // NEW: Zone Banner Styles
  zoneBanner: {
    paddingTop: 50, // For status bar and back button
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: COLORS.cardBackground, // Or a slightly different shade if available
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)", // COLORS.divider,
    // marginBottom: 24, // Spacing before next section
  },
  bannerBackButton: {
    position: "absolute",
    top: 48, // Adjust for status bar height
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  zoneBannerEmoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "SpaceMono", // Ensure consistent font if emoji isn't pure image
  },
  zoneBannerName: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  zoneBannerDescription: {
    color: COLORS.textSecondary, // Use textSecondary for descriptions
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.3,
    paddingHorizontal: 10, // Keep description from being too wide
  },

  // NEW: Zone Highlights Section Styles
  zoneHighlightsSection: {
    paddingHorizontal: 16, // Consistent horizontal padding for sections
    marginTop: 24,
    marginBottom: 16, // Add some space before "Explore"
  },
  highlightBlock: {
    marginBottom: 24,
  },
  highlightBlockTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4, // Slight indent
  },
  highlightBlockTitleEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  highlightBlockTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  featuredCreatorDivider: {
    // Kept this as it was, might be fine
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginTop: 18,
    marginBottom: 12,
    marginHorizontal: 2,
    borderRadius: 1,
  },
  // No changes to FeaturedEvent or FeaturedCreator internal styles needed, they are in Cards

  // NEW: Explore Zone Title
  exploreZoneTitleContainer: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24, // After highlights
    marginBottom: 12, // Before tabs
    marginLeft: 4,
  },
  exploreZoneTitleEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  exploreZoneTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Tab and List Styles (largely reusable, but ensure horizontal padding for content)
  tabsContainerWrapper: {
    // Wrapper for Tabs to apply horizontal padding
    paddingHorizontal: 16,
    marginVertical: 16, // Adjusted margin
  },
  tabContentWrapper: {
    // Wrapper for active tab content
    paddingHorizontal: 16, // Ensures FlatLists inside also have padding
  },
  tabsContainer: {
    // Existing style, ensure it works with wrapper
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
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
  eventsListContainer: {
    // Make sure this adapts if SCREEN_WIDTH changes due to padding
    // width: "100%", // This will be full width of its container
    height: 450, // Keep if it works
    marginBottom: 0,
  },
  eventsListInner: {
    flex: 1,
    height: 450,
  },
  listHeader: {
    paddingVertical: 12, // Removed horizontal padding, handled by parent
    paddingHorizontal: 0, // Handled by parent
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
  // EventItem styles are external, assumed fine
  // Page indicator styles are fine
  pageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16, // Added margin below indicator
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
    backgroundColor: COLORS.background, // Ensure consistent background
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  // Updated Featured Event Styles
  featuredEventContent: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredEventMainContent: {
    marginTop: 8,
  },
  timeBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeBadgeToday: {
    backgroundColor: "rgba(147, 197, 253, 0.25)",
    borderColor: "rgba(147, 197, 253, 0.5)",
  },
  timeBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timeBadgeTextToday: {
    color: COLORS.accent,
  },
  featuredEventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    paddingRight: 70, // For time badge
  },
  featuredEventEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featuredEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SpaceMono",
    letterSpacing: -0.3,
    flex: 1,
    lineHeight: 26,
  },
  featuredEventDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    marginBottom: 16,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  featuredEventDetails: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  featuredEventDetail: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
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
    marginLeft: 6,
    fontWeight: "500",
  },
  // Updated Featured Creator Styles
  featuredCreatorContent: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredCreatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  featuredCreatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featuredCreatorAvatarText: {
    fontSize: 18,
    color: COLORS.accent,
    fontWeight: "700",
    fontFamily: "SpaceMono",
  },
  featuredCreatorInfo: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  featuredCreatorName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  featuredCreatorStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredCreatorStat: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  featuredCreatorStatText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  featuredCreatorDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    letterSpacing: 0.2,
    opacity: 0.9,
    marginBottom: 16,
  },
  featuredCreatorFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 12,
  },
  friendCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  friendCodeLeft: {
    flex: 1,
  },
  friendCodeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 2,
  },
  friendCode: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  copyButton: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
    marginLeft: 12,
  },
  copyButtonSuccess: {
    backgroundColor: "rgba(147, 197, 253, 0.25)",
    borderColor: "rgba(147, 197, 253, 0.5)",
  },
  copyButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

// Memoized TabButton component (no change)
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

// Memoized AnimatedEventCard component (no change)
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

// Truncate and Relative Time helpers (no change)
const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

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
  if (diffDays === 1) return "TOM"; // Tomorrow
  if (diffDays > 1 && diffDays <= 7) {
    return `${diffDays}D`;
  }
  const diffWeeks = Math.ceil(diffDays / 7);
  if (diffWeeks > 0 && diffWeeks <= 4) return `${diffWeeks}W`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // Fallback
};

// Memoized FeaturedEvent component (no change to internal structure, just used differently)
const FeaturedEvent = memo<{
  event: EventType;
  onPress: () => void;
}>(({ event, onPress }) => {
  const eventDate = new Date(event.eventDate);
  const timeString = getRelativeTimeString(eventDate);
  const isToday = timeString === "TODAY";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.featuredEventContent}>
        {/* Time Badge */}
        <View style={[styles.timeBadge, isToday && styles.timeBadgeToday]}>
          <Text style={[styles.timeBadgeText, isToday && styles.timeBadgeTextToday]}>
            {timeString}
          </Text>
        </View>

        {/* Main Content Area */}
        <View style={styles.featuredEventMainContent}>
          {/* Title and Emoji Row */}
          <View style={styles.featuredEventHeader}>
            <View style={styles.featuredEventEmoji}>
              <Text style={{ fontSize: 20 }}>{event.emoji || "🎉"}</Text>
            </View>
            <Text style={styles.featuredEventTitle} numberOfLines={2}>
              {event.title}
            </Text>
          </View>

          {/* Description */}
          {event.description && (
            <Text style={styles.featuredEventDescription} numberOfLines={3}>
              {event.description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Memoized FeaturedCreator component (no change to internal structure)
const FeaturedCreator = memo<{
  creator: {
    id: string;
    displayName: string;
    email: string;
    eventCount: number;
    creatorDescription: string;
    title: string;
    friendCode: string;
  };
}>(({ creator }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = useCallback(async () => {
    await Clipboard.setString(creator.friendCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [creator.friendCode]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  console.log(creator);

  return (
    <View style={styles.featuredCreatorContent}>
      <View style={styles.featuredCreatorHeader}>
        <View style={styles.featuredCreatorAvatar}>
          <Text style={styles.featuredCreatorAvatarText}>{getInitials(creator.displayName)}</Text>
        </View>
        <View style={styles.featuredCreatorInfo}>
          <Text style={styles.featuredCreatorName}>{creator.displayName}</Text>
          <View style={styles.featuredCreatorStats}>
            <View style={styles.featuredCreatorStat}>
              <Text style={styles.featuredCreatorStatText}>{creator.eventCount} Events</Text>
            </View>
            <View style={styles.featuredCreatorStat}>
              <Text style={styles.featuredCreatorStatText}>{creator.title}</Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.featuredCreatorDescription} numberOfLines={2}>
        {creator.creatorDescription}
      </Text>
      <View style={styles.featuredCreatorFooter}>
        <TouchableOpacity
          style={styles.friendCodeContainer}
          onPress={handleCopyCode}
          activeOpacity={0.7}
        >
          <View style={styles.friendCodeLeft}>
            <Text style={styles.friendCodeLabel}>Friend Code</Text>
            <Text style={styles.friendCode}>{creator.friendCode}</Text>
          </View>
          <View style={[styles.copyButton, copied && styles.copyButtonSuccess]}>
            {copied ? (
              <Check size={16} color={COLORS.accent} />
            ) : (
              <Text style={styles.copyButtonText}>Copy</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Memoized EventsListSection component (no change to internal structure)
const EventsListSection = memo<EventsListSectionProps>(
  ({ title, icon: Icon, events, onEventPress, useScrollView = false }) => {
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
            <View
              style={[styles.emptyListContainer, { height: 450 - 50 /* approx header height */ }]}
            >
              <Text style={styles.emptyListText}>No events found for "{title}"</Text>
            </View>
          ) : useScrollView ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              nestedScrollEnabled // Important for scrollview inside scrollview
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
                length: 80, // Approx height of EventItem
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

  // Animation for the Zone Banner
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => {
    const bannerPaddingVertical = interpolate(scrollY.value, [0, 100], [24, 12], Extrapolate.CLAMP);
    const emojiSize = interpolate(scrollY.value, [0, 100], [48, 32], Extrapolate.CLAMP);
    const nameSize = interpolate(scrollY.value, [0, 100], [28, 20], Extrapolate.CLAMP);
    const nameMarginBottom = interpolate(scrollY.value, [0, 100], [8, 4], Extrapolate.CLAMP);
    const descriptionOpacity = interpolate(scrollY.value, [0, 50], [1, 0], Extrapolate.CLAMP);

    return {
      paddingBottom: bannerPaddingVertical,
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
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

  const fetchClusterHubData = useCallback(async () => {
    try {
      setIsLoading(true);
      const markerIds =
        selectedItem?.type === "cluster"
          ? (selectedItem as any).childrenIds || []
          : markers.map((marker) => marker.id);

      if (markerIds.length === 0) {
        console.warn("No marker IDs provided for cluster hub.");
        setHubData(null);
        setIsLoading(false);
        return;
      }

      const data = await apiClient.getClusterHubData(markerIds);
      setHubData(data);
    } catch (error) {
      console.error("Error fetching cluster hub data:", error);
      setHubData(null);
    } finally {
      setIsLoading(false);
    }
  }, [markers, selectedItem]);

  useEffect(() => {
    fetchClusterHubData();
  }, [fetchClusterHubData]);

  // Memoized page indicators
  const renderCategoryPageIndicator = useMemo(() => {
    if (!hubData?.eventsByCategory || hubData.eventsByCategory.length <= 1) return null;
    return (
      <View style={styles.pageIndicator}>
        {hubData.eventsByCategory.map((_, index) => (
          <View
            key={`cat-dot-${index}`}
            style={[styles.dot, index === currentCategoryIndex && styles.activeDot]}
          />
        ))}
      </View>
    );
  }, [hubData?.eventsByCategory, currentCategoryIndex]);

  const renderLocationPageIndicator = useMemo(() => {
    if (!hubData?.eventsByLocation || hubData.eventsByLocation.length <= 1) return null;
    return (
      <View style={styles.pageIndicator}>
        {hubData.eventsByLocation.map((_, index) => (
          <View
            key={`loc-dot-${index}`}
            style={[styles.dot, index === currentLocationIndex && styles.activeDot]}
          />
        ))}
      </View>
    );
  }, [hubData?.eventsByLocation, currentLocationIndex]);

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
          title={truncateText(item.location, 25)}
          icon={MapPin}
          events={item.events}
          onEventPress={handleEventPress}
        />
      </View>
    ),
    [handleEventPress]
  );

  const categoryKeyExtractor = useCallback(
    (item: { category: CategoryType; events: EventType[] }) => `cat-${item.category.id}`,
    []
  );

  const locationKeyExtractor = useCallback(
    (item: { location: string; events: EventType[] }) => `loc-${item.location}`,
    []
  );

  const renderActiveTabContent = useMemo(() => {
    if (!hubData) return null;

    const itemWidth = SCREEN_WIDTH - (styles.tabContentWrapper.paddingHorizontal || 0) * 2;

    switch (activeTab) {
      case "categories":
        if (!hubData.eventsByCategory || hubData.eventsByCategory.length === 0) {
          return (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>No events found by category.</Text>
            </View>
          );
        }
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
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
                if (newIndex !== currentCategoryIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentCategoryIndex(newIndex);
                }
              }}
              getItemLayout={(data, index) => ({
                length: itemWidth,
                offset: itemWidth * index,
                index,
              })}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
            />
            {renderCategoryPageIndicator}
          </>
        );
      case "locations":
        if (!hubData.eventsByLocation || hubData.eventsByLocation.length === 0) {
          return (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>No events found by location.</Text>
            </View>
          );
        }
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
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
                if (newIndex !== currentLocationIndex) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCurrentLocationIndex(newIndex);
                }
              }}
              getItemLayout={(data, index) => ({
                length: itemWidth,
                offset: itemWidth * index,
                index,
              })}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
            />
            {renderLocationPageIndicator}
          </>
        );
      case "today":
        if (!hubData.eventsToday || hubData.eventsToday.length === 0) {
          return (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>No events happening today.</Text>
            </View>
          );
        }
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

  // Animated styles for individual banner elements
  const animatedBannerEmojiStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [48, 32], Extrapolate.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, 100], [12, 6], Extrapolate.CLAMP),
  }));

  const animatedBannerNameStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, 100], [28, 22], Extrapolate.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, 100], [8, 4], Extrapolate.CLAMP),
  }));

  const animatedBannerDescriptionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, 50], [1, 0.95], Extrapolate.CLAMP) }],
  }));

  // Loading state
  if (isLoading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Summoning Zone Intel...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // If no hub data after loading
  if (!hubData || !hubData.clusterName) {
    return (
      <ScreenLayout>
        <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyListText}>🚫 Zone not found or no activities here.</Text>
        </View>
      </ScreenLayout>
    );
  }

  // Main content rendering
  type TabValue = "categories" | "locations" | "today";
  const tabItems: TabItem<TabValue>[] = [
    { icon: Tag, label: "Categories", value: "categories" },
    { icon: MapPin, label: "Locations", value: "locations" },
    { icon: Calendar, label: "Today", value: "today" },
  ];

  return (
    <ScreenLayout>
      <Animated.ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* 1. Zone Banner */}
        <Animated.View
          style={[styles.zoneBanner, zoneBannerAnimatedStyle]}
          layout={LinearTransition.springify()}
        >
          <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Animated.Text style={[styles.zoneBannerEmoji, animatedBannerEmojiStyle]}>
            {hubData.clusterEmoji}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerName, animatedBannerNameStyle]}>
            {hubData.clusterName}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerDescription, animatedBannerDescriptionStyle]}>
            {hubData.clusterDescription}
          </Animated.Text>
        </Animated.View>

        {/* 2. Zone Highlights */}
        <Animated.View
          style={styles.zoneHighlightsSection}
          entering={FadeInDown.duration(500).delay(100)}
          layout={LinearTransition.springify()}
        >
          {hubData.featuredEvent && (
            <View style={styles.highlightBlock}>
              <View style={styles.highlightBlockTitleContainer}>
                <Text style={styles.highlightBlockTitleEmoji}>🔥</Text>
                <Text style={styles.highlightBlockTitle}>Hot Ticket</Text>
              </View>
              <FeaturedEvent
                event={hubData.featuredEvent}
                onPress={() => handleEventPress(hubData.featuredEvent as EventType)}
              />
            </View>
          )}
          {hubData.featuredCreator && (
            <View style={styles.highlightBlock}>
              <View style={styles.highlightBlockTitleContainer}>
                <Text style={styles.highlightBlockTitleEmoji}>✨</Text>
                <Text style={styles.highlightBlockTitle}>Local Spark</Text>
              </View>
              <FeaturedCreator creator={hubData.featuredCreator} />
            </View>
          )}
        </Animated.View>

        {/* 3. Explore the Zone */}
        {(hubData.eventsByCategory?.length > 0 ||
          hubData.eventsByLocation?.length > 0 ||
          hubData.eventsToday?.length > 0) && (
          <>
            <Animated.View
              style={styles.exploreZoneTitleContainer}
              entering={FadeInDown.duration(500).delay(200)}
              layout={LinearTransition.springify()}
            >
              <Text style={styles.exploreZoneTitleEmoji}>🗺️</Text>
              <Text style={styles.exploreZoneTitle}>Explore This Zone</Text>
            </Animated.View>
            <View style={styles.tabsContainerWrapper}>
              <Tabs<TabValue>
                items={tabItems}
                activeTab={activeTab}
                onTabPress={handleTabPress}
                // delay prop removed if not used by your Tabs component, or keep if it is
              />
            </View>
            <Animated.View
              style={styles.tabContentWrapper}
              entering={FadeInDown.duration(500).delay(300)}
              layout={LinearTransition.springify()}
            >
              {renderActiveTabContent}
            </Animated.View>
          </>
        )}
      </Animated.ScrollView>
    </ScreenLayout>
  );
};

export default ClusterEventsView;
