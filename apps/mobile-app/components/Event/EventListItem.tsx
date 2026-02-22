import React, { useCallback, useMemo } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeInUp,
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
      scale.value = withSpring(0.98, spring.firm);
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, spring.firm);
    }, [scale]);

    const animatedScaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const cappedDelay = Math.min(index, 8) * 50;

    const styles = useMemo(
      () =>
        StyleSheet.create({
          eventItem: {
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
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
          titleRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: spacing.xs,
          },
          titleText: {
            flex: 1,
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
            marginBottom: spacing.xs,
          },
          recurringBadge: {
            backgroundColor: colors.accent.primary,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border.medium,
            marginLeft: spacing.sm,
          },
          recurringBadgeText: {
            color: colors.bg.card,
            fontSize: fontSize.xs,
            fontFamily: fontFamily.mono,
            fontWeight: fontWeight.semibold,
          },
        }),
      [],
    );

    return (
      <Animated.View
        entering={FadeInUp.duration(300)
          .delay(cappedDelay)
          .springify()
          .damping(spring.firm.damping)
          .stiffness(spring.firm.stiffness)}
      >
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
                  <View style={styles.titleRow}>
                    <Text style={styles.titleText} numberOfLines={1}>
                      {title}
                    </Text>
                    {isRecurring && (
                      <View style={styles.recurringBadge}>
                        <Text style={styles.recurringBadgeText}>
                          🔄 Recurring
                        </Text>
                      </View>
                    )}
                  </View>
                  {description && (
                    <Text style={styles.eventDescription} numberOfLines={2}>
                      {description}
                    </Text>
                  )}
                  <EventListItemFooter
                    distance={distance}
                    categories={categories}
                    eventDate={eventDate}
                    endDate={endDate}
                    isPrivate={isPrivate}
                  />
                </View>
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
