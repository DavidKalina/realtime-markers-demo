import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  useColors,
  type Colors,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

const ActiveQuestBanner: React.FC = () => {
  const colors = useColors();
  const router = useRouter();
  const itinerary = useActiveItineraryStore((s) => s.itinerary);

  const items = itinerary?.objectives || [];
  const checked = items.filter((i) => i.checkedInAt).length;
  const total = items.length;
  const allComplete = total > 0 && checked === total;
  const progress = total > 0 ? checked / total : 0;

  const nextStop = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((i) => !i.checkedInAt);

  const s = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${itinerary.id}` as const);
  };

  if (!itinerary) return null;

  return (
    <Pressable style={s.container} onPress={handlePress}>
      <View style={s.topRow}>
        <View style={s.left}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: allComplete ? colors.accent.primary : "#86efac" }]} />
            <Text style={[s.statusLabel, { color: allComplete ? colors.accent.primary : "#86efac" }]}>
              {allComplete ? "Quest Complete" : "Active Quest"}
            </Text>
          </View>
          <Text style={s.title} numberOfLines={2}>
            {itinerary.title || "Your Next Adventure"}
          </Text>
        </View>
        <View style={s.chevronWrap}>
          <ChevronRight size={18} color={colors.accent.primary} />
        </View>
      </View>

      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent.primary }]} />
        </View>
        <Text style={s.progressPct}>
          {allComplete ? "\u2713" : `${checked}/${total}`}
        </Text>
      </View>

      {nextStop && !allComplete && (
        <Text style={s.nextStop} numberOfLines={1}>
          Next up: {nextStop.emoji || ""} {nextStop.venueName || nextStop.title}
        </Text>
      )}
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      borderRadius: radius.md,
      backgroundColor: `rgba(${colors.accent.rgb}, 0.08)`,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    left: {
      flex: 1,
      gap: spacing.xs,
    },
    chevronWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `rgba(${colors.accent.rgb}, 0.12)`,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.md,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.5,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: 17,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 24,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255,255,255,0.1)",
      overflow: "hidden",
    },
    progressFill: {
      height: 3,
      borderRadius: 1.5,
    },
    progressPct: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    nextStop: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      opacity: 0.9,
    },
  });

export default ActiveQuestBanner;
