import { EventEngagementMetrics } from "@/services/api/base/types";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useColors,
  spacing,
  fontWeight,
  fontFamily,
  type Colors,
} from "@/theme";

interface EventEngagementDisplayProps {
  engagement: EventEngagementMetrics;
  delay?: number;
}

const STAT_COLORS = ["#34d399", "#93c5fd", "#fbbf24"] as const;

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const EventEngagementDisplay: React.FC<EventEngagementDisplayProps> = memo(
  ({ engagement }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const stats = [
      { value: engagement.saveCount, label: "SAVES", color: STAT_COLORS[0] },
      { value: engagement.scanCount, label: "SCANS", color: STAT_COLORS[1] },
      { value: engagement.rsvpCount, label: "RSVPS", color: STAT_COLORS[2] },
    ];

    return (
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <Text style={[styles.statNumber, { color: stat.color }]}>
              {formatNumber(stat.value)}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  },
);

EventEngagementDisplay.displayName = "EventEngagementDisplay";

export default EventEngagementDisplay;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      gap: spacing.xl,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
    },
    statNumber: {
      fontFamily: fontFamily.mono,
      fontSize: 28,
      fontWeight: fontWeight.bold,
      lineHeight: 32,
    },
    statLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginTop: 2,
    },
  });
