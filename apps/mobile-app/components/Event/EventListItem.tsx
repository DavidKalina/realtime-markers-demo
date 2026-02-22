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
  radius,
  lineHeight,
} from "@/theme";
import { spring } from "@/theme/tokens/animation";
import EventListItemFooter from "./EventListItemFooter";

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
  index?: number;
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
    isRecurring,
    isPrivate,
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

    const cappedDelay = Math.min(index, 8) * 30;

    return (
      <Animated.View entering={FadeIn.duration(200).delay(cappedDelay)}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.eventItem, animatedScaleStyle]}>
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                {emoji && (
                  <View style={styles.emojiContainer}>
                    <Text style={styles.emoji}>{emoji}</Text>
                  </View>
                )}
                <View style={styles.titleContainer}>
                  <Text style={styles.titleText} numberOfLines={1}>
                    {title}
                  </Text>
                  {description && (
                    <Text style={styles.eventDescription} numberOfLines={1}>
                      {description}
                    </Text>
                  )}
                </View>
              </View>
              <EventListItemFooter
                distance={distance}
                categories={categories}
                eventDate={eventDate}
                endDate={endDate}
                isPrivate={isPrivate}
                isRecurring={isRecurring}
              />
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
  eventItem: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    height: 120,
    justifyContent: "center",
  },
  eventContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  titleContainer: {
    flex: 1,
  },
  titleText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
  },
  eventDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    lineHeight: lineHeight.normal,
    marginTop: 2,
  },
});
