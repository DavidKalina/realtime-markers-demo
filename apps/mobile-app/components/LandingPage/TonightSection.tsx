import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { EventType } from "@/types/types";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface TonightSectionProps {
  events: EventType[];
}

const formatTime = (dateStr: string | Date): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const TonightSection: React.FC<TonightSectionProps> = ({ events }) => {
  const router = useRouter();

  if (!events || events.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Tonight</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>
      <View style={styles.list}>
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/details" as const,
                params: { eventId: event.id },
              });
            }}
          >
            <Text style={styles.emoji}>{event.emoji || "\u{1F3B6}"}</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.itemMeta}>
                {event.eventDate ? formatTime(event.eventDate) : event.time}
                {event.distance ? ` \u00b7 ${event.distance}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius["2xl"],
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f59e0b",
  },
  liveText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    color: "#f59e0b",
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emoji: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  itemMeta: {
    fontSize: fontSize.xs,
    color: "#f59e0b",
    fontFamily: fontFamily.mono,
    marginTop: 2,
  },
});

export default TonightSection;
