import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";

// Utility function to format time difference
const getTimeBadgeText = (
  eventDate: Date | string,
  endDate?: string,
): string => {
  const now = new Date();

  // Convert eventDate to Date object if it's a string
  const eventDateObj =
    typeof eventDate === "string" ? new Date(eventDate) : eventDate;

  // Check if the date is valid
  if (isNaN(eventDateObj?.getTime())) {
    return "Invalid date";
  }

  const diffInMs = eventDateObj?.getTime() - now.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  // Check if the event is ongoing (current time is between start and end date)
  if (diffInMs <= 0 && endDate) {
    const eventEndDate = new Date(endDate);
    if (now.getTime() <= eventEndDate.getTime()) {
      return "Ongoing";
    }
  }

  if (diffInMs < 0) {
    return "Past";
  } else if (diffInDays > 0) {
    return diffInDays === 1 ? "Tomorrow" : `In ${diffInDays}d`;
  } else if (diffInHours > 0) {
    return `In ${diffInHours}h`;
  } else if (diffInMinutes > 0) {
    return `In ${diffInMinutes}m`;
  } else {
    return "Now";
  }
};

export interface EventListItemFooterProps {
  distance: string;
  categories: { id: string; name: string }[];
  eventDate: Date | string;
  endDate?: string;
  isPrivate?: boolean;
  isRecurring?: boolean;
  goingCount?: number;
  isTrending?: boolean;
}

const EventListItemFooter: React.FC<EventListItemFooterProps> = ({
  distance,
  categories,
  eventDate,
  endDate,
  isPrivate,
  isRecurring,
  goingCount,
  isTrending,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const timeBadgeText = useMemo(
    () => getTimeBadgeText(eventDate, endDate),
    [eventDate, endDate],
  );

  // Build the metadata line: "distance · category · recurring · private"
  const metaItems = useMemo(() => {
    const items: string[] = [];
    if (isTrending) items.push("Trending");
    if (distance) items.push(distance);
    if (categories?.length > 0) {
      items.push(categories[0].name);
    }
    if (goingCount && goingCount > 0) items.push(`${goingCount} going`);
    if (isRecurring) items.push("Recurring");
    if (isPrivate) items.push("Private");
    return items;
  }, [isTrending, distance, categories, goingCount, isRecurring, isPrivate]);

  return (
    <View style={styles.footer}>
      <Text style={styles.metaText} numberOfLines={1}>
        {metaItems.join(" · ")}
      </Text>
      <View style={styles.timeBadge}>
        <Text style={styles.timeBadgeText}>{timeBadgeText}</Text>
      </View>
    </View>
  );
};

export default EventListItemFooter;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.sm,
    },
    metaText: {
      flex: 1,
      color: colors.text.secondary,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      marginRight: spacing.sm,
    },
    timeBadge: {
      backgroundColor: colors.text.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    timeBadgeText: {
      color: colors.bg.card,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
  });
