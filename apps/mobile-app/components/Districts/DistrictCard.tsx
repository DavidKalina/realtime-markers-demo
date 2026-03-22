import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
} from "@/theme";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

interface DistrictCardProps {
  district: DistrictBrowseResponse;
  rank: number;
  onPress: (district: DistrictBrowseResponse) => void;
}

/* ─── Activity tag → emoji mapping ─── */

const TAG_EMOJI: Record<string, string> = {
  coffee: "\u2615",
  cafe: "\u2615",
  restaurant: "\u{1F37D}\uFE0F",
  food: "\u{1F37D}\uFE0F",
  dining: "\u{1F37D}\uFE0F",
  bar: "\u{1F378}",
  drinks: "\u{1F378}",
  nightlife: "\u{1F378}",
  park: "\u{1F333}",
  nature: "\u{1F333}",
  outdoors: "\u{1F333}",
  hiking: "\u{1F97E}",
  trail: "\u{1F6B6}",
  museum: "\u{1F3DB}\uFE0F",
  gallery: "\u{1F5BC}\uFE0F",
  art: "\u{1F3A8}",
  market: "\u{1F6D2}",
  shopping: "\u{1F6CD}\uFE0F",
  music: "\u{1F3B5}",
  venue: "\u{1F3A4}",
  fitness: "\u{1F3CB}\uFE0F",
  gym: "\u{1F3CB}\uFE0F",
  yoga: "\u{1F9D8}",
  wellness: "\u{1F9D8}",
  beach: "\u{1F3D6}\uFE0F",
  water: "\u{1F30A}",
  brewery: "\u{1F37A}",
  bakery: "\u{1F950}",
  books: "\u{1F4DA}",
  library: "\u{1F4DA}",
  sports: "\u26BD",
  theater: "\u{1F3AD}",
  cinema: "\u{1F3AC}",
  attraction: "\u{1F3A0}",
};

function getDistrictEmoji(district: DistrictBrowseResponse): string {
  // Try matching top activity tag
  for (const tag of district.activityTags) {
    const key = tag.toLowerCase();
    if (TAG_EMOJI[key]) return TAG_EMOJI[key];
    // Partial match
    for (const [k, v] of Object.entries(TAG_EMOJI)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }

  // Fall back to first preview itinerary item emoji
  for (const preview of district.previewItineraries) {
    const firstEmoji = preview.items?.[0]?.emoji;
    if (firstEmoji) return firstEmoji;
  }

  return "\u{1F4CD}"; // pin fallback
}

const DistrictCard: React.FC<DistrictCardProps> = ({
  district,
  rank,
  onPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const emoji = useMemo(() => getDistrictEmoji(district), [district]);

  const distanceLabel =
    district.distanceMiles < 1
      ? "<1 mi"
      : `${Math.round(district.distanceMiles)} mi`;

  const topTag = district.activityTags[0];

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress(district)}
    >
      <Text style={styles.rank}>#{rank}</Text>

      <View style={styles.emojiCircle}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {district.name}
          </Text>
          {district.momentum?.momentum === "rising" && (
            <Text style={styles.momentumRising}>{"\u2191"}</Text>
          )}
          {district.momentum?.momentum === "cooling" && (
            <Text style={styles.momentumCooling}>{"\u2193"}</Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {district.itineraryCount} adventure
            {district.itineraryCount !== 1 ? "s" : ""}
          </Text>
          {district.momentum &&
            district.momentum.weeklyNewItineraries > 0 && (
              <Text style={styles.freshBadge}>
                +{district.momentum.weeklyNewItineraries} new
              </Text>
            )}
        </View>
      </View>

      <Text style={styles.distance}>{distanceLabel}</Text>

      <ChevronRight size={16} color={colors.text.secondary} />
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    pressed: {
      backgroundColor: colors.bg.card,
    },
    rank: {
      width: 28,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
    },
    emojiCircle: {
      width: 36,
      height: 36,
      borderRadius: radius.lg,
      backgroundColor: colors.bg.elevated,
      justifyContent: "center",
      alignItems: "center",
    },
    emoji: {
      fontSize: 18,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    momentumRising: {
      fontSize: 10,
      color: "#4ade80",
      fontWeight: fontWeight.bold,
    },
    momentumCooling: {
      fontSize: 10,
      color: "#7dd3fc",
      fontWeight: fontWeight.bold,
    },
    freshBadge: {
      fontSize: fontSize.xs,
      color: "#4ade80",
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
    name: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    meta: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    metaText: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    distance: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
  });

export default React.memo(DistrictCard);
