import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
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

interface NextBadgeProgressProps {
  /** Switch to the Insights tab where BadgeGrid lives */
  onViewBadges?: () => void;
}

const NextBadgeProgress: React.FC<NextBadgeProgressProps> = ({
  onViewBadges,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [badges, setBadges] = useState<UserBadge[] | null>(null);

  const fetchBadges = useCallback(async () => {
    try {
      const data = await apiClient.badges.getMyBadges();
      setBadges(data);
    } catch (err) {
      console.error("[NextBadgeProgress] Failed to fetch:", err);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  if (!badges) return null;

  const locked = badges.filter((b) => !b.unlockedAt);
  const hasAny = badges.some((b) => b.unlockedAt);

  if (locked.length === 0) return null; // All badges unlocked

  // Pick the badge closest to being unlocked (highest progress ratio)
  const next = locked.reduce((best, b) => {
    const ratio = b.progress / b.threshold;
    const bestRatio = best.progress / best.threshold;
    return ratio > bestRatio ? b : best;
  }, locked[0]);

  const pct = Math.min(100, Math.round((next.progress / next.threshold) * 100));

  return (
    <View>
      <Text style={styles.sectionLabel}>
        {hasAny ? "NEXT BADGE" : "UNLOCK YOUR FIRST BADGE"}
      </Text>
      <View style={styles.row}>
        <Text style={styles.emoji}>{next.emoji}</Text>
        <View style={styles.rowContent}>
          <Text style={styles.name}>{next.name}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${pct}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {next.progress}/{next.threshold}
            </Text>
          </View>
        </View>
      </View>
      {hasAny && onViewBadges && (
        <Pressable
          style={styles.viewAllRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onViewBadges();
          }}
        >
          <Text style={styles.viewAllText}>View all badges {"\u2192"}</Text>
        </Pressable>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
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
    emoji: {
      fontSize: 22,
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
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
    viewAllRow: {
      paddingVertical: spacing.sm,
    },
    viewAllText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
    },
  });

export default NextBadgeProgress;
