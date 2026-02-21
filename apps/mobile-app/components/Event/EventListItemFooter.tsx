import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontFamily,
  fontWeight,
  spacing,
  radius,
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
}

const EventListItemFooter: React.FC<EventListItemFooterProps> = ({
  distance,
  categories,
  eventDate,
  endDate,
  isPrivate,
}) => {
  const timeBadgeText = useMemo(
    () => getTimeBadgeText(eventDate, endDate),
    [eventDate, endDate],
  );

  // Get up to 2 categories
  const displayCategories = useMemo(() => {
    return categories?.slice(0, 2);
  }, [categories]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        eventFooter: {
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        categoriesRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          flexWrap: "wrap",
        },
        footerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        footerLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          flex: 1,
        },
        footerRight: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
        distanceText: {
          color: colors.accent.primary,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.mono,
          fontWeight: fontWeight.semibold,
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
        categoryBadge: {
          backgroundColor: colors.bg.cardAlt,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        categoryText: {
          color: colors.text.secondary,
          fontSize: 11,
          fontFamily: fontFamily.mono,
          fontWeight: fontWeight.medium,
        },
        privateBadge: {
          backgroundColor: colors.bg.cardAlt,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border.medium,
        },
        privateBadgeText: {
          color: colors.text.secondary,
          fontSize: fontSize.xs,
          fontFamily: fontFamily.mono,
          fontWeight: fontWeight.semibold,
        },
      }),
    [],
  );

  return (
    <View style={styles.eventFooter}>
      {displayCategories && displayCategories.length > 0 && (
        <View style={styles.categoriesRow}>
          {displayCategories.map((category) => (
            <View key={category.id} style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          {distance && <Text style={styles.distanceText}>{distance}</Text>}
          {isPrivate && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>🔒 Private</Text>
            </View>
          )}
        </View>
        <View style={styles.footerRight}>
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{timeBadgeText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default EventListItemFooter;
