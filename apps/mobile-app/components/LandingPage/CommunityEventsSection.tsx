import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { EventType } from "@/types/types";
import EventListItem from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface CommunityEventsSectionProps {
  events?: EventType[];
  isLoading?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.75; // 75% of screen width
const ITEM_SPACING = 12;

const CommunityEventsSection: React.FC<CommunityEventsSectionProps> = ({
  events = [],
  isLoading = false,
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Community Events</Text>
        <View style={styles.scrollContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.itemContainer, styles.loadingItem]}>
                <View style={styles.loadingContent} />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Events</Text>
      <Text style={styles.subtitle}>
        Events discovered by the community through photo scanning
      </Text>

      <View style={styles.scrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {events.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.itemContainer}
              onPress={() => handleEventPress(event)}
              activeOpacity={0.9}
            >
              <View style={styles.cardContainer}>
                <EventListItem
                  {...event}
                  eventDate={new Date(event.eventDate)}
                  onPress={() => handleEventPress(event)}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    paddingHorizontal: 16,
    fontFamily: "SpaceMono",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    paddingHorizontal: 16,
    fontFamily: "SpaceMono",
  },
  scrollContainer: {
    position: "relative",
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  loadingItem: {
    opacity: 0.6,
  },
  loadingContent: {
    width: ITEM_WIDTH,
    height: 120,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
});

export default CommunityEventsSection;
