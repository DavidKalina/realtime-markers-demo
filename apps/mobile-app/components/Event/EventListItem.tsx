import React, { useCallback, useMemo } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
} from "@/theme";
import { spring } from "@/theme/tokens/animation";

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

const timeBadgeColors = {
  live: { text: "#34d399", bg: "rgba(52, 211, 153, 0.15)" },
  soon: { text: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" },
  today: { text: "#93c5fd", bg: "rgba(147, 197, 253, 0.15)" },
  upcoming: { text: "#a0a0a0", bg: "rgba(255, 255, 255, 0.06)" },
  past: { text: "#666666", bg: "rgba(255, 255, 255, 0.04)" },
} as const;

const getTimeBadge = (
  eventDate: Date | string,
  endDate?: string,
): { text: string; color: TimeBadgeColor } => {
  const now = new Date();
  const eventDateObj =
    typeof eventDate === "string" ? new Date(eventDate) : eventDate;

  if (isNaN(eventDateObj?.getTime())) {
    return { text: "Invalid date", color: timeBadgeColors.past };
  }

  const diffInMs = eventDateObj?.getTime() - now.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMs <= 0 && endDate) {
    const eventEndDate = new Date(endDate);
    if (now.getTime() <= eventEndDate.getTime()) {
      return { text: "Ongoing", color: timeBadgeColors.live };
    }
  }

  if (diffInMs < 0) {
    return { text: "Past", color: timeBadgeColors.past };
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
    return { text: "Now", color: timeBadgeColors.live };
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

    const handlePress = useCallback(() => {
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

    const handlePressIn = useCallback(() => {
      scale.value = withSpring(0.97, spring.snappy);
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, spring.bouncy);
    }, [scale]);

    const animatedScaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const timeBadge = useMemo(
      () => getTimeBadge(eventDate, endDate),
      [eventDate, endDate],
    );

    const metaText = useMemo(() => {
      const items: string[] = [];
      if (isTrending) items.push("Trending");
      if (distance) items.push(distance);
      if (categories?.length > 0) items.push(categories[0].name);
      if (goingCount && goingCount > 0) items.push(`${goingCount} going`);
      if (isRecurring) items.push("Recurring");
      if (isPrivate) items.push("Private");
      return items.join(" · ");
    }, [isTrending, distance, categories, goingCount, isRecurring, isPrivate]);

    const cappedDelay = Math.min(index, 8) * 30;

    return (
      <Animated.View entering={FadeIn.duration(200).delay(cappedDelay)}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.row, animatedScaleStyle]}>
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {description && (
                <Text style={styles.description} numberOfLines={1}>
                  {description}
                </Text>
              )}
              <View style={styles.footer}>
                <Text style={styles.meta} numberOfLines={1}>
                  {metaText}
                </Text>
                <Text
                  style={[
                    styles.timeBadge,
                    {
                      color: timeBadge.color.text,
                      backgroundColor: timeBadge.color.bg,
                    },
                  ]}
                >
                  {timeBadge.text}
                </Text>
              </View>
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
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing._10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    minHeight: 120,
  },
  emoji: {
    fontSize: fontSize.xl,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 15,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing._6,
  },
  timeBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    paddingHorizontal: spacing._6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    flexShrink: 0,
  },
  description: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  meta: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamily.mono,
    color: colors.text.detail,
  },
});
