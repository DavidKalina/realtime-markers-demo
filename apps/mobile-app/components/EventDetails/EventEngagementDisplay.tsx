import { EventEngagementMetrics } from "@/services/api/base/types";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, fontSize, fontWeight, fontFamily } from "@/theme";

interface EventEngagementDisplayProps {
  engagement: EventEngagementMetrics;
  delay?: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const EventEngagementDisplay: React.FC<EventEngagementDisplayProps> = memo(
  ({ engagement }) => {
    const pills = [
      { emoji: "\u{1F4BE}", value: engagement.saveCount, label: "saves" },
      { emoji: "\u{1F4F8}", value: engagement.scanCount, label: "scans" },
      { emoji: "\u{1F64B}", value: engagement.rsvpCount, label: "rsvps" },
    ];

    return (
      <View>
        {/* Stat pills row */}
        <View style={styles.pillRow}>
          {pills.map((pill) => (
            <View key={pill.label} style={styles.pill}>
              <Text style={styles.pillEmoji}>{pill.emoji}</Text>
              <Text style={styles.pillValue}>{formatNumber(pill.value)}</Text>
              <Text style={styles.pillLabel}>{pill.label}</Text>
            </View>
          ))}
        </View>

        {/* RSVP breakdown — inline when present */}
        {engagement.rsvpCount > 0 && (
          <Text style={styles.breakdown}>
            <Text style={styles.breakdownGoing}>
              {engagement.goingCount} going
            </Text>
            {"  ·  "}
            <Text style={styles.breakdownNotGoing}>
              {engagement.notGoingCount} not going
            </Text>
          </Text>
        )}
      </View>
    );
  },
);

EventEngagementDisplay.displayName = "EventEngagementDisplay";

export default EventEngagementDisplay;

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border.medium,
    gap: 4,
  },
  pillEmoji: {
    fontSize: fontSize.sm,
  },
  pillValue: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  pillLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.text.disabled,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  breakdown: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  breakdownGoing: {
    color: colors.status.success.text,
    fontWeight: fontWeight.medium,
  },
  breakdownNotGoing: {
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
});
