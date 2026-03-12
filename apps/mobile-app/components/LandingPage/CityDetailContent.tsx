import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import {
  useColors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import {
  getTimeBadge,
  formatVenueShort,
} from "@/components/Event/EventListItem";
import type {
  DiscoveredEventType,
  EventType,
  TrendingEventType,
} from "@/types/types";
import type { ThirdSpaceScoreResponse } from "@/services/api/modules/leaderboard";
import type { PopularStop } from "@/hooks/usePopularStops";
import ThirdSpaceScoreHero from "./ThirdSpaceScoreHero";
import PopularCategoriesSection from "./PopularCategoriesSection";
import { ScoreHeroSkeleton } from "./Skeletons";
import { filterExpiredEvents } from "./filterExpiredEvents";

/* ─── Types ─── */

interface Category {
  id: string;
  name: string;
  icon: string;
  eventCount?: number;
}

interface LandingPageData {
  featuredEvents: EventType[];
  upcomingEvents?: EventType[];
  communityEvents?: EventType[];
  justDiscoveredEvents?: DiscoveredEventType[];
  trendingEvents?: TrendingEventType[];
  popularCategories?: Category[];
  availableCities?: string[];
  topEvents?: EventType[];
  happeningTodayEvents?: EventType[];
  freeThisWeekEvents?: EventType[];
  weeklyRegularEvents?: EventType[];
}

type TabKey = "top" | "today" | "discover" | "spots" | "leaderboard";

const TABS: { key: TabKey; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "today", label: "Today" },
  { key: "discover", label: "Discover" },
  { key: "spots", label: "Spots" },
  { key: "leaderboard", label: "People" },
];

interface CityDetailContentProps {
  data: LandingPageData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
  popularStops?: PopularStop[];
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  currentUserId?: string;
  topEvents?: EventType[];
  onExploreMap?: () => void;
  onSearch?: () => void;
}

/* ─── Tier emoji for leaderboard ─── */

const TIER_EMOJI: Record<string, string> = {
  Explorer: "\u{1F9ED}",
  Scout: "\u{1F52D}",
  Curator: "\u{2B50}",
  Ambassador: "\u{1F451}",
};

const RANK_COLORS: Record<number, string> = {
  1: "#fbbf24",
  2: "#a0a0a0",
  3: "#cd7f32",
};

/* ─── Recurrence label ─── */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const getRecurrenceLabel = (event: EventType): string => {
  if (event.recurrenceDays && event.recurrenceDays.length > 0) {
    const days = event.recurrenceDays
      .map((d: string) => {
        const idx = DAY_NAMES.findIndex(
          (n) => n.toLowerCase() === d.toLowerCase(),
        );
        return idx >= 0 ? DAY_NAMES[idx] : d;
      })
      .slice(0, 2);
    return "Every " + days.join(" & ");
  }
  if (event.eventDate) {
    const dayIdx = new Date(event.eventDate).getDay();
    return `Every ${DAY_NAMES[dayIdx]}`;
  }
  return "Weekly";
};

/* ─── Unified event list item ─── */

interface EventRowProps {
  event: EventType;
  onPress: (id: string) => void;
  isLast: boolean;
  rank?: number;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
}

const EventRow: React.FC<EventRowProps> = ({
  event,
  onPress,
  isLast,
  rank,
  badge,
  badgeColor,
  subtitle,
  colors,
  styles,
}) => {
  const timeBadge = getTimeBadge(event.eventDate, event.endDate);
  const firstCat = event.categories?.[0];
  const categoryName = firstCat
    ? typeof firstCat === "string"
      ? firstCat
      : firstCat.name
    : null;

  const meta = subtitle
    ? subtitle
    : [event.location ? formatVenueShort(event.location) : null, categoryName]
        .filter(Boolean)
        .join(" \u00B7 ");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventRow,
        isLast && styles.eventRowLast,
        pressed && styles.eventRowPressed,
      ]}
      onPress={() => onPress(event.id)}
    >
      {rank != null && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )}
      {badge && (
        <View
          style={[
            styles.tagBadge,
            badgeColor ? { backgroundColor: badgeColor + "18" } : undefined,
          ]}
        >
          <Text
            style={[
              styles.tagBadgeText,
              badgeColor ? { color: badgeColor } : undefined,
            ]}
          >
            {badge}
          </Text>
        </View>
      )}
      {!rank && !badge && (
        <Text style={styles.emoji}>{event.emoji || "\u{1F4CC}"}</Text>
      )}
      <View style={styles.eventInfo}>
        <Text style={styles.eventName} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[styles.timeBadgeText, { color: timeBadge.color.text }]}>
        {timeBadge.text}
      </Text>
    </Pressable>
  );
};

/* ─── Hero crossfade ─── */

const HeroCrossfade: React.FC<{
  isLoading: boolean;
  thirdSpaceScore?: ThirdSpaceScoreResponse | null;
  onExploreMap?: () => void;
}> = ({ isLoading, thirdSpaceScore, onExploreMap }) => {
  if (isLoading) {
    return <ScoreHeroSkeleton />;
  }

  if (thirdSpaceScore) {
    return (
      <Animated.View entering={FadeIn.duration(duration.normal)}>
        <ThirdSpaceScoreHero
          score={thirdSpaceScore}
          onExploreMap={onExploreMap}
        />
      </Animated.View>
    );
  }

  return null;
};

/* ─── Main component ─── */

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "\u2615",
  restaurant: "\u{1F37D}",
  bar: "\u{1F378}",
  park: "\u{1F333}",
  museum: "\u{1F3DB}",
  gallery: "\u{1F5BC}",
  market: "\u{1F6D2}",
  trail: "\u{1F6B6}",
  attraction: "\u{1F3A0}",
  venue: "\u{1F3A4}",
};

const CityDetailContent: React.FC<CityDetailContentProps> = ({
  data,
  isLoading,
  onRefresh,
  isRefreshing = false,
  thirdSpaceScore,
  currentUserId,
  topEvents,
  popularStops,
  onExploreMap,
  onSearch,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("top");

  const handleEventPress = useCallback(
    (eventId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId },
      });
    },
    [router],
  );

  const handleTabPress = useCallback((tab: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  // Memoize active events — aggressively filter out expired
  const activeToday = useMemo(
    () => filterExpiredEvents(data?.happeningTodayEvents || []),
    [data?.happeningTodayEvents],
  );

  const activeFree = useMemo(
    () => filterExpiredEvents(data?.freeThisWeekEvents || []),
    [data?.freeThisWeekEvents],
  );

  const activeCommunity = useMemo(
    () => filterExpiredEvents(data?.communityEvents || []),
    [data?.communityEvents],
  );

  const activeWeekly = useMemo(
    () => filterExpiredEvents(data?.weeklyRegularEvents || []),
    [data?.weeklyRegularEvents],
  );

  // Merge trending + discovered into a unified list (filter expired)
  const discoverEvents = useMemo((): (EventType & {
    _badge: string;
    _badgeColor: string;
  })[] => {
    const trending = filterExpiredEvents(data?.trendingEvents || []).map(
      (e) => ({
        ...(e as EventType),
        _badge: "Trending",
        _badgeColor: "#fcd34d",
      }),
    );
    const discovered = filterExpiredEvents(
      data?.justDiscoveredEvents || [],
    ).map((e) => ({
      ...(e as EventType),
      _badge: "New",
      _badgeColor: "#93c5fd",
    }));
    return [...trending, ...discovered];
  }, [data?.trendingEvents, data?.justDiscoveredEvents]);

  // Combined events for the "top" tab: top events + featured (filter expired)
  const topTabEvents = useMemo(() => {
    const top = filterExpiredEvents(topEvents || []);
    const featured = filterExpiredEvents(data?.featuredEvents || []);
    const topIds = new Set(top.map((e) => e.id));
    const extra = featured.filter((e) => !topIds.has(e.id));
    return { ranked: top, featured: extra };
  }, [topEvents, data?.featuredEvents]);

  const isEmpty =
    !!data &&
    !data.featuredEvents?.length &&
    !data.upcomingEvents?.length &&
    !data.communityEvents?.length &&
    !data.justDiscoveredEvents?.length &&
    !data.trendingEvents?.length &&
    !data.happeningTodayEvents?.length &&
    !topEvents?.length;

  // Tab content counts for subtle badges
  const tabCounts = useMemo(
    () => ({
      top: topTabEvents.ranked.length + topTabEvents.featured.length,
      today: activeToday.length + activeFree.length + activeWeekly.length,
      discover: discoverEvents.length + activeCommunity.length,
      spots: popularStops?.length || 0,
      leaderboard: thirdSpaceScore?.contributors?.length || 0,
    }),
    [
      topTabEvents,
      activeToday,
      activeFree,
      activeWeekly,
      discoverEvents,
      activeCommunity,
      popularStops,
      thirdSpaceScore?.contributors,
    ],
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "top":
        return renderTopTab();
      case "today":
        return renderTodayTab();
      case "discover":
        return renderDiscoverTab();
      case "spots":
        return renderSpotsTab();
      case "leaderboard":
        return renderLeaderboardTab();
    }
  };

  const renderTopTab = () => {
    const { ranked, featured } = topTabEvents;
    if (ranked.length === 0 && featured.length === 0) {
      return renderEmptyTab("No top events yet");
    }
    const allEvents = [
      ...ranked.map((e, i) => ({
        event: e,
        rank: i + 1,
        badge: undefined as string | undefined,
        badgeColor: undefined as string | undefined,
      })),
      ...featured.map((e) => ({
        event: e,
        rank: undefined as number | undefined,
        badge: "Featured",
        badgeColor: "#10b981",
      })),
    ];
    return (
      <View style={styles.tabContent}>
        {allEvents.map(({ event, rank, badge, badgeColor }, index) => (
          <EventRow
            key={event.id}
            event={event}
            onPress={handleEventPress}
            isLast={index === allEvents.length - 1}
            rank={rank}
            badge={badge}
            badgeColor={badgeColor}
            colors={colors}
            styles={styles}
          />
        ))}
      </View>
    );
  };

  const renderTodayTab = () => {
    const hasToday = activeToday.length > 0;
    const hasFree = activeFree.length > 0;
    const hasWeekly = activeWeekly.length > 0;

    if (!hasToday && !hasFree && !hasWeekly) {
      return renderEmptyTab("Nothing happening today");
    }

    return (
      <View style={styles.tabContent}>
        {hasToday && (
          <>
            <Text style={styles.subSectionTitle}>HAPPENING NOW</Text>
            {activeToday.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={handleEventPress}
                isLast={
                  !hasFree && !hasWeekly && index === activeToday.length - 1
                }
                colors={colors}
                styles={styles}
              />
            ))}
          </>
        )}
        {hasFree && (
          <>
            {hasToday && <View style={styles.subSectionDivider} />}
            <Text style={styles.subSectionTitle}>FREE THIS WEEK</Text>
            {activeFree.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={handleEventPress}
                isLast={!hasWeekly && index === activeFree.length - 1}
                badge="Free"
                badgeColor="#10b981"
                colors={colors}
                styles={styles}
              />
            ))}
          </>
        )}
        {hasWeekly && (
          <>
            {(hasToday || hasFree) && <View style={styles.subSectionDivider} />}
            <Text style={styles.subSectionTitle}>WEEKLY REGULARS</Text>
            {activeWeekly.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={handleEventPress}
                isLast={index === activeWeekly.length - 1}
                subtitle={getRecurrenceLabel(event)}
                colors={colors}
                styles={styles}
              />
            ))}
          </>
        )}
      </View>
    );
  };

  const renderDiscoverTab = () => {
    const hasDiscover = discoverEvents.length > 0;
    const hasCommunity = activeCommunity.length > 0;

    if (!hasDiscover && !hasCommunity) {
      return renderEmptyTab("Nothing discovered yet");
    }

    return (
      <View style={styles.tabContent}>
        {hasDiscover &&
          discoverEvents.map((event, index) => (
            <EventRow
              key={event.id}
              event={event}
              onPress={handleEventPress}
              isLast={!hasCommunity && index === discoverEvents.length - 1}
              badge={event._badge}
              badgeColor={event._badgeColor}
              colors={colors}
              styles={styles}
            />
          ))}
        {hasCommunity && (
          <>
            {hasDiscover && <View style={styles.subSectionDivider} />}
            <Text style={styles.subSectionTitle}>COMMUNITY</Text>
            {activeCommunity.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={handleEventPress}
                isLast={index === activeCommunity.length - 1}
                subtitle={
                  event.scanCount && event.scanCount > 0
                    ? `Scanned ${event.scanCount}x`
                    : undefined
                }
                colors={colors}
                styles={styles}
              />
            ))}
          </>
        )}
      </View>
    );
  };

  const renderSpotsTab = () => {
    if (!popularStops || popularStops.length === 0) {
      return renderEmptyTab("No popular spots yet");
    }

    return (
      <View style={styles.tabContent}>
        <Text style={styles.subSectionTitle}>WHERE PEOPLE ACTUALLY GO</Text>
        {popularStops.map((stop, index) => {
          const emoji =
            stop.emoji ||
            (stop.venueCategory
              ? CATEGORY_EMOJI[stop.venueCategory] || "\u{1F4CD}"
              : "\u{1F4CD}");
          const pct = Math.round(stop.completionRate * 100);
          const isLast = index === popularStops.length - 1;

          return (
            <View
              key={`${stop.venueName}-${index}`}
              style={[styles.eventRow, isLast && styles.eventRowLast]}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {stop.venueName}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {emoji} {stop.venueCategory || "spot"}
                  {stop.googleRating
                    ? ` \u00B7 ${stop.googleRating}\u2605`
                    : ""}
                  {` \u00B7 ${stop.frequency}x planned \u00B7 ${pct}% went`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderLeaderboardTab = () => {
    const contributors = thirdSpaceScore?.contributors;
    if (!contributors || contributors.length === 0) {
      return renderEmptyTab("No contributors yet");
    }

    return (
      <View style={styles.tabContent}>
        {contributors.map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const rankColor = RANK_COLORS[entry.rank];
          const tierEmoji =
            TIER_EMOJI[entry.currentTier] || TIER_EMOJI.Explorer;
          const displayName =
            [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
            "Anonymous";
          const isLast = index === contributors.length - 1;

          return (
            <View
              key={entry.userId}
              style={[styles.eventRow, isLast && styles.eventRowLast]}
            >
              <Text
                style={[
                  styles.leaderRank,
                  rankColor ? { color: rankColor } : undefined,
                ]}
              >
                #{entry.rank}
              </Text>
              <View style={styles.eventInfo}>
                <Text
                  style={[
                    styles.eventName,
                    isCurrentUser && { color: colors.accent.primary },
                  ]}
                  numberOfLines={1}
                >
                  {displayName}
                  {isCurrentUser ? " (you)" : ""}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {`${tierEmoji} ${entry.currentTier}`}
                  {entry.label ? ` \u00B7 ${entry.label}` : ""}
                </Text>
              </View>
              <Text style={styles.leaderScore}>{entry.contribution}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderEmptyTab = (message: string) => (
    <View style={styles.emptyTab}>
      <Text style={styles.emptyTabText}>{message}</Text>
      <Pressable
        onPress={() => router.navigate("/spaces")}
        style={[styles.emptyButton, { borderColor: colors.border.default }]}
      >
        <Text style={[styles.emptyButtonText, { color: colors.text.primary }]}>
          Browse other cities
        </Text>
      </Pressable>
    </View>
  );

  const scrollContent = (
    <>
      {/* Hero crossfade — skeleton and real hero overlap to avoid layout jump */}
      <HeroCrossfade
        isLoading={isLoading}
        thirdSpaceScore={thirdSpaceScore}
        onExploreMap={onExploreMap}
      />

      {!isLoading && (
        <>
          {/* Categories pills */}
          {data?.popularCategories && data.popularCategories.length > 0 && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(80)}
            >
              <PopularCategoriesSection categories={data.popularCategories} />
            </Animated.View>
          )}

          {/* Empty state */}
          {isEmpty && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(160)}
              style={styles.emptyContainer}
            >
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
                No events yet
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.text.secondary }]}
              >
                Be the first to scan a flyer and put this city on the map.
              </Text>
              <Pressable
                onPress={() => router.navigate("/spaces")}
                style={[
                  styles.emptyButton,
                  { borderColor: colors.border.default },
                ]}
              >
                <Text
                  style={[
                    styles.emptyButtonText,
                    { color: colors.text.primary },
                  ]}
                >
                  Browse other cities
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Tab bar + content */}
          {!isEmpty && (
            <Animated.View
              entering={FadeIn.duration(duration.normal).delay(160)}
            >
              {/* Tab bar */}
              <View style={styles.tabBar}>
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const count = tabCounts[tab.key];
                  return (
                    <Pressable
                      key={tab.key}
                      style={[
                        styles.tabButton,
                        isActive && styles.tabButtonActive,
                      ]}
                      onPress={() => handleTabPress(tab.key)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          isActive && styles.tabTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {count > 0 && (
                        <Text
                          style={[
                            styles.tabCount,
                            isActive && styles.tabCountActive,
                          ]}
                        >
                          {count}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Tab content — key swap triggers enter/exit animation */}
              <Animated.View
                key={activeTab}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition.duration(250)}
              >
                {renderTabContent()}
              </Animated.View>
            </Animated.View>
          )}
        </>
      )}

      <View style={{ height: 120 }} />
    </>
  );

  if (onSearch) {
    return (
      <PullToActionScrollView
        onSearch={onSearch}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      >
        {scrollContent}
      </PullToActionScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        !isLoading ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {scrollContent}
    </ScrollView>
  );
};

/* ─── Styles ─── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    /* Tab bar — matches browse screen toggle style */
    tabBar: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      padding: 2,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm,
      borderRadius: radius.lg - 2,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tabButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    tabText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.text.primary,
    },
    tabCount: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.disabled,
    },
    tabCountActive: {
      color: colors.text.secondary,
    },

    /* Tab content */
    tabContent: {
      paddingHorizontal: spacing.lg,
    },
    subSectionTitle: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    subSectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.md,
    },

    /* Unified event row */
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._10,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    eventRowLast: {
      borderBottomWidth: 0,
    },
    eventRowPressed: {
      opacity: 0.6,
    },
    rankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.bg.elevated,
      justifyContent: "center",
      alignItems: "center",
    },
    rankText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    tagBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    tagBadgeText: {
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.text.secondary,
    },
    emoji: {
      fontSize: 18,
      width: 28,
      textAlign: "center",
    },
    eventInfo: {
      flex: 1,
      gap: 2,
    },
    eventName: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
    },
    eventMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    timeBadgeText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.2,
    },

    /* Leaderboard */
    leaderRank: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      minWidth: 28,
    },
    leaderScore: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },

    /* Empty states */
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      textAlign: "center",
      lineHeight: 20,
    },
    emptyTab: {
      alignItems: "center",
      paddingVertical: spacing["2xl"],
      gap: spacing.md,
    },
    emptyTabText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    emptyButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      borderWidth: 1,
    },
    emptyButtonText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
    },
  });

export default CityDetailContent;
