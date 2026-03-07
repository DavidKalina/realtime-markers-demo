import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { formatVenueShort } from "@/components/Event/EventListItem";
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
import Reanimated, {
  FadeIn,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
} from "react-native-reanimated";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { DiscoveredEventType, TrendingEventType } from "@/types/types";
import { getTimeBadge } from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

type MergedEvent =
  | (TrendingEventType & { _kind: "trending"; _isRealtime?: boolean })
  | (DiscoveredEventType & { _kind: "discovered"; _isRealtime?: boolean });

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

/** Pulsing shimmer border for realtime items */
const ShimmerBorder: React.FC<{ active: boolean }> = ({ active }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    opacity.value = withSequence(
      withTiming(0.8, { duration: 200 }),
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(0.8, { duration: 600 }),
        ),
        2,
        true,
      ),
      withDelay(200, withTiming(0, { duration: 400 })),
    );
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!active) return null;

  return (
    <Reanimated.View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: "#93c5fd",
          shadowColor: "#93c5fd",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
};

const WhatsHappeningSection: React.FC<WhatsHappeningSectionProps> = ({
  trendingEvents = [],
  justDiscoveredEvents = [],
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const prevRealtimeCountRef = useRef(-1);

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

  // Haptic feedback when new realtime items arrive
  useEffect(() => {
    const realtimeCount = merged.filter((e) => e._isRealtime).length;
    if (prevRealtimeCountRef.current >= 0 && realtimeCount > prevRealtimeCountRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Scroll to start to show the new item
      scrollViewRef.current?.scrollTo({ x: 0, animated: true });
    }
    prevRealtimeCountRef.current = realtimeCount;
  }, [merged]);

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
          {merged.map((event) => {
            const badge = getTimeBadge(event.eventDate, event.endDate);
            const isTrending = event._kind === "trending";
            const accentColor = isTrending ? "#fcd34d" : "#93c5fd";

            const isRealtime = !!event._isRealtime;
            const entering = isRealtime
              ? FadeIn.duration(350).delay(50)
              : FadeIn.duration(300);

            return (
              <Reanimated.View
                key={`${event._kind}-${event.id}`}
                entering={entering}
                layout={LinearTransition.duration(250)}
              >
                <TouchableOpacity
                  style={styles.itemContainer}
                  onPress={() => handleEventPress(event)}
                  activeOpacity={0.9}
                >
                  <View
                    style={[
                      styles.cardContainer,
                      { backgroundColor: accentColor + "08" },
                    ]}
                  >
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.kindDot,
                            { backgroundColor: accentColor },
                          ]}
                        />
                        <Text style={[styles.kindText, { color: accentColor }]}>
                          {isRealtime
                            ? "Just Scanned"
                            : isTrending
                              ? "Trending"
                              : "Just Found"}
                        </Text>
                        <Text
                          style={[styles.timeText, { color: badge.color.text }]}
                        >
                          {badge.text}
                        </Text>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {event.emoji ? `${event.emoji} ` : ""}
                        {event.title}
                      </Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {[
                          event.location
                            ? formatVenueShort(event.location)
                            : null,
                          event.categories?.[0]?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <ShimmerBorder active={isRealtime} />
                  </View>
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}
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

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  title: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kindDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kindText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    flex: 1,
  },
  timeText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 20,
  },
  cardMeta: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
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
