import { EventType } from "@/types/types";
import React from "react";
import { View, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  detailsContainer: {
    gap: 16,
    marginBottom: 20,
  },
});

interface EventDetailsMainSectionProps {
  event: EventType;
  distanceInfo: string | null;
  isLoadingLocation: boolean;
  isAdmin: boolean;
  userLocation: [number, number] | null;
  handleOpenMaps: () => void;
  handleGetDirections: () => void;
}

const EventDetailsMainSection: React.FC<EventDetailsMainSectionProps> = () => {
  return (
    <View style={styles.detailsContainer}>
      {/* Content moved to header */}
    </View>
  );
};

export default EventDetailsMainSection;
