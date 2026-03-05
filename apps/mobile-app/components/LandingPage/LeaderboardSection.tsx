import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import {
  colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import type { ContributorEntry } from "@/services/api/modules/leaderboard";

const TIER_EMOJI: Record<string, string> = {
  Explorer: "\u{1F9ED}",
  Scout: "\u{1F52D}",
  Curator: "\u{2B50}",
  Ambassador: "\u{1F451}",
};

const RANK_COLORS: Record<number, string> = {
  1: "#fbbf24", // gold
  2: "#a0a0a0", // silver
  3: "#cd7f32", // bronze
};

interface ContributorsSectionProps {
  contributors: ContributorEntry[];
  currentUserId?: string;
  city?: string;
}

const ContributorsSection: React.FC<ContributorsSectionProps> = ({
  contributors,
  currentUserId,
  city,
}) => {
  if (!contributors || contributors.length === 0) {
    return null;
  }

  const cityLabel = city ? city.split(",")[0].trim() : "Your City";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contributors</Text>
      <Text style={styles.subtitle}>
        {cityLabel} &middot; Growing the Garden
      </Text>

      <View style={styles.listContainer}>
        {contributors.map((entry) => {
          const isCurrentUser = entry.userId === currentUserId;
          const rankColor = RANK_COLORS[entry.rank];
          const tierEmoji =
            TIER_EMOJI[entry.currentTier] || TIER_EMOJI.Explorer;
          const displayName =
            [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
            "Anonymous";

          return (
            <View
              key={entry.userId}
              style={[styles.row, isCurrentUser && styles.rowHighlight]}
            >
              <Text
                style={[
                  styles.rank,
                  rankColor ? { color: rankColor } : undefined,
                ]}
              >
                #{entry.rank}
              </Text>

              {entry.avatarUrl ? (
                <Image
                  source={{ uri: entry.avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarEmoji}>{tierEmoji}</Text>
                </View>
              )}

              <View style={styles.info}>
                <Text
                  style={[styles.name, isCurrentUser && styles.nameHighlight]}
                  numberOfLines={1}
                >
                  {displayName}
                  {isCurrentUser ? " (you)" : ""}
                </Text>
                <Text style={styles.tier}>{entry.currentTier}</Text>
                <Text style={styles.label}>{entry.label}</Text>
              </View>

              <View style={styles.countContainer}>
                <Text style={styles.countNumber}>{entry.contribution}</Text>
                <Text style={styles.countLabel}>score</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.text.label,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  listContainer: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowHighlight: {
    backgroundColor: colors.accent.muted,
  },
  rank: {
    width: 28,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
    textAlign: "center",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: spacing.sm,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: spacing.sm,
    backgroundColor: colors.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 14,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  name: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  nameHighlight: {
    color: colors.accent.primary,
  },
  tier: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    marginTop: 1,
  },
  label: {
    fontSize: 9,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  countContainer: {
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  countNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.accent.primary,
    fontFamily: fontFamily.mono,
  },
  countLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
});

export default ContributorsSection;
