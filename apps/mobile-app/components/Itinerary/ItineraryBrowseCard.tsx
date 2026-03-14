import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { BrowseItineraryResponse } from "@/services/api/modules/itineraries";

interface Props {
  itinerary: BrowseItineraryResponse;
  onAdopted?: () => void;
}

const ItineraryBrowseCard: React.FC<Props> = ({ itinerary, onAdopted }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [adopting, setAdopting] = useState(false);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => !prev);
  }, []);

  const handleAdopt = useCallback(async () => {
    if (adopting) return;
    setAdopting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await apiClient.itineraries.adopt(itinerary.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAdopted?.();
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: result.id },
      });
    } catch (err) {
      console.error("[ItineraryBrowseCard] Adopt failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAdopting(false);
    }
  }, [itinerary.id, adopting, router, onAdopted]);

  const emojiPreview = itinerary.items
    .map((i) => i.emoji || "\u{1F4CD}")
    .join(" ");

  const stars = itinerary.rating
    ? "\u2605".repeat(itinerary.rating) + "\u2606".repeat(5 - itinerary.rating)
    : null;

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={2}>
            {itinerary.title || "Untitled Adventure"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {itinerary.creatorFirstName
              ? `by ${itinerary.creatorFirstName}`
              : "by Explorer"}
            {stars ? ` \u00B7 ${stars}` : ""}
            {itinerary.timesAdopted > 0
              ? ` \u00B7 Tried by ${itinerary.timesAdopted} explorer${itinerary.timesAdopted > 1 ? "s" : ""}`
              : ""}
          </Text>
        </View>
        <Text style={styles.duration}>{itinerary.durationHours}h</Text>
      </View>

      <Text style={styles.emojiPreview}>{emojiPreview}</Text>

      {itinerary.summary && !expanded && (
        <Text style={styles.summary} numberOfLines={2}>
          {itinerary.summary}
        </Text>
      )}

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          layout={LinearTransition.duration(200)}
          style={styles.expandedContent}
        >
          {itinerary.summary && (
            <Text style={styles.summary}>{itinerary.summary}</Text>
          )}

          <Text style={styles.stopsHeader}>{itinerary.itemCount} STOPS</Text>

          {itinerary.items.map((item, index) => (
            <View key={index} style={styles.stopRow}>
              <Text style={styles.stopEmoji}>{item.emoji || "\u{1F4CD}"}</Text>
              <View style={styles.stopInfo}>
                <Text style={styles.stopTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.venueName && (
                  <Text style={styles.stopVenue} numberOfLines={1}>
                    {item.venueName}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {itinerary.itemCount > itinerary.items.length && (
            <Text style={styles.moreStops}>
              +{itinerary.itemCount - itinerary.items.length} more stops
            </Text>
          )}

          <Pressable
            style={[styles.adoptButton, adopting && styles.adoptButtonDisabled]}
            onPress={handleAdopt}
            disabled={adopting}
          >
            <Text style={styles.adoptButtonText}>
              {adopting ? "Starting..." : "Start this adventure"}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      width: 260,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginRight: spacing.sm,
      gap: spacing.xs,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.xs,
    },
    headerLeft: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    meta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    duration: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      backgroundColor: colors.bg.elevated,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    emojiPreview: {
      fontSize: 16,
      letterSpacing: 2,
    },
    summary: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 16,
    },
    expandedContent: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    stopsHeader: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginTop: spacing.xs,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._10,
      paddingVertical: 4,
    },
    stopEmoji: {
      fontSize: 14,
      width: 22,
      textAlign: "center",
    },
    stopInfo: {
      flex: 1,
      gap: 1,
    },
    stopTitle: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    stopVenue: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    moreStops: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      paddingLeft: 32,
    },
    adoptButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    adoptButtonDisabled: {
      opacity: 0.5,
    },
    adoptButtonText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#fff",
    },
  });

export default ItineraryBrowseCard;
