import React, { useCallback, useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import ScreenLayout from "@/components/Layout/ScreenLayout";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import {
  ArrowLeft,
  Users,
  MapPin,
  Tag,
  Globe,
  Search,
  X,
  Calendar,
  Plus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolate,
  FadeInDown,
  interpolate,
  Layout,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { EventType } from "@/types/types";
import EventList from "@/components/EventList/EventList";
import Input from "@/components/Input/Input";
import GroupMembership from "@/components/GroupMembership/GroupMembership";

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupEvents, setGroupEvents] = useState<EventType[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isFetchingMoreEvents, setIsFetchingMoreEvents] = useState(false);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [eventsCursor, setEventsCursor] = useState<string | undefined>(undefined);
  const [eventsSearchQuery, setEventsSearchQuery] = useState("");
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [lastLoadMoreEventsAttempt, setLastLoadMoreEventsAttempt] = useState<number>(0);
  const pageSize = 10;

  // Add refs to track mounted state and prevent state updates after unmount
  const isMounted = useRef(true);
  const eventsSearchTimeoutRef = useRef<NodeJS.Timeout>();

  // Store fetchGroupEvents in a ref to avoid dependency cycle
  const fetchGroupEventsRef = useRef<typeof fetchGroupEvents>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (eventsSearchTimeoutRef.current) {
        clearTimeout(eventsSearchTimeoutRef.current);
      }
    };
  }, []);

  // Animation setup
  const scrollY = useSharedValue(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  }, []);

  // Animation styles
  const zoneBannerAnimatedStyle = useAnimatedStyle(() => {
    const bannerPaddingVertical = interpolate(scrollY.value, [0, 100], [24, 12], Extrapolate.CLAMP);
    return {
      paddingBottom: bannerPaddingVertical,
    };
  });

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

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const handleEventPress = useCallback(
    (event: EventType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`details?eventId=${event.id}` as never);
    },
    [router]
  );

  const fetchGroupEvents = useCallback(
    async (refresh = false) => {
      if (!isMounted.current || !id) return;

      try {
        if (refresh) {
          setIsLoadingEvents(true);
          setEventsCursor(undefined);
          setHasMoreEvents(true);
          setGroupEvents([]);
        } else if (!refresh && !isLoadingEvents) {
          setIsFetchingMoreEvents(true);
        }

        const response = await apiClient.getGroupEvents(id, {
          query: eventsSearchQuery.trim() || undefined,
          limit: pageSize,
          cursor: refresh ? undefined : eventsCursor,
        });

        if (!isMounted.current) return;

        setHasMoreEvents(!!response.nextCursor);
        setEventsCursor(response.nextCursor);

        if (refresh) {
          setGroupEvents(response.events);
        } else {
          // Use Set to efficiently track existing event IDs
          const existingEventIds = new Set(groupEvents.map((event) => event.id));
          const newEvents = response.events.filter((event) => !existingEventIds.has(event.id));

          if (newEvents.length > 0) {
            setGroupEvents((prev) => [...prev, ...newEvents]);
          }
        }

        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        setError("Failed to load group events. Please try again.");
        console.error("Error fetching group events:", err);
      } finally {
        if (isMounted.current) {
          setIsLoadingEvents(false);
          setIsFetchingMoreEvents(false);
          setIsSearchingEvents(false);
        }
      }
    },
    [id, eventsCursor, groupEvents, eventsSearchQuery, isLoadingEvents]
  );

  // Update the ref whenever fetchGroupEvents changes
  useEffect(() => {
    fetchGroupEventsRef.current = fetchGroupEvents;
  }, [fetchGroupEvents]);

  // Effect to handle events search with debounce
  useEffect(() => {
    if (eventsSearchTimeoutRef.current) {
      clearTimeout(eventsSearchTimeoutRef.current);
    }

    if (eventsSearchQuery.trim()) {
      setIsSearchingEvents(true);
      eventsSearchTimeoutRef.current = setTimeout(() => {
        if (isMounted.current && fetchGroupEventsRef.current) {
          setEventsCursor(undefined);
          setHasMoreEvents(true);
          setGroupEvents([]);
          fetchGroupEventsRef.current(true);
        }
      }, 500);
    }

    return () => {
      if (eventsSearchTimeoutRef.current) {
        clearTimeout(eventsSearchTimeoutRef.current);
      }
    };
  }, [eventsSearchQuery]); // Remove fetchGroupEvents from dependencies

  const handleLoadMoreEvents = useCallback(() => {
    if (!hasMoreEvents || isFetchingMoreEvents || !eventsCursor) return;

    const now = Date.now();
    if (now - lastLoadMoreEventsAttempt < 2000) return; // Prevent rapid load more attempts
    setLastLoadMoreEventsAttempt(now);

    fetchGroupEvents();
  }, [
    hasMoreEvents,
    isFetchingMoreEvents,
    eventsCursor,
    fetchGroupEvents,
    lastLoadMoreEventsAttempt,
  ]);

  const handleEventsSearchChange = useCallback((text: string) => {
    setEventsSearchQuery(text);
  }, []);

  const handleClearEventsSearch = useCallback(() => {
    setEventsSearchQuery("");
    setEventsCursor(undefined);
    setHasMoreEvents(true);
    setGroupEvents([]);
    fetchGroupEvents(true);
  }, [fetchGroupEvents]);

  // Add effect to fetch group details on mount
  useEffect(() => {
    async function loadGroupDetails() {
      if (!id) return;

      try {
        setLoading(true);
        const groupData = await apiClient.getGroupById(id);
        if (isMounted.current) {
          setGroup(groupData);
          setError(null);
        }
      } catch (err) {
        if (isMounted.current) {
          setError("Failed to load group details");
          console.error("Error fetching group:", err);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }

    loadGroupDetails();
  }, [id]);

  const renderHeader = useCallback(() => {
    if (!group) return null;

    return (
      <>
        {/* Group Banner */}
        <Animated.View
          style={[styles.zoneBanner, zoneBannerAnimatedStyle]}
          layout={LinearTransition.springify()}
        >
          <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Animated.Text style={[styles.zoneBannerEmoji, animatedBannerEmojiStyle]}>
            {group.emoji || "👥"}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerName, animatedBannerNameStyle]}>
            {group.name}
          </Animated.Text>
          <Animated.Text style={[styles.zoneBannerDescription, animatedBannerDescriptionStyle]}>
            {group.description || "Join this group to connect with like-minded people"}
          </Animated.Text>
        </Animated.View>

        {/* Group Details Section */}
        <Animated.View
          style={styles.detailsSection}
          entering={FadeInDown.duration(500).delay(100)}
          layout={LinearTransition.springify()}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Globe size={18} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Group Info</Text>
            </View>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Users size={16} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.detailLabel}>Members</Text>
                <Text style={styles.detailValue}>{group.memberCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Globe size={16} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.detailLabel}>Visibility</Text>
                <Text style={styles.detailValue}>{group.visibility}</Text>
              </View>
              {group.address && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <MapPin size={16} color={COLORS.textSecondary} />
                  </View>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{group.address}</Text>
                </View>
              )}
            </View>
          </View>

          {group.categories && group.categories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Tag size={18} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>Categories</Text>
              </View>
              <View style={styles.categoriesContainer}>
                {group.categories.map((category) => (
                  <View key={category.id} style={styles.categoryTag}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Group Members Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={18} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Members</Text>
            </View>
            <View style={styles.membersContainer}>
              <GroupMembership
                groupId={id}
                isOwner={group.ownerId === apiClient.getCurrentUser()?.id}
                isAdmin={false} // You'll need to implement a way to check if user is admin
                onMembershipChange={() => {
                  // Refresh group details when membership changes
                  fetchGroupEvents(true);
                }}
              />
            </View>
          </View>

          {/* Events Section Header */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={18} color={COLORS.accent} />
              <Text style={styles.sectionTitle}>Events</Text>
            </View>
            <View style={styles.eventsContainer}>
              <Input
                placeholder="Search events..."
                value={eventsSearchQuery}
                onChangeText={handleEventsSearchChange}
                icon={Search}
                rightIcon={eventsSearchQuery ? X : undefined}
                onRightIconPress={handleClearEventsSearch}
                loading={isSearchingEvents}
                style={styles.searchInput}
              />
            </View>
          </View>
        </Animated.View>
      </>
    );
  }, [
    group,
    handleBack,
    handleEventsSearchChange,
    handleClearEventsSearch,
    eventsSearchQuery,
    isSearchingEvents,
    zoneBannerAnimatedStyle,
    animatedBannerEmojiStyle,
    animatedBannerNameStyle,
    animatedBannerDescriptionStyle,
  ]);

  const renderItem = useCallback(() => {
    return (
      <EventList
        events={groupEvents}
        isLoading={isLoadingEvents}
        isFetchingMore={isFetchingMoreEvents}
        error={error}
        onRefresh={() => fetchGroupEvents(true)}
        onLoadMore={handleLoadMoreEvents}
        onRetry={() => fetchGroupEvents(true)}
        emptyStateTitle={eventsSearchQuery.trim() ? "No events found" : "No events found"}
        emptyStateDescription={
          eventsSearchQuery.trim()
            ? "Try adjusting your search or browse all events."
            : "Events created in this group will appear here."
        }
        emptyStateIcon={<Calendar size={40} color={COLORS.accent} style={{ opacity: 0.6 }} />}
        showChevron={true}
      />
    );
  }, [
    groupEvents,
    isLoadingEvents,
    isFetchingMoreEvents,
    error,
    fetchGroupEvents,
    handleLoadMoreEvents,
    eventsSearchQuery,
  ]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading Group Details...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !group) {
    return (
      <ScreenLayout>
        <TouchableOpacity onPress={handleBack} style={styles.bannerBackButton}>
          <ArrowLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <FlatList
        data={[1]} // Single item since we're using renderItem for the EventList
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        bounces={true}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
  // Banner Styles
  zoneBanner: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bannerBackButton: {
    position: "absolute",
    top: 48,
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
    fontFamily: "SpaceMono",
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
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    lineHeight: 22,
    textAlign: "center",
    letterSpacing: 0.3,
    paddingHorizontal: 10,
  },
  // Details Section Styles
  detailsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  detailsContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  detailIconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  detailValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryTag: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  categoryText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  // Events Section Styles
  eventsContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchInput: {
    marginBottom: 16,
  },
  membersContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    height: 400, // Adjust this height as needed
  },
});
