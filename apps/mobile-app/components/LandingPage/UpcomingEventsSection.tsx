import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors, fontWeight, fontFamily, spacing, type Colors } from "@/theme";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import EndOfList from "@/components/Layout/EndOfList";
import { filterExpiredEvents } from "./filterExpiredEvents";

interface UpcomingEventsSectionProps {
  events: EventType[];
  isLoading?: boolean;
}

const UpcomingEventsSection: React.FC<UpcomingEventsSectionProps> = ({
  events,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const upcomingEvents = useMemo(() => filterExpiredEvents(events), [events]);

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

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
});

export default UpcomingEventsSection;
