import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { fontSize, fontWeight, fontFamily, spacing, radius } from "@/theme";
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
          Featured Events
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 280,
                height: 120,
                backgroundColor: "#f0f0f0",
                borderRadius: radius.md,
                marginRight: spacing.md,
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
        Featured Events
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            onPress={() => handleEventPress(event)}
            style={{ marginRight: spacing.md, width: 280 }}
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
