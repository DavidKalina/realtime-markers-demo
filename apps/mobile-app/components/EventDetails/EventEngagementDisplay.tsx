import { EventEngagementMetrics } from "@/services/api/base/types";
import { Heart, Eye, Users, TrendingUp, Calendar } from "lucide-react-native";
import React, { memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// Municipal-friendly color scheme (matching EventDetails)
const MUNICIPAL_COLORS = {
  primary: "#1e40af", // Professional blue
  secondary: "#059669", // Municipal green
  accent: "#f59e0b", // Warm amber
  background: "#f8fafc", // Light gray background
  card: "#ffffff", // White cards
  text: "#1e293b", // Dark slate text
  textSecondary: "#64748b", // Medium gray
  border: "#e2e8f0", // Light border
  success: "#10b981", // Green for success states
  warning: "#f59e0b", // Amber for warnings
  error: "#ef4444", // Red for errors
};

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
        color: MUNICIPAL_COLORS.error,
        bgColor: `${MUNICIPAL_COLORS.error}15`,
      },
      {
        icon: Eye,
        label: "Scans",
        value: engagement.scanCount,
        color: MUNICIPAL_COLORS.primary,
        bgColor: `${MUNICIPAL_COLORS.primary}15`,
      },
      {
        icon: Users,
        label: "RSVPs",
        value: engagement.rsvpCount,
        color: MUNICIPAL_COLORS.success,
        bgColor: `${MUNICIPAL_COLORS.success}15`,
      },
      {
        icon: TrendingUp,
        label: "Total",
        value: engagement.totalEngagement,
        color: MUNICIPAL_COLORS.accent,
        bgColor: `${MUNICIPAL_COLORS.accent}15`,
      },
    ];

    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(delay).springify()}
      >
        {/* Main Metrics */}
        <View style={{ marginBottom: 16 }}>
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
                    paddingHorizontal: 4,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: item.bgColor,
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: 8,
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
                      fontFamily: "Poppins-Regular",
                      fontSize: 16,
                      fontWeight: "700",
                      color: MUNICIPAL_COLORS.text,
                      marginBottom: 2,
                      textAlign: "center",
                    }}
                  >
                    {formatNumber(item.value)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Poppins-Regular",
                      fontSize: 11,
                      color: MUNICIPAL_COLORS.textSecondary,
                      textAlign: "center",
                      fontWeight: "500",
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
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: MUNICIPAL_COLORS.border,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Calendar
                size={16}
                color={MUNICIPAL_COLORS.textSecondary}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  fontFamily: "Poppins-Regular",
                  color: MUNICIPAL_COLORS.textSecondary,
                  marginLeft: 8,
                }}
              >
                RSVP Breakdown
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                backgroundColor: MUNICIPAL_COLORS.background,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: MUNICIPAL_COLORS.border,
              }}
            >
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${MUNICIPAL_COLORS.success}15`,
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: `${MUNICIPAL_COLORS.success}20`,
                  }}
                >
                  <Users
                    size={16}
                    color={MUNICIPAL_COLORS.success}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: MUNICIPAL_COLORS.success,
                    marginBottom: 4,
                  }}
                >
                  {engagement.goingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: MUNICIPAL_COLORS.textSecondary,
                    fontWeight: "500",
                  }}
                >
                  Going
                </Text>
              </View>
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${MUNICIPAL_COLORS.error}15`,
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: `${MUNICIPAL_COLORS.error}20`,
                  }}
                >
                  <Users
                    size={16}
                    color={MUNICIPAL_COLORS.error}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: MUNICIPAL_COLORS.error,
                    marginBottom: 4,
                  }}
                >
                  {engagement.notGoingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: MUNICIPAL_COLORS.textSecondary,
                    fontWeight: "500",
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
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: MUNICIPAL_COLORS.border,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: MUNICIPAL_COLORS.textSecondary,
              fontFamily: "Poppins-Regular",
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
