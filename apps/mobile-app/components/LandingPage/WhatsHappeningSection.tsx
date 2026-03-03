import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { DiscoveredEventType, TrendingEventType } from "@/types/types";
import EventListItem, { getTimeBadge } from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

type MergedEvent =
  | (TrendingEventType & { _kind: "trending" })
  | (DiscoveredEventType & { _kind: "discovered" });

interface WhatsHappeningSectionProps {
  trendingEvents?: TrendingEventType[];
  justDiscoveredEvents?: DiscoveredEventType[];
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.85;
const ITEM_SPACING = 16;
const ITEM_MARGIN = (screenWidth - ITEM_WIDTH) / 2;

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const WhatsHappeningSection: React.FC<WhatsHappeningSectionProps> = ({
  trendingEvents = [],
  justDiscoveredEvents = [],
}) => {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const merged: MergedEvent[] = useMemo(() => {
    const trending: MergedEvent[] = trendingEvents.map((e) => ({
      ...e,
      _kind: "trending" as const,
    }));
    const discovered: MergedEvent[] = justDiscoveredEvents.map((e) => ({
      ...e,
      _kind: "discovered" as const,
    }));
    return [...trending, ...discovered];
  }, [trendingEvents, justDiscoveredEvents]);

  const handleEventPress = useCallback(
    (event: MergedEvent) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIndex = Math.round(
          event.nativeEvent.contentOffset.x / (ITEM_WIDTH + ITEM_SPACING),
        );
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
        }
      },
    },
  );

  const scrollToIndex = useCallback((index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * (ITEM_WIDTH + ITEM_SPACING),
        animated: true,
      });
    }
  }, []);

  if (merged.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's Happening</Text>
      <Text style={styles.subtitle}>Trending and recently discovered</Text>

      <View style={styles.carouselContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          pagingEnabled={false}
          snapToInterval={ITEM_WIDTH + ITEM_SPACING}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {merged.map((event) => (
            <TouchableOpacity
              key={`${event._kind}-${event.id}`}
              style={styles.itemContainer}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.9}
            >
              <View style={styles.cardContainer}>
                <EventListItem
                  {...event}
                  eventDate={new Date(event.eventDate)}
                  isTrending={event._kind === "trending"}
                  onPress={() => handleEventPress(event)}
                />
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText} numberOfLines={1}>
                    {event._kind === "trending"
                      ? [
                          event.goingCount && event.goingCount > 0
                            ? `${event.goingCount} going`
                            : null,
                          event.categories?.[0]?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : [
                          (event as DiscoveredEventType).discoverer?.firstName
                            ? `Found by ${(event as DiscoveredEventType).discoverer!.firstName}`
                            : "Found",
                          formatTimeAgo(
                            (event as DiscoveredEventType).discoveredAt,
                          ),
                        ].join(" · ")}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.typeBadge,
                        event._kind === "trending"
                          ? styles.typeBadgeTrending
                          : styles.typeBadgeDiscovered,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBadgeText,
                          event._kind === "trending"
                            ? styles.typeBadgeTextTrending
                            : styles.typeBadgeTextDiscovered,
                        ]}
                      >
                        {event._kind === "trending"
                          ? "\u{1F525} Trending"
                          : "\u2726 Just Found"}
                      </Text>
                    </View>
                    {(() => {
                      const badge = getTimeBadge(
                        event.eventDate,
                        event.endDate,
                      );
                      return (
                        <Text
                          style={[
                            styles.timeBadge,
                            {
                              color: badge.color.text,
                              backgroundColor: badge.color.bg,
                              borderColor: badge.color.text + "4D",
                            },
                          ]}
                        >
                          {badge.text}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {merged.length > 1 && (
        <View style={styles.paginationContainer}>
          {merged.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
              onPress={() => scrollToIndex(index)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  carouselContainer: {
    position: "relative",
  },
  scrollContent: {
    paddingHorizontal: ITEM_MARGIN,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  cardFooter: {
    gap: spacing._6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.accent.muted,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    paddingHorizontal: spacing._6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  typeBadgeTrending: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  typeBadgeDiscovered: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  typeBadgeTextTrending: {
    color: "#fcd34d",
  },
  typeBadgeTextDiscovered: {
    color: "#93c5fd",
  },
  timeBadge: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing._6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  cardFooterText: {
    flex: 1,
    fontSize: 10,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.accent,
    marginHorizontal: spacing.xs,
  },
  paginationDotActive: {
    backgroundColor: colors.accent.primary,
    width: 24,
  },
});

export default WhatsHappeningSection;
