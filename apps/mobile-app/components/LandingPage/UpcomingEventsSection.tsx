import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, fontSize, fontWeight, fontFamily, spacing } from "@/theme";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface UpcomingEventsSectionProps {
  events: EventType[];
  isLoading?: boolean;
}

const UpcomingEventsSection: React.FC<UpcomingEventsSectionProps> = ({
  events,
}) => {
  const router = useRouter();

  const handleEventPress = useCallback(
    (event: EventType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/details" as const,
        params: { eventId: event.id },
      });
    },
    [router],
  );

  // Filter out past events defensively — backend should already handle this
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => new Date(event.eventDate) > now);
  }, [events]);

  if (!upcomingEvents || upcomingEvents.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upcoming Events</Text>
      {upcomingEvents.map((event, index) => (
        <Animated.View
          key={event.id}
          style={styles.itemContainer}
          entering={FadeInDown.duration(300).delay(index * 60)}
        >
          <EventListItem
            {...event}
            eventDate={new Date(event.eventDate)}
            onPress={() => handleEventPress(event)}
          />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  itemContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
});

export default UpcomingEventsSection;
