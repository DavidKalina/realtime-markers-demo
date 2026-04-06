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
      <View style={s.headerRow}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: colors.accent.primary }]} />
          <Text style={s.statusLabel}>
            {allComplete ? "Quest Complete" : "In Progress"}
          </Text>
        </View>
        <ChevronRight size={14} color={colors.text.disabled} />
      </View>

      <Text style={s.title} numberOfLines={1}>
        {itinerary.title || "Active Adventure"}
      </Text>

      {/* View-based progress bar */}
      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent.primary }]} />
        </View>
        <Text style={s.progressPct}>
          {allComplete ? "DONE" : `${checked}/${total}`}
        </Text>
      </View>

      {/* Next stop */}
      {nextStop && !allComplete && (
        <Text style={s.nextStop} numberOfLines={1}>
          {"\u25B8"} {nextStop.emoji || "\uD83D\uDCCD"} {nextStop.venueName || nextStop.title}
        </Text>
      )}
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      borderRadius: 6,
      borderWidth: 1,
      borderColor: `rgba(${colors.accent.rgb}, 0.25)`,
      backgroundColor: `rgba(${colors.accent.rgb}, 0.06)`,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
      letterSpacing: 0.5,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },
    progressPct: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    nextStop: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
  });

export default ActiveQuestBanner;
