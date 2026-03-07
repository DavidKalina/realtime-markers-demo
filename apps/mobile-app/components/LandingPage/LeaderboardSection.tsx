import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        {contributors.map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const rankColor = RANK_COLORS[entry.rank];
          const tierEmoji =
            TIER_EMOJI[entry.currentTier] || TIER_EMOJI.Explorer;
          const displayName =
            [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
            "Anonymous";
          const isLast = index === contributors.length - 1;

          return (
            <View
              key={entry.userId}
              style={[
                styles.row,
                isCurrentUser && styles.rowHighlight,
                isLast && styles.rowLast,
              ]}
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
                <Text style={styles.meta} numberOfLines={1}>
                  {[entry.currentTier, entry.label]
                    .filter(Boolean)
                    .join(" \u00B7 ")}
                </Text>
              </View>

              <Text style={styles.score}>{entry.contribution}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    marginBottom: spacing["2xl"],
  },
  title: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.mono,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    gap: spacing._10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowHighlight: {
    opacity: 1,
  },
  rank: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
    lineHeight: 18,
  },
  nameHighlight: {
    color: colors.accent.primary,
  },
  meta: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.disabled,
    lineHeight: 16,
  },
  score: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

export default ContributorsSection;
