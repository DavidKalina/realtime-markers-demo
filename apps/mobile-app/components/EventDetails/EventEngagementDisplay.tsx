import { EventEngagementMetrics } from "@/services/api/base/types";
import { Heart, Eye, Users, TrendingUp, Calendar } from "lucide-react-native";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  radius,
} from "@/theme";

interface EventEngagementDisplayProps {
  engagement: EventEngagementMetrics;
  delay?: number;
}

const EventEngagementDisplay: React.FC<EventEngagementDisplayProps> = memo(
  ({ engagement, delay = 800 }) => {
    const formatNumber = (num: number): string => {
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
      }
      return num.toString();
    };

    const engagementItems = [
      {
        icon: Heart,
        label: "Saves",
        value: engagement.saveCount,
        color: colors.status.error.bg,
        bgColor: `${colors.status.error.bg}15`,
      },
      {
        icon: Eye,
        label: "Scans",
        value: engagement.scanCount,
        color: colors.accent.primary,
        bgColor: colors.accent.muted,
      },
      {
        icon: Users,
        label: "RSVPs",
        value: engagement.rsvpCount,
        color: colors.status.success.text,
        bgColor: `${colors.status.success.text}15`,
      },
      {
        icon: TrendingUp,
        label: "Total",
        value: engagement.totalEngagement,
        color: colors.accent.primary,
        bgColor: colors.accent.muted,
      },
    ];

    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(delay).springify()}
      >
        {/* Main Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            {engagementItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <View key={index} style={styles.metricItem}>
                  <View
                    style={[
                      styles.metricIconContainer,
                      {
                        backgroundColor: item.bgColor,
                        borderColor: `${item.color}20`,
                      },
                    ]}
                  >
                    <IconComponent
                      size={18}
                      color={item.color}
                      strokeWidth={2.5}
                    />
                  </View>
                  <Text style={styles.metricValue}>
                    {formatNumber(item.value)}
                  </Text>
                  <Text style={styles.metricLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* RSVP Breakdown */}
        {engagement.rsvpCount > 0 && (
          <View style={styles.rsvpSection}>
            <View style={styles.rsvpHeader}>
              <Calendar
                size={16}
                color={colors.text.secondary}
                strokeWidth={2}
              />
              <Text style={styles.rsvpHeaderText}>RSVP Breakdown</Text>
            </View>
            <View style={styles.rsvpCard}>
              <View style={styles.rsvpItem}>
                <View
                  style={[styles.rsvpIconContainer, styles.rsvpGoingIcon]}
                >
                  <Users
                    size={16}
                    color={colors.status.success.text}
                    strokeWidth={2}
                  />
                </View>
                <Text style={[styles.rsvpCount, styles.rsvpGoingCount]}>
                  {engagement.goingCount}
                </Text>
                <Text style={styles.rsvpLabel}>Going</Text>
              </View>
              <View style={styles.rsvpItem}>
                <View
                  style={[styles.rsvpIconContainer, styles.rsvpNotGoingIcon]}
                >
                  <Users
                    size={16}
                    color={colors.status.error.bg}
                    strokeWidth={2}
                  />
                </View>
                <Text style={[styles.rsvpCount, styles.rsvpNotGoingCount]}>
                  {engagement.notGoingCount}
                </Text>
                <Text style={styles.rsvpLabel}>Not Going</Text>
              </View>
            </View>
          </View>
        )}

        {/* Last Updated Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated:{" "}
            {new Date(engagement.lastUpdated).toLocaleDateString()}
          </Text>
        </View>
      </Animated.View>
    );
  },
);

EventEngagementDisplay.displayName = "EventEngagementDisplay";

export default EventEngagementDisplay;

const styles = StyleSheet.create({
  metricsSection: {
    marginBottom: spacing.lg,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  metricIconContainer: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  metricValue: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
    textAlign: "center",
  },
  metricLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: "center",
    fontWeight: fontWeight.medium,
  },
  rsvpSection: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginBottom: spacing.lg,
  },
  rsvpHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  rsvpHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  rsvpCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rsvpItem: {
    alignItems: "center",
    flex: 1,
  },
  rsvpIconContainer: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  rsvpGoingIcon: {
    backgroundColor: `${colors.status.success.text}15`,
    borderColor: `${colors.status.success.text}20`,
  },
  rsvpNotGoingIcon: {
    backgroundColor: `${colors.status.error.bg}15`,
    borderColor: `${colors.status.error.bg}20`,
  },
  rsvpCount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  rsvpGoingCount: {
    color: colors.status.success.text,
  },
  rsvpNotGoingCount: {
    color: colors.status.error.bg,
  },
  rsvpLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
  },
});
