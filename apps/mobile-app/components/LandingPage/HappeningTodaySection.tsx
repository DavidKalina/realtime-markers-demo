import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
} from "@/theme";
import type { EventType } from "@/types/types";
import { getTimeBadge } from "@/components/Event/EventListItem";

interface HappeningTodaySectionProps {
  events: EventType[];
}

const HappeningTodaySection: React.FC<HappeningTodaySectionProps> = ({
  events,
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const activeEvents = useMemo(() => {
    const now = new Date();
    return events.filter((e) => {
      const end = e.endDate ? new Date(e.endDate) : null;
      if (end && end > now) return true;
      return new Date(e.eventDate) >= now;
    });
  }, [events]);

  const handlePress = useCallback(
    (eventId: string) => {
      router.push({
        pathname: "/details" as const,
        params: { eventId },
      });
    },
    [router],
  );

  if (activeEvents.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Happening Today</Text>
      {activeEvents.map((event) => {
        const badge = getTimeBadge(event.eventDate, event.endDate);
        const firstCat = event.categories?.[0];
        const categoryName = firstCat
          ? typeof firstCat === "string"
            ? firstCat
            : firstCat.name
          : null;

        return (
          <Pressable
            key={event.id}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.itemPressed,
            ]}
            onPress={() => handlePress(event.id)}
          >
            <View style={styles.eventInfo}>
              <Text style={styles.eventName} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventMeta} numberOfLines={1}>
                {[badge.text, categoryName].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing["2xl"],
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      marginBottom: spacing.md,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    item: {
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    itemPressed: {
      opacity: 0.6,
    },
    eventInfo: {
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
  });

export default HappeningTodaySection;
