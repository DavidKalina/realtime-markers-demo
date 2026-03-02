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
import EventListItem, { getTimeBadge } from "@/components/Event/EventListItem";
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
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.itemContainer}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.9}
            >
              <View style={styles.cardContainer}>
                <EventListItem
                  {...event}
                  eventDate={new Date(event.eventDate)}
                  onPress={() => handleEventPress(event)}
                />
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText} numberOfLines={1}>
                    {["Featured", event.categories?.[0]?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {(() => {
                    const badge = getTimeBadge(event.eventDate, event.endDate);
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
            </TouchableOpacity>
          ))}
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
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing._6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.accent.muted,
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

export default FeaturedEventsCarousel;
