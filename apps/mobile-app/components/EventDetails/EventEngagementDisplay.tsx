import { EventEngagementMetrics } from "@/services/api/base/types";
import { Heart, Eye, Users, TrendingUp, Calendar } from "lucide-react-native";
import React, { memo } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS } from "../Layout/ScreenLayout";

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
        color: COLORS.errorBackground,
        bgColor: `${COLORS.errorBackground}15`,
      },
      {
        icon: Eye,
        label: "Scans",
        value: engagement.scanCount,
        color: COLORS.accent,
        bgColor: `${COLORS.accent}15`,
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
        color: COLORS.accent,
        bgColor: `${COLORS.accent}15`,
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
                      fontFamily: "SpaceMono",
                      fontSize: 16,
                      fontWeight: "700",
                      color: COLORS.textPrimary,
                      marginBottom: 2,
                      textAlign: "center",
                    }}
                  >
                    {formatNumber(item.value)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "SpaceMono",
                      fontSize: 11,
                      color: COLORS.textSecondary,
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
              borderTopColor: COLORS.divider,
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
                color={COLORS.textSecondary}
                strokeWidth={2}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  fontFamily: "SpaceMono",
                  color: COLORS.textSecondary,
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
                backgroundColor: COLORS.background,
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: COLORS.divider,
              }}
            >
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${"#10b981"}15`,
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: `${"#10b981"}20`,
                  }}
                >
                  <Users
                    size={16}
                    color={"#10b981"}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#10b981",
                    marginBottom: 4,
                  }}
                >
                  {engagement.goingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
                    fontWeight: "500",
                  }}
                >
                  Going
                </Text>
              </View>
              <View style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    backgroundColor: `${COLORS.errorBackground}15`,
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: `${COLORS.errorBackground}20`,
                  }}
                >
                  <Users
                    size={16}
                    color={COLORS.errorBackground}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: COLORS.errorBackground,
                    marginBottom: 4,
                  }}
                >
                  {engagement.notGoingCount}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: COLORS.textSecondary,
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
            borderTopColor: COLORS.divider,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: COLORS.textSecondary,
              fontFamily: "SpaceMono",
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
