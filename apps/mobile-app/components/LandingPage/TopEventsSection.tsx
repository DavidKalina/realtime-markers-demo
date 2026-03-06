import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { TrendingUp } from "lucide-react-native";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from "@/theme";
import type { EventType } from "@/types/types";

interface TopEventsSectionProps {
  events: EventType[];
}

const TopEventsSection: React.FC<TopEventsSectionProps> = ({ events }) => {
  const router = useRouter();

  const handlePress = useCallback(
    (eventId: string) => {
      router.push({
        pathname: "/details" as const,
        params: { eventId },
      });
    },
    [router],
  );

  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TrendingUp size={14} color={colors.text.secondary} />
        <Text style={styles.sectionTitle}>TOP EVENTS</Text>
      </View>
      {events.map((event, index) => {
        const engagement =
          (event.saveCount ?? 0) + (event.viewCount ?? 0);
        const firstCat = event.categories?.[0];
        const categoryName = firstCat
          ? typeof firstCat === "string"
            ? firstCat
            : firstCat.name
          : null;
        const dateStr = event.eventDate
          ? new Date(event.eventDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
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
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>

            <View style={styles.eventInfo}>
              <Text style={styles.eventName} numberOfLines={1}>
                {event.title}
              </Text>
              <View style={styles.eventMeta}>
                {categoryName && (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{categoryName}</Text>
                  </View>
                )}
                {dateStr && <Text style={styles.dateText}>{dateStr}</Text>}
              </View>
            </View>

            <Text style={styles.engagementText}>
              {engagement > 0 ? engagement : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  itemPressed: {
    backgroundColor: colors.bg.card,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  categoryPill: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  categoryText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: colors.accent.primary,
    fontWeight: fontWeight.semibold,
  },
  dateText: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  engagementText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
    minWidth: 24,
    textAlign: "right",
  },
});

export default TopEventsSection;
