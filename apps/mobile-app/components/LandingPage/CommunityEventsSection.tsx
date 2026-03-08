import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";
import { EventType } from "@/types/types";
import { getTimeBadge } from "@/components/Event/EventListItem";
import { useRouter } from "expo-router";

interface CommunityEventsSectionProps {
  events?: EventType[];
  isLoading?: boolean;
}

const CommunityEventsSection: React.FC<CommunityEventsSectionProps> = ({
  events = [],
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback(
    (eventId: string) => {
      router.push({
        pathname: "/details" as const,
        params: { eventId },
      });
    },
    [router],
  );

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
      {activeEvents.map((event, index) => {
        const badge = getTimeBadge(event.eventDate, event.endDate);
        const scanLabel =
          event.scanCount && event.scanCount > 0
            ? `Scanned ${event.scanCount}x`
            : null;
        const categoryName = event.categories?.[0]?.name;
        const isLast = index === activeEvents.length - 1;

        return (
          <Pressable
            key={event.id}
            style={({ pressed }) => [
              styles.item,
              isLast && styles.itemLast,
              pressed && styles.itemPressed,
            ]}
            onPress={() => handlePress(event.id)}
          >
            <Text style={styles.emoji}>{event.emoji || "🌱"}</Text>
            <View style={styles.eventInfo}>
              <Text style={styles.eventName} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventMeta} numberOfLines={1}>
                {[scanLabel, categoryName].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text style={[styles.timeBadgeText, { color: badge.color.text }]}>
              {badge.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginBottom: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemPressed: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 18,
    width: 28,
    textAlign: "center" as const,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  eventMeta: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  timeBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.2,
  },
});

export default CommunityEventsSection;
