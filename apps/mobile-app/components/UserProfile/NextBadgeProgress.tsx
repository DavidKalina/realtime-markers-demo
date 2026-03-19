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
  radius,
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
        {hasAny ? "NEXT BADGE" : "YOUR FIRST BADGE"}
      </Text>
      <View style={styles.card}>
        <Text style={styles.emoji}>{next.emoji}</Text>
        <View style={styles.content}>
          <Text style={styles.name}>{next.name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {next.description}
          </Text>
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
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    emoji: {
      fontSize: 32,
    },
    content: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    description: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: 2,
    },
    progressTrack: {
      flex: 1,
      height: 4,
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
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
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
