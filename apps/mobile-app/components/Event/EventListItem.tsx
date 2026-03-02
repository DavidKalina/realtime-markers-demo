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
import { colors, fontSize, fontFamily, fontWeight, spacing, radius } from "@/theme";

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
  live: { text: "#6ee7b7", bg: "rgba(52, 211, 153, 0.20)" },
  soon: { text: "#fcd34d", bg: "rgba(251, 191, 36, 0.20)" },
  today: { text: "#93c5fd", bg: "rgba(147, 197, 253, 0.18)" },
  upcoming: { text: "#c0c0c0", bg: "rgba(255, 255, 255, 0.08)" },
  past: { text: "#f87171", bg: "rgba(248, 113, 113, 0.18)" },
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
    const text = diffInDays === 1 ? "Tomorrow" : `Starts in ${diffInDays}d`;
    return { text, color: timeBadgeColors.upcoming };
  } else if (diffInHours > 0) {
    return {
      text: `Starts in ${diffInHours}h`,
      color: diffInHours <= 2 ? timeBadgeColors.soon : timeBadgeColors.today,
    };
  } else if (diffInMinutes > 0) {
    return { text: `Starts in ${diffInMinutes}m`, color: timeBadgeColors.soon };
  } else {
    return { text: "Live Now", color: timeBadgeColors.live };
  }
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

    const metaText = useMemo(() => {
      const items: string[] = [];
      if (isTrending) items.push("Trending");
      if (distance) items.push(distance);
      if (location) items.push(location);
      if (categories?.length > 0) items.push(categories[0].name);
      if (goingCount && goingCount > 0) items.push(`${goingCount} going`);
      if (isRecurring) items.push("Recurring");
      if (isPrivate) items.push("Private");
      return items.join(" · ");
    }, [isTrending, distance, location, categories, goingCount, isRecurring, isPrivate]);

    const cappedDelay = Math.min(index, 8) * 30;

    return (
      <Animated.View entering={FadeIn.duration(200).delay(cappedDelay)}>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.row, animatedScaleStyle]}>
            {emoji && (
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
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
    alignItems: "flex-start",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing._10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    minHeight: 76,
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  meta: {
    flex: 1,
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.detail,
  },
});
