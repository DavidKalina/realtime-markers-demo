import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/services/ApiClient";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  fontFamily,
  radius,
} from "@/theme";

const VIBE_TAG_CONFIG: Record<string, { emoji: string; label: string }> = {
  HIDDEN_GEM: { emoji: "\u{1F48E}", label: "Hidden Gem" },
  BRING_FRIENDS: { emoji: "\u{1F46F}", label: "Bring Friends" },
  GREAT_FOR_SOLO: { emoji: "\u{1F9D8}", label: "Great Solo" },
  CASH_ONLY: { emoji: "\u{1F4B5}", label: "Cash Only" },
  OUTDOOR: { emoji: "\u{1F333}", label: "Outdoor" },
  KID_FRIENDLY: { emoji: "\u{1F476}", label: "Kid Friendly" },
  LOUD: { emoji: "\u{1F50A}", label: "Loud" },
  CHILL: { emoji: "\u{1F31C}", label: "Chill" },
};

interface VibeTagData {
  tag: string;
  count: number;
  userHasTagged: boolean;
}

interface VibeTagSectionProps {
  eventId: string;
}

const VibeTagSection: React.FC<VibeTagSectionProps> = ({ eventId }) => {
  const [tags, setTags] = useState<VibeTagData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const result = await apiClient.events.getVibeTags(eventId);
        setTags(result.tags);
      } catch (error) {
        console.error("Error fetching vibe tags:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, [eventId]);

  const handleToggleTag = useCallback(
    async (tag: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const existing = tags.find((t) => t.tag === tag);
      const isRemoving = existing?.userHasTagged;

      // Optimistic update
      setTags((prev) => {
        if (isRemoving) {
          return prev
            .map((t) =>
              t.tag === tag
                ? { ...t, count: t.count - 1, userHasTagged: false }
                : t,
            )
            .filter((t) => t.count > 0);
        }
        const found = prev.find((t) => t.tag === tag);
        if (found) {
          return prev.map((t) =>
            t.tag === tag
              ? { ...t, count: t.count + 1, userHasTagged: true }
              : t,
          );
        }
        return [...prev, { tag, count: 1, userHasTagged: true }];
      });

      try {
        const result = isRemoving
          ? await apiClient.events.removeVibeTag(eventId, tag)
          : await apiClient.events.addVibeTag(eventId, tag);
        setTags(result.tags);
      } catch (error) {
        console.error("Error toggling vibe tag:", error);
        // Re-fetch on error to get correct state
        try {
          const result = await apiClient.events.getVibeTags(eventId);
          setTags(result.tags);
        } catch {
          // Ignore re-fetch error
        }
      }
    },
    [eventId, tags],
  );

  if (loading) return null;

  // Build the list: show existing tags + untagged options
  const taggedSet = new Set(tags.map((t) => t.tag));
  const allTagKeys = Object.keys(VIBE_TAG_CONFIG);
  const untagged = allTagKeys.filter((k) => !taggedSet.has(k));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vibes</Text>
      <View style={styles.chipRow}>
        {tags.map((t) => {
          const config = VIBE_TAG_CONFIG[t.tag];
          if (!config) return null;
          return (
            <TouchableOpacity
              key={t.tag}
              style={[styles.chip, t.userHasTagged && styles.chipActive]}
              onPress={() => handleToggleTag(t.tag)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{config.emoji}</Text>
              <Text
                style={[
                  styles.chipLabel,
                  t.userHasTagged && styles.chipLabelActive,
                ]}
              >
                {config.label}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  t.userHasTagged && styles.chipCountActive,
                ]}
              >
                {t.count}
              </Text>
            </TouchableOpacity>
          );
        })}
        {untagged.map((tag) => {
          const config = VIBE_TAG_CONFIG[tag];
          return (
            <TouchableOpacity
              key={tag}
              style={styles.chip}
              onPress={() => handleToggleTag(tag)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{config.emoji}</Text>
              <Text style={styles.chipLabel}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing._6,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  chipActive: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  chipEmoji: {
    fontSize: fontSize.sm,
  },
  chipLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
  chipLabelActive: {
    color: "#f59e0b",
    fontWeight: fontWeight.medium,
  },
  chipCount: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    marginLeft: 2,
  },
  chipCountActive: {
    color: "#f59e0b",
  },
});

export default VibeTagSection;
