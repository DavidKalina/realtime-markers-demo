import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface FeaturedEventsSectionProps {
  events: EventType[];
  isLoading?: boolean;
}

const FeaturedEventsSection: React.FC<FeaturedEventsSectionProps> = ({
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
          Featured Events
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 280,
                height: 120,
                backgroundColor: "#f0f0f0",
                borderRadius: 12,
                marginRight: 12,
                opacity: 0.6,
              }}
            />
          ))}
        </ScrollView>
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
        Featured Events
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            onPress={() => handleEventPress(event)}
            style={{ marginRight: 12, width: 280 }}
          >
            <EventListItem
              {...event}
              eventDate={new Date(event.eventDate)}
              onPress={() => handleEventPress(event)}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default FeaturedEventsSection;
