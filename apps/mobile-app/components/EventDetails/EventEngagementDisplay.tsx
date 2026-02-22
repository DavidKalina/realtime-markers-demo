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
    const metrics = [
      { label: "Saves", value: engagement.saveCount },
      { label: "Scans", value: engagement.scanCount },
      { label: "RSVPs", value: engagement.rsvpCount },
      { label: "Total", value: engagement.totalEngagement },
    ];

    return (
      <View>
        {/* Metrics row */}
        <View style={styles.row}>
          {metrics.map((metric, index) => (
            <View key={metric.label} style={styles.metric}>
              <Text style={styles.value}>{formatNumber(metric.value)}</Text>
              <Text style={styles.label}>{metric.label}</Text>
              {index < metrics.length - 1 && <View style={styles.separator} />}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  metric: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  value: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.text.disabled,
    textAlign: "center",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  separator: {
    position: "absolute",
    right: 0,
    top: 4,
    bottom: 4,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.medium,
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
