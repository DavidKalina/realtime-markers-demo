import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
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

const GREEN = "#86efac";
const PROGRESS_WIDTH = 20;

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

  // Blinking cursor — use very short timing to simulate step
  const cursorOpacity = useSharedValue(1);
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 1 }),
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 1 }),
      ),
      -1,
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const handlePress = () => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${itinerary.id}` as const);
  };

  if (!itinerary) return null;

  // Build ASCII progress bar
  const filled = Math.round(progress * PROGRESS_WIDTH);
  const progressBar = "\u2588".repeat(filled) + "\u2591".repeat(PROGRESS_WIDTH - filled);

  return (
    <Pressable style={s.container} onPress={handlePress}>
      <View style={s.headerRow}>
        <View style={s.statusRow}>
          <Animated.Text style={[s.cursor, cursorStyle]}>{"\u2588"}</Animated.Text>
          <Text style={s.statusLabel}>
            {allComplete ? "QUEST COMPLETE" : "IN PROGRESS"}
          </Text>
        </View>
        <ChevronRight size={14} color={colors.text.disabled} />
      </View>

      <Text style={s.title} numberOfLines={1}>
        {itinerary.title || "Active Adventure"}
      </Text>

      {/* ASCII progress */}
      <View style={s.progressRow}>
        <Text style={s.progressBar}>
          [{progressBar}]
        </Text>
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
      borderColor: `rgba(134, 239, 172, 0.15)`,
      backgroundColor: "rgba(134, 239, 172, 0.03)",
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
    cursor: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: GREEN,
    },
    statusLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: GREEN,
      letterSpacing: 1.5,
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
    progressBar: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: GREEN,
      letterSpacing: -1,
      flex: 1,
    },
    progressPct: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: GREEN,
    },
    nextStop: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
  });

export default ActiveQuestBanner;
