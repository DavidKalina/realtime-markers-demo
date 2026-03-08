import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import ItineraryTimeline from "@/components/Itinerary/ItineraryTimeline";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import {
  useColors,
  fontFamily,
  fontWeight,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";

// --- Animated counter (reused for hero stats) ---

const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  color: string;
  style?: object;
}> = ({ value, prefix = "", suffix = "", delay = 0, color, style }) => {
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      delay,
      withTiming(value, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, delay]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return (
    <Text style={[{ color }, style]}>
      {prefix}{displayed}{suffix}
    </Text>
  );
};

// --- Hero stat pill ---

const STAT_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#f9a8d4"];

const ItineraryDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.itineraries
      .getById(id)
      .then(setItinerary)
      .catch((err) => {
        console.error("[ItineraryDetail] Failed to fetch:", err);
        setError("Failed to load itinerary");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    Alert.alert("Delete itinerary?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await apiClient.itineraries.deleteById(id);
            router.back();
          } catch (err) {
            console.error("[ItineraryDetail] Failed to delete:", err);
          }
        },
      },
    ]);
  }, [id, router]);

  const handleStartItinerary = useCallback(() => {
    if (!itinerary) return;

    const sortedItems = (itinerary.items ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.venueAddress || item.venueName || item.title);

    if (sortedItems.length === 0) {
      Alert.alert("No stops", "This itinerary has no addressable stops.");
      return;
    }

    const stopLabel = (item: (typeof sortedItems)[0]) => {
      if (item.latitude && item.longitude) {
        return `${item.latitude},${item.longitude}`;
      }
      return item.venueAddress || item.venueName || item.title;
    };

    const stopLabels = sortedItems.map((item) => stopLabel(item));

    const openGoogleMapsRoute = () => {
      const path = stopLabels.map(encodeURIComponent).join("/");
      Linking.openURL(`https://www.google.com/maps/dir/${path}`);
    };

    const openAppleMapsStop = (index: number) => {
      const label = stopLabels[index];
      Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(label)}&dirflg=w`);
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            `Full Route (${stopLabels.length} stops)`,
            ...sortedItems.map((item) => `${item.emoji || "\u{1F4CD}"} ${item.title}`),
          ],
          cancelButtonIndex: 0,
          title: "Navigate",
          message: "Full route opens in Google Maps. Individual stops open in Apple Maps.",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openGoogleMapsRoute();
          else if (buttonIndex > 1) openAppleMapsStop(buttonIndex - 2);
        },
      );
    } else {
      openGoogleMapsRoute();
    }
  }, [itinerary]);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  // --- Loading / Error states ---

  if (isLoading) {
    return (
      <Screen isScrollable={false} bannerTitle="Itinerary" showBackButton onBack={handleBack} noAnimation>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !itinerary) {
    return (
      <Screen isScrollable={false} bannerTitle="Itinerary" showBackButton onBack={handleBack} noAnimation>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Not found"}</Text>
        </View>
      </Screen>
    );
  }

  // --- Computed values ---

  const items = itinerary.items ?? [];
  const totalCost = items.reduce((sum, i) => sum + (Number(i.estimatedCost) || 0), 0);
  const firstTime = items.length > 0
    ? formatTime(items.sort((a, b) => a.sortOrder - b.sortOrder)[0].startTime)
    : null;
  const lastItem = items.length > 0
    ? items.sort((a, b) => a.sortOrder - b.sortOrder)[items.length - 1]
    : null;
  const lastTime = lastItem ? formatTime(lastItem.endTime) : null;

  return (
    <Screen
      isScrollable={false}
      bannerTitle={itinerary.city}
      showBackButton
      onBack={handleBack}
      noAnimation
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <Animated.View
          entering={FadeIn.duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          {/* Title block */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(450).easing(Easing.out(Easing.cubic))}
          >
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>ITINERARY</Text>
              </View>
              <Text style={styles.heroDot}> · </Text>
              <Text style={styles.heroDate}>{formatDate(itinerary.plannedDate)}</Text>
            </View>
          </Animated.View>

          {/* Summary */}
          {itinerary.summary && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(450).easing(Easing.out(Easing.cubic))}
            >
              <Text style={styles.heroSummary}>{itinerary.summary}</Text>
            </Animated.View>
          )}

          {/* Stat chips — compact horizontal row */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(450).easing(Easing.out(Easing.cubic))}
            style={styles.chipRow}
          >
            {firstTime && lastTime && (
              <View style={[styles.statChip, { borderColor: "rgba(147, 197, 253, 0.25)" }]}>
                <Text style={[styles.statChipValue, { color: STAT_COLORS[0] }]}>
                  {firstTime} – {lastTime}
                </Text>
              </View>
            )}
            <View style={[styles.statChip, { borderColor: "rgba(134, 239, 172, 0.25)" }]}>
              <AnimatedNumber
                value={items.length}
                suffix=" stops"
                delay={400}
                color={STAT_COLORS[1]}
                style={styles.statChipValue}
              />
            </View>
            {totalCost > 0 && (
              <View style={[styles.statChip, { borderColor: "rgba(196, 181, 253, 0.25)" }]}>
                <AnimatedNumber
                  value={totalCost}
                  prefix="~$"
                  delay={500}
                  color={STAT_COLORS[3]}
                  style={styles.statChipValue}
                />
              </View>
            )}
          </Animated.View>

          {/* Vibe tags */}
          {itinerary.activityTypes && itinerary.activityTypes.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(400).duration(400).easing(Easing.out(Easing.cubic))}
              style={styles.vibeRow}
            >
              {itinerary.activityTypes.map((vibe, i) => (
                <Animated.View
                  key={vibe}
                  entering={FadeInRight.delay(450 + i * 60).duration(350)}
                  style={styles.vibePill}
                >
                  <Text style={styles.vibeText}>{vibe}</Text>
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Divider ── */}
        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.divider}
        />

        {/* ── Timeline ── */}
        <ItineraryTimeline items={items} />

        {/* ── Actions ── */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(400).easing(Easing.out(Easing.cubic))}
          style={styles.actions}
        >
          <Pressable
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
            onPress={handleStartItinerary}
          >
            <Text style={styles.startButtonText}>Start Itinerary</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
};

export default ItineraryDetailScreen;

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl * 3,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.status.error.text,
    },

    // ── Hero ──
    hero: {
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 28,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 2,
    },
    heroLabelPill: {
      backgroundColor: "rgba(134, 239, 172, 0.1)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    heroLabelText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: "#86efac",
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    heroDot: {
      fontSize: 11,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    heroDate: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    heroSummary: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
    },

    // ── Stat chips ──
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statChip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statChipValue: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },

    // ── Vibe tags ──
    vibeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    vibePill: {
      backgroundColor: "rgba(249, 168, 212, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(249, 168, 212, 0.2)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    vibeText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: "#f9a8d4",
      textTransform: "lowercase",
      letterSpacing: 0.5,
    },

    // ── Divider ──
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.lg,
    },

    // ── Actions ──
    actions: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    startButton: {
      backgroundColor: "rgba(134, 239, 172, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    startButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.2)",
    },
    startButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#86efac",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    deleteButton: {
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    deleteButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.disabled,
      fontWeight: fontWeight.semibold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
  });
