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
import { useRouter } from "expo-router";
import { filterExpiredEvents } from "./filterExpiredEvents";

interface WeeklyRegularsSectionProps {
  events?: EventType[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const getRecurrenceLabel = (event: EventType): string => {
  if (event.recurrenceDays && event.recurrenceDays.length > 0) {
    const days = event.recurrenceDays
      .map((d: string) => {
        const idx = DAY_NAMES.findIndex(
          (n) => n.toLowerCase() === d.toLowerCase(),
        );
        return idx >= 0 ? DAY_NAMES[idx] : d;
      })
      .slice(0, 2);
    const prefix = event.recurrenceFrequency === "WEEKLY" ? "Every " : "Every ";
    return prefix + days.join(" & ");
  }
  if (event.eventDate) {
    const dayIdx = new Date(event.eventDate).getDay();
    return `Every ${DAY_NAMES[dayIdx]}`;
  }
  return "Weekly";
};

const WeeklyRegularsSection: React.FC<WeeklyRegularsSectionProps> = ({
  events: rawEvents = [],
}) => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const events = useMemo(() => filterExpiredEvents(rawEvents), [rawEvents]);

  const handlePress = useCallback(
    (eventId: string) => {
      router.push({
        pathname: "/details" as const,
        params: { eventId },
      });
    },
    [router],
  );

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Regulars</Text>
      {events.map((event, index) => {
        const recurrence = getRecurrenceLabel(event);
        const categoryName = event.categories?.[0]?.name;
        const isLast = index === events.length - 1;

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
            <Text style={styles.emoji}>{event.emoji || "🔁"}</Text>
            <View style={styles.eventInfo}>
              <Text style={styles.eventName} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventMeta} numberOfLines={1}>
                {[recurrence, categoryName].filter(Boolean).join(" · ")}
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
  });

export default WeeklyRegularsSection;
