import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
import type { ItinerarySuggestion } from "@/services/api/modules/itineraries";
import { useJobProgress } from "@/hooks/useJobProgress";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { useGetAwaySuggestionsStore } from "@/stores/useGetAwaySuggestionsStore";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import {
  useColors,
  fontFamily,
  fontWeight,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";

/* ── Constants ───────────────────────────────────────────────── */

const SLOT_COUNT = 5;

const GEN_EMOJIS = [
  "\u{1F5FA}\u{FE0F}", "\u{1F3AF}", "\u{1F3AA}", "\u{1F3AD}", "\u{1F3A8}",
  "\u{1F3B5}", "\u{1F37D}\u{FE0F}", "\u{2615}", "\u{1F3DE}\u{FE0F}", "\u{1F6B6}",
  "\u{1F3D5}\u{FE0F}", "\u{1F30A}", "\u{1F3DB}\u{FE0F}", "\u{1F3A4}",
  "\u{1F9D7}", "\u{1F366}", "\u{1F6B2}", "\u{1F3B6}",
];

const SLOT_TITLES = [
  ["Scouting cheap eats\u2026", "Browsing free parks\u2026", "Finding hidden patios\u2026"],
  ["Checking upscale spots\u2026", "Exploring galleries\u2026", "Mapping rooftop bars\u2026"],
  ["Scanning trail maps\u2026", "Finding outdoor vibes\u2026", "Locating scenic routes\u2026"],
  ["Curating nightlife\u2026", "Discovering live music\u2026", "Searching late-night eats\u2026"],
  ["Browsing local culture\u2026", "Finding cozy corners\u2026", "Checking community boards\u2026"],
];

const SLOT_METAS = [
  ["something budget-friendly", "keeping it chill", "low-key adventure"],
  ["a treat-yourself kind of day", "somewhere worth the splurge", "elevated vibes"],
  ["fresh air and movement", "nature within reach", "getting your steps in"],
  ["good energy tonight", "something unexpected", "the after-hours move"],
  ["a little bit of everything", "the wildcard pick", "mixing it up"],
];

const REEL_ITEM_HEIGHT = 28;
const REEL_SPINS = 3;
const REVEAL_STAGGER_MS = 600;

/* ── EmojiReel ───────────────────────────────────────────────── */

interface EmojiReelProps {
  index: number;
  spinning: boolean;
  landEmoji?: string;
}

const EmojiReel: React.FC<EmojiReelProps> = React.memo(
  ({ index, spinning, landEmoji }) => {
    const reelStyles = useMemo(
      () => ({
        container: { width: 28, height: REEL_ITEM_HEIGHT, overflow: "hidden" as const },
        item: {
          height: REEL_ITEM_HEIGHT,
          lineHeight: REEL_ITEM_HEIGHT,
          fontSize: 20,
          textAlign: "center" as const,
        },
      }),
      [],
    );

    const translateY = useSharedValue(0);
    const spinTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // Build reel with the landing emoji appended at the end
    const reelEmojis = useMemo(() => {
      const items: string[] = [];
      for (let i = 0; i < REEL_SPINS; i++) {
        items.push(...GEN_EMOJIS);
      }
      // Append the final emoji to land on (or a random one)
      items.push(landEmoji || GEN_EMOJIS[0]);
      return items;
    }, [landEmoji]);

    const spin = useCallback(() => {
      const landIdx =
        (REEL_SPINS - 1) * GEN_EMOJIS.length +
        Math.floor(Math.random() * GEN_EMOJIS.length);
      translateY.value = 0;
      translateY.value = withTiming(-landIdx * REEL_ITEM_HEIGHT, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    }, []);

    // Spin while spinning=true, staggered per index
    useEffect(() => {
      if (!spinning) return;
      const initialDelay = index * 350;
      const interval = 2400 + index * 200; // 2400, 2600, 2800, 3000
      const startTimer = setTimeout(() => {
        spin();
        spinTimer.current = setInterval(spin, interval);
      }, initialDelay);
      return () => {
        clearTimeout(startTimer);
        if (spinTimer.current) clearInterval(spinTimer.current);
      };
    }, [spinning, spin, index]);

    // When spinning stops, do a final long deceleration to the land emoji
    useEffect(() => {
      if (spinning) return;
      if (spinTimer.current) {
        clearInterval(spinTimer.current);
        spinTimer.current = null;
      }
      // Land on the very last item (the appended landEmoji)
      const finalIdx = reelEmojis.length - 1;
      translateY.value = 0;
      translateY.value = withTiming(-finalIdx * REEL_ITEM_HEIGHT, {
        duration: 1800,
        easing: Easing.out(Easing.exp),
      });
    }, [spinning, reelEmojis.length]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    return (
      <View style={reelStyles.container}>
        <Animated.View style={animStyle}>
          {reelEmojis.map((emoji, i) => (
            <Text key={i} style={reelStyles.item}>
              {emoji}
            </Text>
          ))}
        </Animated.View>
      </View>
    );
  },
);

EmojiReel.displayName = "EmojiReel";

/* ── SlotRow ─────────────────────────────────────────────────── */

interface SlotRowProps {
  index: number;
  suggestion: ItinerarySuggestion | null;
  revealed: boolean;
  allReady: boolean;
  pickedItineraryId?: string;
  onPick: (s: ItinerarySuggestion, index: number) => void;
  onView: (itineraryId: string) => void;
  colors: Colors;
}

const SlotRow: React.FC<SlotRowProps> = React.memo(
  ({ index, suggestion, revealed, allReady, pickedItineraryId, onPick, onView, colors }) => {
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [landed, setLanded] = useState(false);
    const [titleIdx, setTitleIdx] = useState(0);
    const [metaIdx, setMetaIdx] = useState(0);
    const textOpacity = useSharedValue(1);
    const cardOpacity = useSharedValue(0);

    const titles = SLOT_TITLES[index] || SLOT_TITLES[0];
    const metas = SLOT_METAS[index] || SLOT_METAS[0];

    // Rotate placeholder text while spinning, staggered per row
    useEffect(() => {
      if (revealed) return;
      const initialDelay = index * 400;
      const interval = 2600 + index * 180; // 2600, 2780, 2960, 3140
      let intervalId: ReturnType<typeof setInterval> | null = null;
      const startTimer = setTimeout(() => {
        intervalId = setInterval(() => {
          textOpacity.value = withSequence(
            withTiming(0, { duration: 300 }),
            withTiming(1, { duration: 300 }),
          );
          setTimeout(() => {
            setTitleIdx((i) => (i + 1) % titles.length);
            setMetaIdx((i) => (i + 1) % metas.length);
          }, 300);
        }, interval);
      }, initialDelay);
      return () => {
        clearTimeout(startTimer);
        if (intervalId) clearInterval(intervalId);
      };
    }, [revealed, titles.length, metas.length, index]);

    const textAnimStyle = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
    }));

    // When revealed, wait for reel deceleration then crossfade to card
    useEffect(() => {
      if (!revealed || !suggestion) return;
      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Fade out placeholder text, fade in card
        textOpacity.value = withTiming(0, { duration: 200 });
        cardOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
        setLanded(true);
      }, 1800); // match the reel deceleration duration
      return () => clearTimeout(timer);
    }, [revealed, suggestion]);

    const cardAnimStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
    }));

    return (
      <Pressable
        style={styles.slotRow}
        disabled={!landed}
        onPress={() => {
          if (!landed || !suggestion) return;
          if (pickedItineraryId) {
            onView(pickedItineraryId);
          } else {
            onPick(suggestion, index);
          }
        }}
      >
        {/* Emoji reel */}
        <View style={styles.emojiWrap}>
          <EmojiReel
            index={index}
            spinning={!revealed}
            landEmoji={suggestion?.emoji}
          />
        </View>

        {/* Text area — fixed height, layers crossfade in place */}
        <View style={styles.slotContent}>
          {/* Spinning placeholder text */}
          <Animated.View
            style={[styles.slotTextLayer, textAnimStyle]}
            pointerEvents={landed ? "none" : "auto"}
          >
            <View style={styles.slotTitleRow}>
              <Text style={styles.slotTitle} numberOfLines={1}>
                {titles[titleIdx]}
              </Text>
              {!revealed && (
                <Text
                  style={[
                    styles.slotBadge,
                    { color: colors.status.success.text },
                  ]}
                >
                  searching
                </Text>
              )}
            </View>
            <Text style={styles.slotMeta} numberOfLines={1}>
              {metas[metaIdx]}
            </Text>
          </Animated.View>

          {/* Landed card content — absolutely positioned on top */}
          {suggestion && (
            <Animated.View
              style={[styles.slotTextLayer, styles.slotTextOverlay, cardAnimStyle]}
              pointerEvents={landed ? "auto" : "none"}
            >
              <View style={styles.slotTitleRow}>
                <Text style={styles.slotTitle} numberOfLines={1}>
                  {suggestion.title}
                </Text>
                {suggestion.city && (
                  <Text style={styles.slotCityLabel} numberOfLines={1}>
                    {suggestion.city}
                  </Text>
                )}
              </View>
              <View style={styles.slotBottomRow}>
                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{suggestion.costTier}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {suggestion.durationHours}h
                    </Text>
                  </View>
                  {suggestion.activityTypes.map((a) => (
                    <View key={a} style={styles.pill}>
                      <Text style={styles.pillText}>{a}</Text>
                    </View>
                  ))}
                </View>
                {allReady && (
                  <View style={styles.generateAction}>
                    <Text
                      style={[
                        styles.generateText,
                        pickedItineraryId && styles.viewText,
                      ]}
                    >
                      {pickedItineraryId ? "View" : "Generate"}
                    </Text>
                    <Text
                      style={[
                        styles.generateArrow,
                        pickedItineraryId && styles.viewText,
                      ]}
                    >
                      {"\u{203A}"}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Pressable>
    );
  },
);

SlotRow.displayName = "SlotRow";

/* ── Spin Button ─────────────────────────────────────────────── */

const SpinButton: React.FC<{
  disabled: boolean;
  onPress: () => void;
  colors: Colors;
}> = React.memo(({ disabled, onPress, colors }) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const shadowOpacity = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.93, { duration: 120 });
    translateY.value = withTiming(6, { duration: 120 });
    shadowOpacity.value = withTiming(0, { duration: 120 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSequence(
      withTiming(1.04, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 120 }),
    );
    translateY.value = withSequence(
      withTiming(-2, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 120 }),
    );
    shadowOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  }, [disabled, onPress]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const shadowAnimStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value,
  }));

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.spinButtonWrap}>
      {/* Shadow layer beneath the button */}
      <Animated.View style={[styles.spinButtonShadow, shadowAnimStyle]} />
      <Animated.View style={buttonAnimStyle}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.spinButton}
        >
          <Text style={styles.spinButtonEmoji}>{"\u{1F3B0}"}</Text>
          <Text
            style={styles.spinButtonText}
          >
            SPIN
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
});

SpinButton.displayName = "SpinButton";

/* ── Main screen ─────────────────────────────────────────────── */

type ScreenState = "idle" | "loading" | "revealing" | "ready" | "error";

export default function GetAwayScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userLocation } = useUserLocation();
  const { trackJob } = useJobProgress();
  const itineraryJobStore = useItineraryJobStore();

  // Persistent suggestion store
  const suggestions = useGetAwaySuggestionsStore((s) => s.suggestions);
  const city = useGetAwaySuggestionsStore((s) => s.city);
  const storeLoading = useGetAwaySuggestionsStore((s) => s.isLoading);
  const storeError = useGetAwaySuggestionsStore((s) => s.error);
  const fetchedAt = useGetAwaySuggestionsStore((s) => s.fetchedAt);
  const storeFetch = useGetAwaySuggestionsStore((s) => s.fetch);
  const pickedMap = useGetAwaySuggestionsStore((s) => s.pickedMap);
  const markPicked = useGetAwaySuggestionsStore((s) => s.markPicked);

  const [revealedCount, setRevealedCount] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [localError, setLocalError] = useState("");

  const [hasStarted, setHasStarted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);

  // Derive screen state from store
  const hasFreshSuggestions = suggestions.length > 0 && fetchedAt !== null;
  const state: ScreenState = storeError || localError
    ? "error"
    : storeLoading
      ? "loading"
      : revealedCount < suggestions.length && hasFreshSuggestions
        ? "revealing"
        : hasFreshSuggestions
          ? "ready"
          : hasStarted
            ? "loading"
            : "idle";

  /* ── Show cached suggestions immediately on mount ───────── */

  useEffect(() => {
    if (!storeLoading && hasFreshSuggestions && revealedCount === 0 && generation === 0) {
      setHasStarted(true);
      setVisibleCount(suggestions.length);
      setRevealedCount(suggestions.length);
    }
  }, []);

  // When store transitions from loading → has suggestions, kick off reveal
  const prevLoadingRef = useRef(storeLoading);
  useEffect(() => {
    if (prevLoadingRef.current && !storeLoading && suggestions.length > 0) {
      setRevealedCount(0);
      setGeneration((g) => g + 1);
    }
    prevLoadingRef.current = storeLoading;
  }, [storeLoading, suggestions.length]);

  const fetchSuggestions = useCallback(
    (force = false) => {
      if (!userLocation) {
        setLocalError("Enable location services to use Get Away");
        return;
      }
      setHasStarted(true);
      setLocalError("");
      setRevealedCount(0);
      setVisibleCount(0);
      const [lng, lat] = userLocation;
      storeFetch(lat, lng, force);
    },
    [userLocation, storeFetch],
  );

  /* ── Staggered row appearance ──────────────────────────── */

  const slotCount = suggestions.length > 0 ? suggestions.length : SLOT_COUNT;

  useEffect(() => {
    if (!hasStarted) return;
    if (visibleCount >= slotCount) return;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [hasStarted, visibleCount, slotCount]);

  /* ── Staggered reveal ───────────────────────────────────── */

  useEffect(() => {
    if (state !== "revealing") return;
    if (revealedCount >= suggestions.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
    }, REVEAL_STAGGER_MS);
    return () => clearTimeout(timer);
  }, [state, revealedCount, suggestions.length]);

  /* ── Pick a suggestion → create itinerary ───────────────── */

  const handlePick = useCallback(
    async (suggestion: ItinerarySuggestion, suggestionIndex: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const today = new Date().toISOString().split("T")[0];

      try {
        const result = await apiClient.itineraries.create({
          city: suggestion.city || city || undefined,
          plannedDate: today,
          budgetMin: 0,
          budgetMax: suggestion.budgetMax,
          durationHours: suggestion.durationHours,
          activityTypes: suggestion.activityTypes,
          intention: suggestion.intention,
          title: suggestion.title,
          surpriseMe: true,
          timezone: getUserTimezone(),
        });

        if (result.itineraryId) {
          markPicked(suggestionIndex, result.itineraryId);
        }

        trackJob(result.jobId);
        itineraryJobStore.startJob(result.jobId, result.itineraryId);
        router.dismiss();
        if (result.itineraryId) {
          router.push({
            pathname: "/itineraries/[id]" as const,
            params: { id: result.itineraryId },
          });
        } else {
          router.push("/itineraries" as const);
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLocalError(
          err instanceof Error ? err.message : "Failed to start generation",
        );
      }
    },
    [city, trackJob, itineraryJobStore, router, markPicked],
  );

  const handleView = useCallback(
    (itineraryId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.dismiss();
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: itineraryId },
      });
    },
    [router],
  );

  /* ── Render ─────────────────────────────────────────────── */

  const slots = Array.from({ length: visibleCount }, (_, i) => i);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Get Away</Text>
          <Text
            style={[
              styles.headerSub,
              { opacity: city && state !== "loading" && state !== "idle" ? 1 : 0 },
            ]}
          >
            {city ? `Near ${city}` : " "}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={12}
        >
          <X size={20} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Content area */}
      <View style={styles.contentArea}>
        {/* Idle */}
        {state === "idle" && (
          <View style={styles.idleContainer}>
            <Text style={styles.idleText}>
              Tap to discover adventures near you
            </Text>
          </View>
        )}

        {/* Slot rows */}
        {(state === "loading" || state === "revealing" || state === "ready") && (
          <View style={styles.slotsContainer}>
            {slots.map((i) => (
              <Animated.View
                key={`${generation}-${i}`}
                entering={FadeIn.duration(300)}
              >
                <SlotRow
                  index={i}
                  suggestion={suggestions[i] ?? null}
                  revealed={i < revealedCount}
                  allReady={state === "ready"}
                  pickedItineraryId={pickedMap[i]}
                  onPick={handlePick}
                  onView={handleView}
                  colors={colors}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Error */}
        {state === "error" && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>{"\u{1F61E}"}</Text>
            <Text style={styles.errorText}>
              {storeError || localError}
            </Text>
          </View>
        )}
      </View>

      {/* Spin button — always pinned at the bottom */}
      <View style={styles.spinButtonAnchor}>
        <SpinButton
          disabled={state === "loading" || state === "revealing"}
          onPress={() => fetchSuggestions(true)}
          colors={colors}
        />
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg.primary,
      paddingTop: spacing.xl,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    headerSub: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 2,
    },

    /* Content area */
    contentArea: {
      flex: 1,
    },

    /* Idle */
    idleContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    idleText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
    },

    /* Slot rows */
    slotsContainer: {
      paddingTop: spacing.sm,
    },

    slotRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing._10,
      paddingHorizontal: spacing.lg,
      gap: spacing._10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    emojiWrap: {
      position: "relative",
    },
    slotContent: {
      flex: 1,
      height: 62,
      justifyContent: "center",
    },
    slotTextLayer: {
      gap: 2,
    },
    slotTextOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
    },
    slotTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    slotTitle: {
      flex: 1,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    slotBadge: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
    },
    slotCityLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    slotBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.xs,
    },
    generateAction: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 2,
    },
    generateText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
    },
    generateArrow: {
      fontSize: fontSize.md,
      color: colors.accent.primary,
      lineHeight: 16,
    },
    viewText: {
      color: colors.text.secondary,
    },
    slotMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 16,
    },

    /* Pills (shown on landed cards) */
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: 4,
    },
    pill: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    pillText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },

    /* Spin button anchor */
    spinButtonAnchor: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Error */
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.md,
    },
    errorEmoji: {
      fontSize: 32,
    },
    errorText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
    },
    retryButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    retryText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.inverse,
    },

    /* Spin button */
    spinButtonWrap: {
      alignSelf: "center",
      marginTop: spacing.lg,
      width: 135,
      height: 143, // button + shadow depth
    },
    spinButtonShadow: {
      position: "absolute",
      bottom: 0,
      left: 3,
      right: 3,
      height: 135,
      borderRadius: 68,
      backgroundColor: "#7f1d1d",
    },
    spinButton: {
      width: 135,
      height: 135,
      borderRadius: 68,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#dc2626",
      borderWidth: 3,
      borderTopColor: "#f87171",
      borderLeftColor: "#ef4444",
      borderRightColor: "#ef4444",
      borderBottomColor: "#991b1b",
    },
    spinButtonEmoji: {
      fontSize: 43,
    },
    spinButtonText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#ffffff",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginTop: 2,
    },
  });
