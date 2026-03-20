import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
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

  const unlocked = badges.filter((b) => b.unlockedAt);
  const locked = badges.filter((b) => !b.unlockedAt);

  if (unlocked.length === 0 && loaded) {
    return null;
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>BADGES</Text>
      {unlocked.map((badge) => (
        <View key={badge.badgeId} style={styles.row}>
          <Text style={styles.emoji}>{badge.emoji}</Text>
          <View style={styles.rowContent}>
            <Text style={styles.name} numberOfLines={1}>
              {badge.name}
            </Text>
            <Text style={styles.meta}>Unlocked</Text>
          </View>
        </View>
      ))}
      {locked.map((badge) => (
        <View key={badge.badgeId} style={[styles.row, styles.rowLocked]}>
          <Text style={[styles.emoji, styles.emojiLocked]}>{badge.emoji}</Text>
          <View style={styles.rowContent}>
            <Text style={[styles.name, styles.nameLocked]} numberOfLines={1}>
              {badge.name}
            </Text>
            {badge.progress > 0 ? (
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
            ) : (
              <Text style={styles.meta}>Locked</Text>
            )}
          </View>
        </View>
      ))}
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
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
      gap: spacing.md,
    },
    rowLocked: {
      opacity: 0.5,
    },
    emoji: {
      fontSize: 22,
    },
    emojiLocked: {
      opacity: 0.6,
    },
    rowContent: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
    },
    nameLocked: {
      color: colors.text.label,
    },
    meta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    progressTrack: {
      flex: 1,
      maxWidth: 80,
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
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
  });

export default BadgeGrid;
