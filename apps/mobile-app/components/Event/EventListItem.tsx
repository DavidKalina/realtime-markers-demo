import React, { useCallback, useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

// Utility function to format time difference
const getTimeBadgeText = (eventDate: Date, endDate?: string): string => {
  const now = new Date();
  const diffInMs = eventDate.getTime() - now.getTime();
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

export interface EventListItemProps {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
  emoji?: string;
  eventDate: Date;
  endDate?: string;
  categories: { id: string; name: string }[];
  onPress: (event: EventListItemProps) => void;
}

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
    onPress,
  }) => {
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
      onPress,
    ]);

    const timeBadgeText = useMemo(
      () => getTimeBadgeText(eventDate, endDate),
      [eventDate, endDate],
    );

    // Get up to 2 categories
    const displayCategories = useMemo(() => {
      return categories.slice(0, 2);
    }, [categories]);

    const styles = useMemo(
      () =>
        StyleSheet.create({
          eventItem: {
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.divider,
          },
          eventContent: {
            flex: 1,
          },
          eventHeader: {
            flexDirection: "row",
            alignItems: "flex-start",
          },
          emojiContainer: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.cardBackgroundAlt,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            borderWidth: 1,
            borderColor: COLORS.buttonBorder,
          },
          emoji: {
            fontSize: 18,
          },
          titleContainer: {
            flex: 1,
          },
          eventTitle: {
            color: COLORS.textPrimary,
            fontSize: 16,
            fontFamily: "SpaceMono",
            fontWeight: "600",
            marginBottom: 4,
          },
          eventDescription: {
            color: COLORS.textSecondary,
            fontSize: 14,
            fontFamily: "SpaceMono",
            lineHeight: 20,
            marginBottom: 4,
          },
          eventFooter: {
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
        }),
      [],
    );

    return (
      <TouchableOpacity
        style={styles.eventItem}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            {emoji && (
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{emoji}</Text>
              </View>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {title}
              </Text>
              {description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {description}
                </Text>
              )}
              <View style={styles.eventFooter}>
                <View style={styles.footerLeft}>
                  {distance && (
                    <Text style={styles.distanceText}>{distance}</Text>
                  )}
                  {displayCategories.map((category) => (
                    <View key={category.id} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{category.name}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>{timeBadgeText}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

EventListItem.displayName = "EventListItem";

export default EventListItem;
