import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
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
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 12,
            paddingHorizontal: 16,
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
              borderRadius: 12,
              marginHorizontal: 16,
              marginBottom: 12,
              opacity: 0.6,
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
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "600",
          marginBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        Upcoming Events
      </Text>
      {events.map((event) => (
        <TouchableOpacity
          key={event.id}
          onPress={() => handleEventPress(event)}
          style={{ marginHorizontal: 16, marginBottom: 12 }}
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
