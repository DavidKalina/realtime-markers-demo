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
import { getDistrictEmoji } from "@/utils/districtUtils";

interface DistrictCardProps {
  district: DistrictBrowseResponse;
  rank: number;
  onPress: (district: DistrictBrowseResponse) => void;
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
