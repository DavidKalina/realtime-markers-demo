import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Calendar } from "lucide-react-native";
import SectionHeader from "@/components/Layout/SectionHeader";
import { COLORS } from "@/components/Layout/ScreenLayout";

interface GroupEventsSectionProps {
  onViewAllPress: () => void;
}

export const GroupEventsSection: React.FC<GroupEventsSectionProps> = ({
  onViewAllPress,
}) => {
  return (
    <View style={styles.section}>
      <SectionHeader
        icon={Calendar}
        title="Events"
        actionText="View All"
        onActionPress={onViewAllPress}
      />
      <View style={styles.eventsPreview}>
        <Text style={styles.eventsPreviewText}>
          View and manage group events, including meetups, workshops, and social
          gatherings.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  eventsPreview: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 16,
    padding: 16,
  },
  eventsPreviewText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
});
