import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

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
          gap: 8,
          marginTop: 8,
        },
        categoriesRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        },
        footerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        },
        footerLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flex: 1,
        },
        footerRight: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },
        distanceText: {
          color: COLORS.accent,
          fontSize: 12,
          fontFamily: "SpaceMono",
          fontWeight: "600",
        },
        timeBadge: {
          backgroundColor: COLORS.textPrimary,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.buttonBorder,
        },
        timeBadgeText: {
          color: COLORS.cardBackground,
          fontSize: 12,
          fontFamily: "SpaceMono",
          fontWeight: "600",
        },
        categoryBadge: {
          backgroundColor: COLORS.cardBackgroundAlt,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.buttonBorder,
        },
        categoryText: {
          color: COLORS.textSecondary,
          fontSize: 11,
          fontFamily: "SpaceMono",
          fontWeight: "500",
        },
        privateBadge: {
          backgroundColor: COLORS.cardBackgroundAlt,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.buttonBorder,
        },
        privateBadgeText: {
          color: COLORS.textSecondary,
          fontSize: 12,
          fontFamily: "SpaceMono",
          fontWeight: "600",
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
