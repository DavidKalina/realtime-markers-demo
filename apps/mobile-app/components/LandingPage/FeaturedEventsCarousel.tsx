import React, { useRef, useState, useCallback } from "react";
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
import { EventType } from "@/types/types";
import { getTimeBadge } from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface FeaturedEventsCarouselProps {
  events: EventType[];
  isLoading?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.85;
const ITEM_SPACING = 16;
const ITEM_MARGIN = (screenWidth - ITEM_WIDTH) / 2;

const FeaturedEventsCarousel: React.FC<FeaturedEventsCarouselProps> = ({
  events,
  isLoading = false,
}) => {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleEventPress = useCallback(
    (event: EventType) => {
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

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Featured Events</Text>

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
          {events.map((event) => {
            const badge = getTimeBadge(event.eventDate, event.endDate);
            const accentColor = "#6ee7b7";

            return (
              <TouchableOpacity
                key={event.id}
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
                        Featured
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
                          ? event.location.split(",")[0].trim()
                          : null,
                        event.categories?.[0]?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {events.length > 1 && (
        <View style={styles.paginationContainer}>
          {events.map((_, index) => (
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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
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

export default FeaturedEventsCarousel;
