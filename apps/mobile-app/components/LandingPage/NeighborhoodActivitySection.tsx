import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import TierBadge from "@/components/Gamification/TierBadge";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface ActivityItemData {
  type: "discovery" | "trending";
  event: {
    id: string;
    title: string;
    emoji?: string;
    discoverer?: {
      id: string;
      firstName?: string;
      avatarUrl?: string;
      currentTier?: string;
    };
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface NeighborhoodActivitySectionProps {
  userLat?: number;
  userLng?: number;
}

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const NeighborhoodActivitySection: React.FC<
  NeighborhoodActivitySectionProps
> = ({ userLat, userLng }) => {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const result = await apiClient.events.getNeighborhoodActivity({
          userLat,
          userLng,
          limit: 10,
        });
        setItems(result.activity as ActivityItemData[]);
      } catch (error) {
        console.error("Error fetching neighborhood activity:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [userLat, userLng]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Neighborhood Activity</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.text.secondary} />
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Neighborhood Activity</Text>
      <View style={styles.timeline}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={`${item.event.id}-${item.type}-${index}`}
            style={styles.timelineItem}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/details" as const,
                params: { eventId: item.event.id },
              });
            }}
          >
            {/* Timeline dot and line */}
            <View style={styles.timelineDotContainer}>
              <View
                style={[
                  styles.timelineDot,
                  item.type === "trending"
                    ? styles.trendingDot
                    : styles.discoveryDot,
                ]}
              />
              {index < items.length - 1 && <View style={styles.timelineLine} />}
            </View>

            {/* Content */}
            <View style={styles.itemContent}>
              <View style={styles.itemHeader}>
                <Text style={styles.emoji}>
                  {item.event.emoji || "\u{1F4CD}"}
                </Text>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.event.title}
                  </Text>
                  <View style={styles.itemMeta}>
                    <View
                      style={[
                        styles.typeBadge,
                        item.type === "trending"
                          ? styles.trendingBadge
                          : styles.discoveryBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBadgeText,
                          item.type === "trending"
                            ? styles.trendingBadgeText
                            : styles.discoveryBadgeText,
                        ]}
                      >
                        {item.type === "trending" ? "Trending" : "Discovered"}
                      </Text>
                    </View>
                    <Text style={styles.timeAgo}>
                      {formatTimeAgo(item.timestamp)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Discoverer info for discovery items */}
              {item.type === "discovery" && item.event.discoverer && (
                <View style={styles.discovererRow}>
                  {item.event.discoverer.currentTier && (
                    <TierBadge
                      tier={item.event.discoverer.currentTier}
                      size="sm"
                    />
                  )}
                  <Text style={styles.discovererName}>
                    {item.event.discoverer.firstName || "Someone"}
                  </Text>
                </View>
              )}
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
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  timeline: {
    paddingHorizontal: spacing.lg,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timelineDotContainer: {
    alignItems: "center",
    width: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  discoveryDot: {
    backgroundColor: colors.accent.primary,
  },
  trendingDot: {
    backgroundColor: "#f59e0b",
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.default,
    marginVertical: 4,
  },
  itemContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 20,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius["2xl"],
  },
  discoveryBadge: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
  },
  trendingBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
  },
  discoveryBadgeText: {
    color: colors.accent.primary,
  },
  trendingBadgeText: {
    color: "#f59e0b",
  },
  timeAgo: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  discovererRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: 28,
  },
  discovererName: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

export default NeighborhoodActivitySection;
