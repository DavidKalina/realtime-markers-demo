import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";

const ActiveQuestBanner: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const itinerary = useActiveItineraryStore((s) => s.itinerary);

  if (!itinerary) {
    return (
      <Pressable
        style={styles.ctaContainer}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/itineraries?expand=1" as const);
        }}
      >
        <Text style={styles.ctaText}>Start an adventure</Text>
        <ChevronRight size={14} color={colors.text.secondary} />
      </Pressable>
    );
  }

  const items = itinerary.items || [];
  const checked = items.filter((i) => i.checkedInAt).length;
  const total = items.length;
  const allComplete = total > 0 && checked === total;
  const progress = total > 0 ? checked / total : 0;

  // Find next unchecked stop
  const nextStop = items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((i) => !i.checkedInAt);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${itinerary.id}` as const);
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {itinerary.title || "Active Adventure"}
        </Text>
        <ChevronRight size={14} color={colors.text.secondary} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <ProgressFill progress={progress} />
      </View>

      <View style={styles.progressLabel}>
        <Text style={styles.progressText}>
          {allComplete ? "Adventure complete!" : `${checked}/${total} stops`}
        </Text>
      </View>

      {/* Next stop preview */}
      {nextStop && !allComplete && (
        <View style={styles.nextStopRow}>
          <Text style={styles.nextStopEmoji}>
            {nextStop.emoji || "\u{1F4CD}"}
          </Text>
          <View style={styles.nextStopInfo}>
            <Text style={styles.nextStopName} numberOfLines={1}>
              {nextStop.title}
            </Text>
            {nextStop.travelNote && (
              <Text style={styles.nextStopTravel} numberOfLines={1}>
                {nextStop.travelNote}
              </Text>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const ProgressFill: React.FC<{ progress: number }> = ({ progress }) => {
  const colors = useColors();
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
          borderRadius: 3,
          backgroundColor: colors.accent.primary,
        },
        animStyle,
      ]}
    />
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: spacing.sm,
    },
    ctaContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    ctaText: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      flex: 1,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      marginRight: spacing.sm,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border.medium,
      overflow: "hidden",
    },
    progressLabel: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    progressText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
    nextStopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    nextStopEmoji: {
      fontSize: 18,
    },
    nextStopInfo: {
      flex: 1,
    },
    nextStopName: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.primary,
    },
    nextStopTravel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 1,
    },
  });

export default ActiveQuestBanner;
