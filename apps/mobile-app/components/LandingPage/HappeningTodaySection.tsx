import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
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
      {activeEvents.map((event, index) => {
        const badge = getTimeBadge(event.eventDate, event.endDate);
        const firstCat = event.categories?.[0];
        const categoryName = firstCat
          ? typeof firstCat === "string"
            ? firstCat
            : firstCat.name
          : null;
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
            <Text style={styles.emoji}>{event.emoji || "📌"}</Text>
            <View style={styles.eventInfo}>
              <Text style={styles.eventName} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventMeta} numberOfLines={1}>
                {[badge.text, categoryName].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.text.secondary} />
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing["3xl"],
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
  });

export default HappeningTodaySection;
