import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, {
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/services/ApiClient";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  shadows,
} from "@/theme";

interface CommunityItineraryPreviewCardProps {
  itinerary: BrowseItineraryPreview;
  districtName: string;
  onDismiss: () => void;
  style?: ViewStyle;
}

const CommunityItineraryPreviewCardInner: React.FC<
  CommunityItineraryPreviewCardProps
> = ({ itinerary, districtName, onDismiss, style }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const pressScale = useSharedValue(1);

  const handleAdopt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await apiClient.sidequests.adopt(itinerary.id);
      console.log(result)
      onDismiss();
      if (result.id) {
        router.push(`/itineraries/${result.id}` as never);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [itinerary.id, onDismiss, router]);

  const handlePress = useCallback(() => {
    pressScale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withTiming(1, { duration: 100 }, () => {
        scheduleOnRN(handleAdopt);
      }),
    );
  }, [handleAdopt, pressScale]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOut.duration(200)}
      style={style}
      key={itinerary.id}
    >
      <Animated.View style={[styles.card, cardAnimStyle]}>
        {/* District label */}
        <Text style={styles.district}>{districtName}</Text>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {itinerary.title ?? "Untitled Quest"}
        </Text>

        {/* Emoji trail */}
        <View style={styles.emojiTrailRow}>
          {itinerary.items.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Text style={styles.emojiArrow}>{"\u2192"}</Text>}
              <Text style={styles.emojiItem}>{item.emoji ?? "\u{1F4CD}"}</Text>
            </React.Fragment>
          ))}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {itinerary.rating && (
            <Text style={styles.stat}>
              {"\u2B50"} {itinerary.rating.toFixed(1)}
            </Text>
          )}
          <Text style={styles.stat}>{itinerary.durationHours}h</Text>
          {itinerary.timesAdopted > 0 && (
            <Text style={styles.stat}>
              {"\u{1F465}"} {itinerary.timesAdopted} adopted
            </Text>
          )}
          {itinerary.creatorFirstName && (
            <Text style={styles.stat}>by {itinerary.creatorFirstName}</Text>
          )}
        </View>

        {/* Adopt CTA */}
        <Pressable style={styles.adoptButton} onPress={handlePress}>
          <Text style={styles.adoptText}>Claim Quest</Text>
        </Pressable>

        {/* Dismiss tap zone */}
        <Pressable style={styles.dismissHitArea} onPress={onDismiss}>
          <Text style={styles.dismissText}>{"\u2715"}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

export const CommunityItineraryPreviewCard = React.memo(
  CommunityItineraryPreviewCardInner,
);

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      marginHorizontal: spacing.md,
      padding: spacing.lg,
      ...shadows.lg,
    },
    district: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    emojiTrailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    emojiItem: {
      fontSize: fontSize.md,
    },
    emojiArrow: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    stat: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    adoptButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    adoptText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: "#000000",
    },
    dismissHitArea: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissText: {
      fontSize: 12,
      color: colors.text.disabled,
    },
  });
