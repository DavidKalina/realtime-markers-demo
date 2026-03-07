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

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Regulars</Text>
      {events.map((event) => {
        const recurrence = getRecurrenceLabel(event);
        const categoryName = event.categories?.[0]?.name;

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
                {event.emoji ? `${event.emoji} ` : ""}
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
      marginBottom: spacing["2xl"],
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
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    itemPressed: {
      opacity: 0.6,
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
