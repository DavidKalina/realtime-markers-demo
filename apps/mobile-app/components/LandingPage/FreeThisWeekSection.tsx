import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  formatVenueShort,
  getTimeBadge,
} from "@/components/Event/EventListItem";
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
  useColors,
  type Colors,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { EventType } from "@/types/types";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface FreeThisWeekSectionProps {
  events: EventType[];
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.85;
const ITEM_SPACING = 16;
const ITEM_MARGIN = (screenWidth - ITEM_WIDTH) / 2;

const FreeThisWeekSection: React.FC<FreeThisWeekSectionProps> = ({
  events,
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const activeEvents = useMemo(() => {
    const now = new Date();
    return (events || []).filter((e) => {
      const end = e.endDate ? new Date(e.endDate) : null;
      if (end && end > now) return true;
      return new Date(e.eventDate) >= now;
    });
  }, [events]);

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

  if (activeEvents.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Free This Week</Text>

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
          {activeEvents.map((event) => {
            const badge = getTimeBadge(event.eventDate, event.endDate);
            const accentColor = colors.status.success.text;

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.itemContainer}
                onPress={() => handleEventPress(event)}
                activeOpacity={0.9}
              >
                <View
                  style={styles.cardContainer}
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
                        Free
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
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeEvents.length > 1 && (
        <View style={styles.paginationContainer}>
          {activeEvents.map((_, index) => (
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing["2xl"],
    },
    title: {
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
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
      overflow: "hidden",
    },
    cardBody: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
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
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.subtle,
      marginHorizontal: 3,
    },
    paginationDotActive: {
      backgroundColor: colors.text.secondary,
      width: 16,
    },
  });

export default FreeThisWeekSection;
