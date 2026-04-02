import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight, MapPin, Navigation } from "lucide-react-native";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { getCategoryColor } from "@/utils/categoryColors";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

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

  const category = nextStop?.venueCategory ?? items[0]?.venueCategory ?? "other";
  const accent = getCategoryColor(category);
  const [ar, ag, ab] = useMemo(() => hexToRgb(accent), [accent]);

  const s = useMemo(() => createStyles(colors, accent, ar, ag, ab), [colors, accent, ar, ag, ab]);

  const handlePress = () => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${itinerary.id}` as const);
  };

  if (!itinerary) {
    return null;
  }

  return (
    <Pressable style={s.container} onPress={handlePress}>
      {/* Accent stripe */}
      <View style={s.accentStripe} />

      <View style={s.content}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.labelPill}>
            <Text style={s.labelText}>ACTIVE QUEST</Text>
          </View>
          <Navigation size={14} color={accent} />
        </View>

        {/* Title */}
        <Text style={s.title} numberOfLines={1}>
          {itinerary.title || "Active Adventure"}
        </Text>

        {/* Progress */}
        <View style={s.progressRow}>
          <View style={s.progressTrack}>
            <ProgressFill progress={progress} accent={accent} />
          </View>
          <Text style={s.progressText}>
            {allComplete ? "Done!" : `${checked}/${total}`}
          </Text>
        </View>

        {/* Next stop */}
        {nextStop && !allComplete && (
          <View style={s.nextRow}>
            <Text style={s.nextEmoji}>{nextStop.emoji || "\uD83D\uDCCD"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.nextName} numberOfLines={1}>
                {nextStop.venueName || nextStop.title}
              </Text>
              {nextStop.venueCategory && (
                <Text style={s.nextCategory}>{nextStop.venueCategory}</Text>
              )}
            </View>
            <ChevronRight size={16} color={colors.text.secondary} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

const ProgressFill: React.FC<{ progress: number; accent: string }> = ({ progress, accent }) => {
  const animStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round(progress * 100)}%` as unknown as number, {
      duration: 600,
    }),
  }));

  return (
    <Animated.View
      style={[
        {
          height: "100%",
          borderRadius: 2,
          backgroundColor: accent,
        },
        animStyle,
      ]}
    />
  );
};

const createStyles = (
  colors: Colors,
  accent: string,
  ar: number,
  ag: number,
  ab: number,
) =>
  StyleSheet.create({
    container: {
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.04)`,
    },
    accentStripe: {
      height: 3,
      backgroundColor: accent,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelPill: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    labelText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accent,
      letterSpacing: 1.5,
    },
    title: {
      fontSize: 16,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 22,
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
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
      overflow: "hidden",
    },
    progressText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accent,
      minWidth: 28,
      textAlign: "right",
    },
    nextRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
    },
    nextEmoji: {
      fontSize: 22,
    },
    nextName: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    nextCategory: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 1,
    },
  });

export default ActiveQuestBanner;
