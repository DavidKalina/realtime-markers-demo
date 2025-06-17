import { EventEngagementMetrics } from "@/services/api/base/types";
import { COLORS } from "../Layout/ScreenLayout";
import { Heart, Eye, Users, TrendingUp } from "lucide-react-native";
import React, { memo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface EventEngagementDisplayProps {
  engagement: EventEngagementMetrics;
  delay?: number;
  isOverlay?: boolean;
}

const EventEngagementDisplay: React.FC<EventEngagementDisplayProps> = memo(
  ({ engagement, delay = 800, isOverlay = false }) => {
    const { width } = useWindowDimensions();
    const isSmallScreen = width < 375;

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
        color: "#e74c3c",
      },
      {
        icon: Eye,
        label: "Scans",
        value: engagement.scanCount,
        color: "#3498db",
      },
      {
        icon: Users,
        label: "RSVPs",
        value: engagement.rsvpCount,
        color: "#2ecc71",
      },
      {
        icon: TrendingUp,
        label: "Total",
        value: engagement.totalEngagement,
        color: COLORS.accent,
      },
    ];

    if (isOverlay) {
      return (
        <Animated.View
          entering={FadeInDown.duration(600).delay(delay).springify()}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: 14,
            paddingVertical: 4,
            paddingHorizontal: 9,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.13,
            shadowRadius: 3,
            elevation: 4,
            borderWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: undefined,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {engagementItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <View
                  key={index}
                  style={{
                    alignItems: "center",
                    minWidth: 28,
                    position: "relative",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: `${item.color}30`,
                      borderRadius: 5,
                      padding: 4,
                      marginBottom: 1,
                      position: "relative",
                    }}
                  >
                    <IconComponent
                      size={14}
                      color={item.color}
                      strokeWidth={1.8}
                    />
                    {/* Badge count */}
                    <View
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: COLORS.accent,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 3,
                        zIndex: 2,
                        borderWidth: 1,
                        borderColor: "#fff",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: "700",
                          fontFamily: "SpaceMono",
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatNumber(item.value)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* RSVP Breakdown - just numbers, no text */}
          {engagement.rsvpCount > 0 && (
            <View
              style={{
                marginLeft: 10,
                borderLeftWidth: 1,
                borderLeftColor: "rgba(255,255,255,0.15)",
                paddingLeft: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: "#2ecc71",
                  marginRight: 2,
                }}
              >
                {engagement.goingCount}
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#e74c3c" }}
              >
                {engagement.notGoingCount}
              </Text>
            </View>
          )}
        </Animated.View>
      );
    }

    // Original full-size display for non-overlay use
    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(delay).springify()}
        style={{
          borderRadius: 12,
          padding: isSmallScreen ? 12 : 16,
          marginHorizontal: 16,
          marginVertical: 8,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            flexWrap: "wrap",
            gap: isSmallScreen ? 4 : 8,
          }}
        >
          {engagementItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <View
                key={index}
                style={{
                  alignItems: "center",
                  minWidth: isSmallScreen ? 50 : 60,
                  paddingVertical: 8,
                }}
              >
                <View
                  style={{
                    backgroundColor: `${item.color}20`,
                    borderRadius: 8,
                    padding: isSmallScreen ? 6 : 8,
                    marginBottom: 4,
                  }}
                >
                  <IconComponent
                    size={isSmallScreen ? 16 : 20}
                    color={item.color}
                    strokeWidth={2.5}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: "SpaceMono",
                    fontSize: isSmallScreen ? 14 : 16,
                    fontWeight: "700",
                    color: COLORS.textPrimary,
                    marginBottom: 2,
                  }}
                >
                  {formatNumber(item.value)}
                </Text>
                <Text
                  style={{
                    fontFamily: "SpaceMono",
                    fontSize: isSmallScreen ? 10 : 12,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* RSVP Breakdown */}
        {engagement.rsvpCount > 0 && (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: `${COLORS.textSecondary}20`,
            }}
          >
            <Text
              style={{
                fontSize: isSmallScreen ? 12 : 14,
                fontWeight: "600",
                fontFamily: "SpaceMono",
                color: COLORS.textSecondary,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              RSVP Breakdown
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: isSmallScreen ? 14 : 16,
                    fontWeight: "700",
                    color: "#2ecc71",
                  }}
                >
                  {engagement.goingCount}
                </Text>
                <Text
                  style={{
                    fontSize: isSmallScreen ? 10 : 12,
                    color: COLORS.textSecondary,
                  }}
                >
                  Going
                </Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: isSmallScreen ? 14 : 16,
                    fontWeight: "700",
                    color: "#e74c3c",
                  }}
                >
                  {engagement.notGoingCount}
                </Text>
                <Text
                  style={{
                    fontSize: isSmallScreen ? 10 : 12,
                    color: COLORS.textSecondary,
                  }}
                >
                  Not Going
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Last Updated */}
        <Text
          style={{
            fontSize: 10,
            color: COLORS.textSecondary,
            textAlign: "center",
            marginTop: 8,
            fontStyle: "italic",
          }}
        >
          Last updated: {new Date(engagement.lastUpdated).toLocaleDateString()}
        </Text>
      </Animated.View>
    );
  },
);

EventEngagementDisplay.displayName = "EventEngagementDisplay";

export default EventEngagementDisplay;
