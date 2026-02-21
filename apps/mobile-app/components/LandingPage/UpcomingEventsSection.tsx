import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
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
  isLoading = false,
}) => {
  const router = useRouter();

  const handleEventPress = (event: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/details" as const,
      params: { eventId: event.id },
    });
  };

  if (isLoading) {
    return (
      <View style={{ marginBottom: spacing["2xl"] }}>
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.semibold,
            marginBottom: spacing.md,
            paddingHorizontal: spacing.lg,
            fontFamily: fontFamily.mono,
          }}
        >
          Upcoming Events
        </Text>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 120,
              backgroundColor: "#f0f0f0",
              borderRadius: radius.xl,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              opacity: 0.6,
              shadowColor: colors.fixed.black,
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 4,
            }}
          />
        ))}
      </View>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: spacing["2xl"] }}>
      <Text
        style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          fontFamily: fontFamily.mono,
        }}
      >
        Upcoming Events
      </Text>
      {events.map((event) => (
        <TouchableOpacity
          key={event.id}
          onPress={() => handleEventPress(event)}
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            backgroundColor: colors.fixed.white,
            borderRadius: radius.xl,
            shadowColor: colors.fixed.black,
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1,
            borderColor: "#f0f0f0",
            overflow: "hidden",
          }}
        >
          <EventListItem
            {...event}
            eventDate={new Date(event.eventDate)}
            onPress={() => handleEventPress(event)}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default UpcomingEventsSection;
