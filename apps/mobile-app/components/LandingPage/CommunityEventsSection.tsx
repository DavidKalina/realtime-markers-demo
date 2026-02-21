import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
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

interface CommunityEventsSectionProps {
  events?: EventType[];
  isLoading?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.75;
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

  // Only show recurring events or events with a future date
  const activeEvents = useMemo(() => {
    const now = new Date();
    return events.filter(
      (event) => event.isRecurring || new Date(event.eventDate) > now,
    );
  }, [events]);

  if (!activeEvents || activeEvents.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Events</Text>
      <Text style={styles.subtitle}>
        Events discovered by the community through photo scanning
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeEvents.map((event) => (
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
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
});

export default CommunityEventsSection;
