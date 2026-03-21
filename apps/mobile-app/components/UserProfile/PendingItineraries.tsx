import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { apiClient } from "@/services/ApiClient";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import {
  differenceInCalendarDays,
  differenceInMinutes,
  formatDate,
  formatDistance,
  getUnixTime,
  parseISO
} from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const dateStringToUnixTime = (dateString: string) => {
  return getUnixTime(parseISO(dateString));
};

const distanceFromNow = (dateString: string) => {
  const plannedDate = parseISO(dateString);
  const now = new Date();
  const daysFromNow = differenceInCalendarDays(plannedDate, now);
  const minutesFromNow = differenceInMinutes(plannedDate, now);

  if (daysFromNow < 0) {
    return "expired";
  } else if (daysFromNow === 0) {
    if (minutesFromNow <= 3) {
      return "now";
    }
    return `in ${formatDistance(plannedDate, now)}`;
  } else if (daysFromNow === 1) {
    return "tomorrow";
  }
  return formatDate(plannedDate, "MMM dd");
};

interface PendingItinerariesProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const INTENTION_EMOJI: Record<string, string> = {
  recharge: "\u{1F9D8}",
  explore: "\u{1F9ED}",
  socialize: "\u{1F37B}",
  move: "\u{1F3C3}",
  learn: "\u{1F4DA}",
  treat_yourself: "\u{2728}",
  other: "\u{1F30D}",
};

const MAX_CARDS = 3;

const PendingItineraries: React.FC<PendingItinerariesProps> = ({
  onRefetchRef,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const activeId = useActiveItineraryStore((s) => s.itinerary?.id);

  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    try {
      const result = await apiClient.itineraries.list(20);
      const pending = result.data.filter(
        (it) => it.status === "READY" && !it.completedAt && it.id !== activeId,
      );
      setItineraries(pending);
    } catch (err) {
      console.error("[PendingItineraries] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchPending;
    }
  }, [onRefetchRef, fetchPending]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.text.disabled} />
      </View>
    );
  }

  if (itineraries.length === 0) return null;

  const displayed = [...itineraries]
    .filter((it) => distanceFromNow(it.plannedDate) !== "expired")
    .sort(
      (a, b) =>
        dateStringToUnixTime(a.plannedDate) -
        dateStringToUnixTime(b.plannedDate),
    )
    .slice(0, MAX_CARDS);
  const remaining = itineraries.length - MAX_CARDS;

  return (
    <View>
      <Text style={styles.sectionLabel}>READY TO GO</Text>
      {displayed.map((it) => {
        const emojiStrip = it.items
          .slice(0, 4)
          .map((item) => item.emoji || "\u{1F4CD}")
          .join(" ");
        const intentionEmoji = it.intention
          ? INTENTION_EMOJI[it.intention] || "\u{1F30D}"
          : null;

        return (
          <Pressable
            key={it.id}
            style={styles.card}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/itineraries/${it.id}` as const);
            }}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {it.title || "Untitled Adventure"}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {emojiStrip} {"\u00B7"} {it.items.length}{" "}
                {it.items.length === 1 ? "stop" : "stops"}
                {intentionEmoji ? ` \u00B7 ${intentionEmoji}` : ""}
              </Text>
              <Text style={styles.cardDistanceFromNow}>
                {distanceFromNow(it.plannedDate)}
              </Text>
            </View>
            <ChevronRight size={14} color={colors.text.secondary} />
          </Pressable>
        );
      })}
      {remaining > 0 && (
        <Pressable
          style={styles.viewAllRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/itineraries" as const);
          }}
        >
          <Text style={styles.viewAllText}>
            View all {itineraries.length} adventures {"\u2192"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    loadingContainer: {
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
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
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    cardContent: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
    },
    cardMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    cardDistanceFromNow: {
      fontSize: 10,
      marginLeft: "auto",
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    viewAllRow: {
      paddingVertical: spacing.md,
    },
    viewAllText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
    },
  });

export default PendingItineraries;
