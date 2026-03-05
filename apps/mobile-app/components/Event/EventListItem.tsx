import React, { useCallback, useMemo } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
} from "@/theme";

export interface EventListItemProps {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
  emoji?: string;
  eventDate: Date | string;
  endDate?: string;
  categories: { id: string; name: string }[];
  isRecurring?: boolean;
  isPrivate?: boolean;
  goingCount?: number;
  isTrending?: boolean;
  index?: number;
  onPress: (event: EventListItemProps) => void;
}

type TimeBadgeColor = {
  text: string;
  bg: string;
};

export const timeBadgeColors = {
  live: { text: "#6ee7b7", bg: "rgba(52, 211, 153, 0.12)" },
  soon: { text: "#fcd34d", bg: "rgba(251, 191, 36, 0.12)" },
  today: { text: "#93c5fd", bg: "rgba(147, 197, 253, 0.10)" },
  upcoming: { text: colors.text.secondary, bg: "rgba(255, 255, 255, 0.04)" },
  past: { text: colors.text.disabled, bg: "rgba(255, 255, 255, 0.04)" },
} as const;

export const getTimeBadge = (
  eventDate: Date | string,
  endDate?: string,
): { text: string; color: TimeBadgeColor } => {
  const now = new Date();
  const eventDateObj =
    typeof eventDate === "string" ? new Date(eventDate) : eventDate;

  if (isNaN(eventDateObj?.getTime())) {
    return { text: "Date TBD", color: timeBadgeColors.past };
  }

  const diffInMs = eventDateObj?.getTime() - now.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMs <= 0 && endDate) {
    const eventEndDate = new Date(endDate);
    if (now.getTime() <= eventEndDate.getTime()) {
      return { text: "Happening Now", color: timeBadgeColors.live };
    }
  }

  if (diffInMs < 0) {
    return { text: "Expired", color: timeBadgeColors.past };
  } else if (diffInDays > 0) {
    const text = diffInDays === 1 ? "Tomorrow" : `In ${diffInDays}d`;
    return { text, color: timeBadgeColors.upcoming };
  } else if (diffInHours > 0) {
    return {
      text: `In ${diffInHours}h`,
      color: diffInHours <= 2 ? timeBadgeColors.soon : timeBadgeColors.today,
    };
  } else if (diffInMinutes > 0) {
    return { text: `In ${diffInMinutes}m`, color: timeBadgeColors.soon };
  } else {
    return { text: "Live Now", color: timeBadgeColors.live };
  }
};

const titleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

/** True when a string is only digits (e.g. a street number with no name). */
const isOnlyDigits = (s: string) => /^\d+$/.test(s.trim());

/** Truncate a full address to just "City, State" (or return as-is if unparseable). */
const toCityState = (location: string): string => {
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 3) return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
  if (parts.length === 2) return parts.join(", ");
  return location;
};

/**
 * Extract a short display label from a location string.
 * Takes the first comma-separated segment unless it is purely numeric
 * (e.g. a street number like "2644"), in which case it falls back to
 * the city (second-to-last segment) or the full string.
 */
export const formatVenueShort = (location: string): string => {
  const parts = location.split(",").map((s) => s.trim());
  const first = parts[0];
  if (!isOnlyDigits(first)) return first;
  // Skip numeric-only first segment; prefer a city-like segment
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[1];
  return location;
};

const EventListItem: React.FC<EventListItemProps> = React.memo(
  ({
    id,
    title,
    description,
    location,
    distance,
    emoji,
    eventDate,
    endDate,
    categories,
    isRecurring,
    isPrivate,
    goingCount,
    isTrending,
    index = 0,
    onPress,
  }) => {
    const scale = useSharedValue(1);

    const navigate = useCallback(() => {
      onPress({
        id,
        title,
        description,
        location,
        distance,
        emoji,
        eventDate,
        endDate,
        categories,
        isRecurring,
        isPrivate,
        goingCount,
        isTrending,
        index,
        onPress,
      });
    }, [
      id,
      title,
      description,
      location,
      distance,
      emoji,
      eventDate,
      endDate,
      categories,
      isRecurring,
      isPrivate,
      goingCount,
      isTrending,
      index,
      onPress,
    ]);

    const handlePress = useCallback(() => {
      scale.value = withSequence(
        withTiming(0.97, { duration: 80 }),
        withTiming(1, { duration: 100 }, () => {
          scheduleOnRN(navigate);
        }),
      );
    }, [navigate, scale]);

    const animatedScaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const timeBadge = useMemo(
      () => getTimeBadge(eventDate, endDate),
      [eventDate, endDate],
    );

    const metaText = useMemo(() => {
      const items: string[] = [];
      if (location && !isOnlyDigits(location)) items.push(toCityState(location));
      if (distance) items.push(distance);
      if (categories?.length > 0) items.push(titleCase(categories[0].name));
      if (isRecurring) items.push("Recurring");
      if (isPrivate) items.push("Private");
      if (goingCount && goingCount > 0) items.push(`${goingCount} going`);
      return items.join(" · ");
    }, [location, distance, categories, isRecurring, isPrivate, goingCount]);

    const cappedDelay = Math.min(index, 8) * 30;

    return (
      <Animated.View entering={FadeIn.duration(200).delay(cappedDelay)}>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.row, animatedScaleStyle]}>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text
                  style={[
                    styles.timeBadgeText,
                    { color: timeBadge.color.text },
                  ]}
                >
                  {timeBadge.text}
                </Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {metaText}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  },
);

EventListItem.displayName = "EventListItem";

export default EventListItem;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing._10,
    paddingHorizontal: spacing.lg,
    gap: spacing._10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 18,
  },
  timeBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
    lineHeight: 16,
  },
});
