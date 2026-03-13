import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { UserBadge } from "@/services/api/modules/badges";

interface BadgeGridProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const BadgeGrid: React.FC<BadgeGridProps> = ({ onRefetchRef }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const data = await apiClient.badges.getMyBadges();
      setBadges(data);
    } catch (err) {
      console.error("Failed to fetch badges:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchBadges;
    }
  }, [onRefetchRef, fetchBadges]);

  if (!loaded) return null;

  // Split into unlocked and locked
  const unlocked = badges.filter((b) => b.unlockedAt);
  const locked = badges.filter((b) => !b.unlockedAt);

  if (unlocked.length === 0 && loaded) {
    return null; // Don't show section if no badges earned
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>BADGES</Text>
      <View style={styles.grid}>
        {unlocked.map((badge) => (
          <View key={badge.badgeId} style={styles.badgeItem}>
            <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
            <Text style={styles.badgeName} numberOfLines={1}>
              {badge.name}
            </Text>
          </View>
        ))}
        {locked.map((badge) => (
          <View
            key={badge.badgeId}
            style={[styles.badgeItem, styles.badgeLocked]}
          >
            <Text style={[styles.badgeEmoji, styles.badgeEmojiLocked]}>
              {badge.emoji}
            </Text>
            <Text
              style={[styles.badgeName, styles.badgeNameLocked]}
              numberOfLines={1}
            >
              {badge.name}
            </Text>
            {badge.progress > 0 && (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, (badge.progress / badge.threshold) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {badge.progress}/{badge.threshold}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    badgeItem: {
      width: "30%",
      alignItems: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.accent,
    },
    badgeLocked: {
      opacity: 0.5,
      borderColor: colors.border.default,
    },
    badgeEmoji: {
      fontSize: 24,
      marginBottom: 4,
    },
    badgeEmojiLocked: {
      opacity: 0.4,
    },
    badgeName: {
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      textAlign: "center",
    },
    badgeNameLocked: {
      color: colors.text.label,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
      width: "100%",
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
      backgroundColor: colors.accent.primary,
    },
    progressText: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
  });

export default BadgeGrid;
