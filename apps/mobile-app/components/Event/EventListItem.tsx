import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";

export interface EventListItemProps {
  id: string;
  title: string;
  description?: string;
  location: string;
  distance: string;
  emoji?: string;
  onPress: (event: EventListItemProps) => void;
}

const EventListItem: React.FC<EventListItemProps> = ({
  id,
  title,
  description,
  location,
  distance,
  emoji,
  onPress,
}) => {
  const handlePress = () => {
    onPress({ id, title, description, location, distance, emoji, onPress });
  };

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
            {distance && <Text style={styles.distanceText}>{distance}</Text>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
  distanceText: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default EventListItem;
