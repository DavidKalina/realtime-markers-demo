import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import type { BrowseItineraryResponse } from "@/services/api/modules/sidequests";

interface Props {
  itinerary: BrowseItineraryResponse;
  onAdopted?: () => void;
}

const MAX_EMOJI_PREVIEW = 4;

const ItineraryBrowseCard: React.FC<Props> = ({ itinerary }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const handleView = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/itineraries/[id]" as const,
      params: { id: itinerary.id },
    });
  }, [itinerary.id, router]);

  const emojiPreview = itinerary.objectives
    .slice(0, MAX_EMOJI_PREVIEW)
    .map((i) => i.emoji || "\u{1F4CD}")
    .join(" ");

  const extraStops = itinerary.itemCount - MAX_EMOJI_PREVIEW;

  const stars = itinerary.rating
    ? "\u2605".repeat(itinerary.rating) + "\u2606".repeat(5 - itinerary.rating)
    : null;

  return (
    <Pressable onPress={handleView} style={styles.card}>
      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {itinerary.title || "Untitled Adventure"}
        </Text>

        <Text style={styles.meta} numberOfLines={1}>
          {itinerary.creatorFirstName
            ? `by ${itinerary.creatorFirstName}`
            : "by Explorer"}
          {itinerary.timesAdopted > 0
            ? ` · ${itinerary.timesAdopted} tried`
            : ""}
        </Text>

        <View style={styles.emojiRow}>
          <Text style={styles.emojiPreview}>{emojiPreview}</Text>
          {extraStops > 0 && (
            <Text style={styles.extraStops}>+{extraStops}</Text>
          )}
        </View>

        <Text style={styles.stopsDuration}>
          {itinerary.itemCount} stops · {itinerary.durationHours}h
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.stars}>
          {stars || "No rating"}
        </Text>
        <View style={styles.viewLink}>
          <Text style={styles.viewText}>View</Text>
          <ChevronRight size={12} color="#4ade80" />
        </View>
      </View>
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      width: 240,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      marginRight: spacing.sm,
      overflow: "hidden",
    },
    body: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    title: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    meta: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    emojiRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    emojiPreview: {
      fontSize: 16,
      letterSpacing: 3,
    },
    extraStops: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
    },
    stopsDuration: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 2,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    stars: {
      fontSize: 18,
      color: "#fbbf24",
      letterSpacing: 3,
    },
    viewLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    viewText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "#4ade80",
      textDecorationLine: "underline",
    },
  });

export default ItineraryBrowseCard;
