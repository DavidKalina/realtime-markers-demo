import React, { useCallback, useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import EventListItemFooter from "./EventListItemFooter";
import { EventType } from "@/types/types";

export interface EventListItemProps extends EventType {
  onPress: (event: EventType) => void;
  distance?: number;
}

const EventListItem: React.FC<EventListItemProps> = React.memo(
  ({
    id,
    title,
    description,
    location,
    emoji,
    eventDate,
    endDate,
    categories,
    isRecurring,
    isPrivate,
    onPress,
    distance,
  }) => {
    const handlePress = useCallback(() => {
      onPress({
        id,
        title,
        description,
        location,
        emoji,
        eventDate,
        endDate,
        categories,
        isRecurring,
        isPrivate,
      } as EventType);
    }, [
      id,
      title,
      description,
      location,
      emoji,
      eventDate,
      endDate,
      categories,
      isRecurring,
      isPrivate,
      onPress,
    ]);

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
            backgroundColor: COLORS.textPrimary,
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
          titleRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          },
          titleText: {
            flex: 1,
            color: COLORS.textPrimary,
            fontSize: 16,
            fontFamily: "Poppins-Regular",
            fontWeight: "600",
          },
          eventDescription: {
            color: COLORS.textSecondary,
            fontSize: 14,
            fontFamily: "Poppins-Regular",
            lineHeight: 20,
            marginBottom: 4,
          },
          recurringBadge: {
            backgroundColor: COLORS.accent,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.buttonBorder,
            marginLeft: 8,
          },
          recurringBadgeText: {
            color: COLORS.cardBackground,
            fontSize: 12,
            fontFamily: "Poppins-Regular",
            fontWeight: "600",
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
              <View style={styles.titleRow}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {title}
                </Text>
                {isRecurring && (
                  <View style={styles.recurringBadge}>
                    <Text style={styles.recurringBadgeText}>🔄 Recurring</Text>
                  </View>
                )}
              </View>
              {description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {description}
                </Text>
              )}
              <EventListItemFooter
                distance={distance ? `${distance.toFixed(1)}km` : ""}
                categories={
                  categories?.map((cat) => ({ id: cat, name: cat })) || []
                }
                eventDate={eventDate}
                endDate={endDate?.toISOString()}
                isPrivate={isPrivate}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

EventListItem.displayName = "EventListItem";

export default EventListItem;
