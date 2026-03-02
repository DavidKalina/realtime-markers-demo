import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, fontWeight, fontFamily, spacing } from "@/theme";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import EndOfList from "@/components/Layout/EndOfList";

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
          entering={FadeInDown.duration(300).delay(index * 60)}
        >
          <EventListItem
            {...event}
            eventDate={new Date(event.eventDate)}
            onPress={() => handleEventPress(event)}
          />
        </Animated.View>
      ))}
      <EndOfList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
});

export default UpcomingEventsSection;
