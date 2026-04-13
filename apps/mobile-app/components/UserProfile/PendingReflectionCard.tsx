import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";

interface PendingReflectionCardProps {
  quest: SidequestResponse;
  onRated?: () => void;
}

function formatCompletedDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const STARS = [1, 2, 3, 4, 5] as const;

function PendingReflectionCard({ quest, onRated }: PendingReflectionCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const firstObjective = quest.objectives?.[0];
  const venueName = firstObjective?.venueName;
  const emoji = firstObjective?.emoji || "\u2728";
  const completedWhen = quest.completedAt
    ? formatCompletedDate(quest.completedAt)
    : "";

  const handleRate = useCallback(async (rating: number) => {
    setSelectedRating(rating);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiClient.sidequests.rate(quest.id, rating);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      onRated?.();
    } catch {
      setSelectedRating(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [quest.id, onRated]);

  if (submitted) return null;

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Text style={s.emoji}>{emoji}</Text>
        <View style={s.textWrap}>
          <Text style={s.prompt}>
            You went to {venueName || "a new spot"}{" "}
            {completedWhen ? completedWhen : ""} — how was it?
          </Text>
        </View>
      </View>

      <View style={s.starsRow}>
        {STARS.map((star) => (
          <Pressable
            key={star}
            onPress={() => handleRate(star)}
            disabled={submitting}
            style={s.starButton}
          >
            <Text
              style={[
                s.star,
                selectedRating != null && star <= selectedRating
                  ? s.starFilled
                  : s.starEmpty,
              ]}
            >
              {"\u2605"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: "rgba(251, 191, 36, 0.08)",
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(251, 191, 36, 0.15)",
    },
    topRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    emoji: {
      fontSize: 20,
      marginTop: 2,
    },
    textWrap: {
      flex: 1,
    },
    prompt: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 22,
    },
    starsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    starButton: {
      padding: spacing.xs,
    },
    star: {
      fontSize: 28,
    },
    starFilled: {
      color: "rgba(251, 191, 36, 1)",
    },
    starEmpty: {
      color: "rgba(255, 255, 255, 0.2)",
    },
  });

export default React.memo(PendingReflectionCard);
