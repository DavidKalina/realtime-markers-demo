import { EventEngagementMetrics } from "@/services/api/base/types";
import { Heart, Eye, Users, TrendingUp, Calendar } from "lucide-react-native";
import React, { memo } from "react";
import { Text, View } from "react-native";
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
        color: "#10b981",
        bgColor: `${"#10b981"}15`,
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
        <View style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {engagementItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <View
                  key={index}
                  style={{
                    alignItems: "center",
                    flex: 1,
                    paddingHorizontal: spacing.xs,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: item.bgColor,
                      borderRadius: radius.sm,
                      padding: spacing.sm,
                      marginBottom: spacing.sm,
                      borderWidth: 1,
                      borderColor: `${item.color}20`,
                    }}
                  >
                    <IconComponent
                      size={18}
                      color={item.color}
                      strokeWidth={2.5}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.bold,
                      color: colors.text.primary,
                      marginBottom: 2,
                      textAlign: "center",
                    }}
                  >
                    {formatNumber(item.value)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 11,
                      color: colors.text.secondary,
                      textAlign: "center",
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* RSVP Breakdown */}
        {engagement.rsvpCount > 0 && (
          <View
            style={{
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border.default,
              marginBottom: spacing.lg,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              <Calendar
                size={16}
                color={colors.text.secondary}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  fontFamily: fontFamily.mono,
                  color: colors.text.secondary,
                  marginLeft: spacing.sm,
                }}
              >
                RSVP Breakdown
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                backgroundColor: colors.bg.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.xl,
                borderWidth: 1,
                borderColor: colors.border.default,
              }}
            >
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${"#10b981"}15`,
                    borderRadius: radius.sm,
                    padding: spacing.sm,
                    marginBottom: spacing.sm,
                    borderWidth: 1,
                    borderColor: `${"#10b981"}20`,
                  }}
                >
                  <Users size={16} color={"#10b981"} strokeWidth={2} />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                    color: "#10b981",
                    marginBottom: spacing.xs,
                  }}
                >
                  {engagement.goingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.text.secondary,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Going
                </Text>
              </View>
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${colors.status.error.bg}15`,
                    borderRadius: radius.sm,
                    padding: spacing.sm,
                    marginBottom: spacing.sm,
                    borderWidth: 1,
                    borderColor: `${colors.status.error.bg}20`,
                  }}
                >
                  <Users
                    size={16}
                    color={colors.status.error.bg}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={{
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                    color: colors.status.error.bg,
                    marginBottom: spacing.xs,
                  }}
                >
                  {engagement.notGoingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.text.secondary,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Not Going
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Last Updated Footer */}
        <View
          style={{
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border.default,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.text.secondary,
              fontFamily: fontFamily.mono,
              fontStyle: "italic",
            }}
          >
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
