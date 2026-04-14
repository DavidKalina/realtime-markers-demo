import ItineraryTimeline from "@/components/Itinerary/ItineraryTimeline";
import QuestCompass, {
  MiniCompassPreview,
} from "@/components/Itinerary/QuestCompass";
import { CheckinCaptureModal } from "@/components/Itinerary/CheckinCaptureModal";
import PredictionCaptureModal from "@/components/Quest/PredictionCaptureModal";

import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import Screen from "@/components/Layout/Screen";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";

import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
import { getCategoryColor, getQuestPurpose, PURPOSE_COLORS, PURPOSE_LABELS } from "@/utils/categoryColors";
import {
  type BaseEvent,
  eventBroker,
  EventTypes,
} from "@/services/EventBroker";
import type {
  ObjectiveResponse,
  SidequestResponse,
} from "@/services/api/modules/sidequests";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

type SidequestCheckinEvent = BaseEvent & {
  sidequestId: string;
  objectiveId: string;
  completed: boolean;
};

// ── Linkified text ─────────────────────────────────────────
// Detects URLs and phone numbers in text and makes them tappable.

const URL_REGEX = /https?:\/\/[^\s,)]+/g;
const BARE_URL_REGEX =
  /(?<![/@\w])(?:[a-z0-9-]+\.)+(?:com|org|net|gov|edu|io|co|app|dev|us|info)(?:\/[^\s,)]*)?/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

function LinkedText({ text, style }: { text: string; style: any }) {
  const colors = useColors();
  const parts: { text: string; type: "text" | "url" | "phone" }[] = [];
  let lastIndex = 0;

  // Merge URL, bare URL, and phone matches, sorted by position
  const matches: {
    index: number;
    length: number;
    value: string;
    type: "url" | "phone";
  }[] = [];
  const covered = new Set<number>();
  for (const m of text.matchAll(URL_REGEX)) {
    matches.push({
      index: m.index!,
      length: m[0].length,
      value: m[0],
      type: "url",
    });
    for (let j = m.index!; j < m.index! + m[0].length; j++) covered.add(j);
  }
  for (const m of text.matchAll(BARE_URL_REGEX)) {
    if (!covered.has(m.index!)) {
      matches.push({
        index: m.index!,
        length: m[0].length,
        value: m[0],
        type: "url",
      });
    }
  }
  for (const m of text.matchAll(PHONE_REGEX)) {
    matches.push({
      index: m.index!,
      length: m[0].length,
      value: m[0],
      type: "phone",
    });
  }
  matches.sort((a, b) => a.index - b.index);

  for (const match of matches) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), type: "text" });
    }
    parts.push({ text: match.value, type: match.type });
    lastIndex = match.index + match.length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: "text" });
  }

  if (matches.length === 0) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.type === "url") {
          const href = part.text.startsWith("http")
            ? part.text
            : `https://${part.text}`;
          return (
            <Text
              key={i}
              style={{
                color: colors.accent.primary,
                textDecorationLine: "underline",
              }}
              onPress={() => Linking.openURL(href)}
            >
              {part.text}
            </Text>
          );
        }
        if (part.type === "phone") {
          const digits = part.text.replace(/\D/g, "");
          return (
            <Text
              key={i}
              style={{
                color: colors.accent.primary,
                textDecorationLine: "underline",
              }}
              onPress={() => Linking.openURL(`tel:${digits}`)}
            >
              {part.text}
            </Text>
          );
        }
        return <Text key={i}>{part.text}</Text>;
      })}
    </Text>
  );
}

/** Parse hex color to r,g,b tuple. */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Get the accent hex for a sidequest based on its categories/activityTypes. */
function getSidequestAccent(sq: SidequestResponse | null): string {
  const key =
    sq?.categories?.[0] ??
    sq?.objectives?.find((o) => o.venueCategory)?.venueCategory ??
    sq?.activityTypes?.[0] ??
    sq?.rarity ??
    "common";
  return getCategoryColor(key);
}

// ── Ambient glow background ──────────────────────────────

const GLOW_SKSL = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float reveal;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;
  float cx = 0.5 + sin(time * 6.2832) * 0.01;
  float cy = 0.25;
  float dx = uv.x - cx;
  float dy = (uv.y - cy) * (resolution.y / resolution.x);
  float dist = sqrt(dx * dx + dy * dy);
  float glow1 = exp(-dist * dist * 1.8);
  float glow2 = exp(-dist * dist * 6.0);
  float pulse = 0.92 + 0.08 * sin(time * 6.2832);
  vec3 blue = vec3(0.3, 0.67, 0.97);
  vec3 cyan = vec3(0.4, 0.9, 0.85);
  vec3 col = blue * glow1 + cyan * glow2 * 0.3;
  col *= pulse;
  float alpha = (glow1 * 0.15 + glow2 * 0.08) * pulse * reveal;
  return half4(col * alpha, alpha);
}
`);

const AmbientGlow: React.FC = React.memo(() => {
  const { width, height } = useWindowDimensions();
  const time = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      200,
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
    time.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const uniforms = useDerivedValue(() => ({
    resolution: vec(width, height),
    time: time.value,
    reveal: reveal.value,
  }));

  if (!GLOW_SKSL) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill>
        <Shader source={GLOW_SKSL} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
});

AmbientGlow.displayName = "AmbientGlow";

const ItineraryDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();


  const [itinerary, setItinerary] = useState<SidequestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active itinerary store
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const activateItinerary = useActiveItineraryStore((s) => s.activate);
  const deactivateItinerary = useActiveItineraryStore((s) => s.deactivate);
  const markCheckedIn = useActiveItineraryStore((s) => s.markCheckedIn);
  const confirmCheckin = useActiveItineraryStore((s) => s.confirmCheckin);
  const markNewDeckCard = useUIStore((s) => s.markNewDeckCard);
  const isActivating = useActiveItineraryStore((s) => s.isLoading);

  const isThisActive = activeItinerary?.id === id;

  // Compass overlay
  const [showCompass, setShowCompass] = useState(false);

  // Quest reflection overlay — shown after final check-in

  // Check-in capture modal
  const [captureObjective, setCaptureObjective] = useState<{
    id: string;
    title: string;
    emoji?: string;
    suggestedActivities: string[];
    actionItems: string[];
    journalPrompt?: string;
  } | null>(null);
  const [showPrediction, setShowPrediction] = useState(false);
  const { userLocation, startLocationTracking, stopLocationTracking } =
    useUserLocation();

  // Start continuous location tracking while this sidequest is active
  useEffect(() => {
    if (isThisActive) {
      startLocationTracking();
    }
    return () => {
      stopLocationTracking();
    };
  }, [isThisActive, startLocationTracking, stopLocationTracking]);

  // Refresh active itinerary when app returns to foreground to detect missed check-ins
  const refreshItinerary = useActiveItineraryStore((s) => s.refresh);
  useEffect(() => {
    if (!isThisActive) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshItinerary();
      }
    });
    return () => subscription.remove();
  }, [isThisActive, refreshItinerary]);

  // Handle quest completion — navigate to completion screen
  const handleQuestComplete = useCallback(async () => {
    markNewDeckCard();
    // Navigate to a dedicated completion screen that handles the ceremony,
    // AI reflection polling, and routing to progressive onboarding or deck.
    router.replace(`/quest-complete?id=${id}`);
  }, [id, markNewDeckCard, router]);

  // Use active store's data if this sidequest is active (has live checkin data)
  const displaySidequest =
    isThisActive && activeItinerary ? activeItinerary : itinerary;

  // Derive accent color from sidequest category to match card colors
  const accentHex = useMemo(() => getSidequestAccent(itinerary), [itinerary]);
  const styles = useMemo(
    () => createStyles(colors, accentHex),
    [colors, accentHex],
  );

  useEffect(() => {
    if (!id || id === "undefined") return;
    apiClient.sidequests
      .getById(id)
      .then((data) => {
        setItinerary(data);
      })
      .catch((err) => {
        console.error("[SidequestDetail] Failed to fetch:", err);
        setError("Failed to load sidequest");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  // Listen for check-in events from push notifications
  useEffect(() => {
    const handler = (data: SidequestCheckinEvent) => {
      if (data.sidequestId === id) {
        // markCheckedIn is idempotent — safe to call even if
        // the geofence task already optimistically updated
        markCheckedIn(data.objectiveId, new Date().toISOString());
        if (data.completed) {
          markNewDeckCard();
        }
        Haptics.notificationAsync(
          data.completed
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );

        // Only open capture modal if not already showing one
        if (!captureObjective) {
          const objective = displaySidequest?.objectives?.find(
            (o) => o.id === data.objectiveId,
          );
          if (objective) {
            setCaptureObjective({
              id: objective.id,
              title: objective.title,
              emoji: objective.emoji,
              suggestedActivities: objective.suggestedActivities ?? [],
              actionItems: objective.actionItems ?? [],
              journalPrompt: objective.journalPrompt,
            });
          }
        }
      }
    };

    const unsub = eventBroker.on<SidequestCheckinEvent>(
      EventTypes.ITINERARY_CHECKIN,
      handler,
    );
    return unsub;
  }, [id, markCheckedIn]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    const data = await apiClient.sidequests.getById(id);
    setItinerary(data);
  }, [id]);

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
            await apiClient.sidequests.deleteById(id);
            router.back();
          } catch (err) {
            console.error("[ItineraryDetail] Failed to delete:", err);
          }
        },
      },
    ]);
  }, [id, router]);

  const handleActivate = useCallback(() => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Show prediction modal before activating
    setShowPrediction(true);
  }, [itinerary]);

  const handlePredictionComplete = useCallback(async () => {
    setShowPrediction(false);
    if (!itinerary) return;
    const success = await activateItinerary(itinerary);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [itinerary, activateItinerary]);

  const handleDeactivate = useCallback(() => {
    Alert.alert("End itinerary?", "You can restart it later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await deactivateItinerary();
        },
      },
    ]);
  }, [deactivateItinerary]);

  // ── DEV: force check-in all objectives ──
  const handleDevCheckinAll = useCallback(async () => {
    if (!__DEV__ || !id || !displaySidequest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = new Date().toISOString();
    const unchecked = (displaySidequest.objectives ?? []).filter(
      (o) => !o.checkedInAt,
    );
    for (const obj of unchecked) {
      markCheckedIn(obj.id, now);
      confirmCheckin(obj.id);
    }
    // Open capture modal for the first unchecked objective
    const first = unchecked[0];
    if (first) {
      setCaptureObjective({
        id: first.id,
        title: first.title,
        emoji: first.emoji,
        suggestedActivities: first.suggestedActivities ?? [],
        actionItems: first.actionItems ?? [],
        journalPrompt: first.journalPrompt,
      });
    }
  }, [id, displaySidequest, markCheckedIn, confirmCheckin]);

  const handleManualCheckin = useCallback(
    async (itemId: string) => {
      if (!id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Optimistically update UI immediately
      const now = new Date().toISOString();
      markCheckedIn(itemId, now);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Open capture modal right away
      const objective = displaySidequest?.objectives?.find(
        (o) => o.id === itemId,
      );
      if (objective) {
        setCaptureObjective({
          id: objective.id,
          title: objective.title,
          emoji: objective.emoji,
          suggestedActivities: objective.suggestedActivities ?? [],
          actionItems: objective.actionItems ?? [],
          journalPrompt: objective.journalPrompt,
        });
      }

      // Confirm with server — rolls back optimistic update on failure
      confirmCheckin(itemId);
    },
    [id, markCheckedIn, confirmCheckin, displaySidequest],
  );

  const handleNavigate = useCallback(() => {
    const source = itinerary;
    if (!source) return;

    const sortedItems = (source.objectives ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.venueAddress || item.venueName || item.title);

    if (sortedItems.length === 0) return;

    const stopLabel = (item: (typeof sortedItems)[0]) => {
      // Prefer entry point coords (trailhead/parking) for navigation
      if (item.entryLatitude && item.entryLongitude) {
        return `${item.entryLatitude},${item.entryLongitude}`;
      }
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
      Linking.openURL(
        `https://maps.apple.com/?daddr=${encodeURIComponent(label)}&dirflg=d`,
      );
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            `Full Route (${stopLabels.length} stops)`,
            ...sortedItems.map(
              (item) =>
                `${item.emoji || "\u{1F4CD}"} ${item.title}${item.entryPointName ? ` → ${item.entryPointName}` : ""}`,
            ),
          ],
          cancelButtonIndex: 0,
          title: "Navigate",
          message:
            "Full route opens in Google Maps. Individual stops open in Apple Maps.",
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

  // Objective detail modal
  const [selectedItem, setSelectedItem] = useState<ObjectiveResponse | null>(
    null,
  );

  const handleItemPress = useCallback((item: ObjectiveResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
  }, []);

  // Next unchecked objective (for mini compass on venue quests, for mark-complete on challenge quests)
  const nextUncheckedObjective = useMemo(
    () =>
      [...(displaySidequest?.objectives ?? [])]
        .filter((o) => !o.checkedInAt)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null,
    [displaySidequest?.objectives],
  );

  // For mini compass — only objectives with coordinates
  const displayedNextObjective = useMemo(
    () =>
      nextUncheckedObjective?.latitude != null && nextUncheckedObjective?.longitude != null
        ? nextUncheckedObjective
        : null,
    [nextUncheckedObjective],
  );

  const miniDistance = useMemo(() => {
    if (
      !userLocation ||
      !displayedNextObjective?.latitude ||
      !displayedNextObjective?.longitude
    )
      return "";
    const [lng, lat] = userLocation;
    const R = 6371000;
    const dLat = ((displayedNextObjective.latitude - lat) * Math.PI) / 180;
    const dLng = ((displayedNextObjective.longitude - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((displayedNextObjective.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
  }, [userLocation, displayedNextObjective]);

  // --- Loading / Error states ---

  if (isLoading) {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !itinerary) {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
        noAnimation
      >
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Not found"}</Text>
        </View>
      </Screen>
    );
  }

  // --- Computed values ---

  const isChallenge = displaySidequest?.questType === "challenge";
  const objectives = displaySidequest?.objectives ?? [];
  const totalCost = objectives.reduce(
    (sum, i) => sum + (Number(i.estimatedCost) || 0),
    0,
  );

  // Check-in progress
  const checkedInCount = objectives.filter((i) => i.checkedInAt).length;
  const totalStops = objectives.length;
  const progressPct = totalStops > 0 ? checkedInCount / totalStops : 0;

  return (
    <Screen isScrollable={false} showBackButton onBack={handleBack} noAnimation>
      <AmbientGlow />
      <PullToActionScrollView
        onRefresh={handleRefresh}
        contentContainerStyle={styles.scrollPadding}
      >
        {/* ── Hero Section (Redesigned) ── */}
        <Animated.View
          entering={FadeIn.duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          {/* Purpose badge + Title */}
          <Animated.View
            entering={FadeInDown.delay(100)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
          >
            {displaySidequest && (() => {
              const purpose = getQuestPurpose(displaySidequest);
              const pColor = PURPOSE_COLORS[purpose] ?? "#7dd3fc";
              const pLabel = PURPOSE_LABELS[purpose] ?? "";
              return pLabel ? (
                <View style={[styles.purposeBadge, { borderColor: `${pColor}44`, backgroundColor: `${pColor}18` }]}>
                  <Text style={[styles.purposeBadgeText, { color: pColor }]}>{pLabel}</Text>
                </View>
              ) : null;
            })()}
            <Text style={styles.heroTitle}>
              {itinerary?.title ?? "Quest"}
            </Text>
          </Animated.View>

          {/* Venue card — compact info block */}
          {objectives[0] && (
            <Animated.View
              entering={FadeInDown.delay(160)
                .duration(400)
                .easing(Easing.out(Easing.cubic))}
              style={styles.venueCard}
            >
              <Text style={styles.venueEmoji}>{objectives[0].emoji ?? "\uD83D\uDCCD"}</Text>
              <View style={styles.venueInfo}>
                <Text style={styles.venueName} numberOfLines={1}>
                  {objectives[0].venueName ?? itinerary.city}
                </Text>
                <Text style={styles.venueDetails} numberOfLines={1}>
                  {[
                    objectives[0].venueCategory,
                    itinerary.distanceFromHome != null
                      ? `${Number(itinerary.distanceFromHome).toFixed(1)} mi`
                      : null,
                    totalCost > 0 ? `~$${totalCost}` : "Free",
                  ].filter(Boolean).join(" \u00B7 ")}
                </Text>
              </View>
              <Text style={[styles.venueDifficulty, { color: accentHex }]}>
                {Math.min(Number(objectives[0]?.difficulty ?? 1), 10)}/10
              </Text>
            </Animated.View>
          )}

          {/* Strategy Note — promoted to top, right after venue */}
          {itinerary?.strategyNote && (
            <Animated.View
              entering={FadeInDown.delay(220)
                .duration(450)
                .easing(Easing.out(Easing.cubic))}
              style={styles.strategyNoteContainer}
            >
              <Text style={styles.strategyNoteLabel}>Why this quest</Text>
              <Text style={styles.strategyNoteText}>
                {itinerary.strategyNote}
              </Text>
            </Animated.View>
          )}

          {/* The Playbook — what to actually do */}
          <Animated.View
            entering={FadeInDown.delay(280)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.playbookSection}
          >
            <Text style={styles.playbookLabel}>YOUR PLAYBOOK</Text>

            {/* Description as the main instruction */}
            {objectives[0]?.description && (
              <LinkedText
                text={objectives[0].description}
                style={styles.playbookDescription}
              />
            )}

            {/* Suggested activities as clear steps */}
            {(objectives[0]?.suggestedActivities ?? []).length > 0 && (
              <View style={styles.playbookSteps}>
                {(objectives[0]?.suggestedActivities ?? []).map((step, i) => (
                  <View key={i} style={styles.playbookStep}>
                    <Text style={styles.playbookStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Journal prompt — priming reflection */}
          {objectives[0]?.journalPrompt && (
            <Animated.View
              entering={FadeInDown.delay(340)
                .duration(400)
                .easing(Easing.out(Easing.cubic))}
              style={styles.journalPromptSection}
            >
              <Text style={styles.journalPromptLabel}>REFLECT AFTER</Text>
              <Text style={styles.journalPromptText}>
                {"\u201C"}{objectives[0].journalPrompt}{"\u201D"}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Divider ── */}
        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.divider}
        />

        {/* ── Check-in progress bar ── */}
        {isThisActive && totalStops > 0 && (
          <Animated.View
            entering={FadeInDown.delay(500)
              .duration(400)
              .easing(Easing.out(Easing.cubic))}
            style={styles.progressSection}
          >
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>PROGRESS</Text>
              <Text style={styles.progressCount}>
                {checkedInCount}/{totalStops} stops
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(progressPct * 100)}%` },
                ]}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Timeline (only when objectives are available) ── */}
        {objectives.length > 0 && (
          <ItineraryTimeline
            items={objectives}
            isActive={isThisActive}
            onCheckin={isThisActive ? handleManualCheckin : undefined}
            onItemPress={handleItemPress}
            accentColor={accentHex}
            hideDescriptions={objectives.length === 1}
          />
        )}

        {/* ── Quick Links (URLs & phones from description + suggestedActivities) ── */}
        {(() => {
          const sources = [
            objectives[0]?.description ?? "",
            ...(objectives[0]?.suggestedActivities ?? []),
          ].join("\n");
          const links: { value: string; type: "url" | "phone" }[] = [];
          const seen = new Set<string>();
          for (const m of sources.matchAll(URL_REGEX)) {
            seen.add(
              m[0]
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "")
                .toLowerCase(),
            );
            links.push({ value: m[0], type: "url" });
          }
          for (const m of sources.matchAll(BARE_URL_REGEX)) {
            const key = m[0].replace(/\/$/, "").toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              links.push({ value: `https://${m[0]}`, type: "url" });
            }
          }
          for (const m of sources.matchAll(PHONE_REGEX)) {
            links.push({ value: m[0], type: "phone" });
          }
          const obj = objectives[0];
          const hasVenue = !!(obj?.venueName || obj?.venueAddress);
          if (links.length === 0 && !hasVenue) return null;
          return (
            <Animated.View
              entering={FadeInDown.delay(650)
                .duration(400)
                .easing(Easing.out(Easing.cubic))}
              style={styles.quickLinksSection}
            >
              <Text style={styles.quickLinksLabel}>QUICK LINKS</Text>
              {hasVenue && (
                <Pressable
                  onPress={() => {
                    const query = encodeURIComponent(
                      `${obj.venueName ?? ""} ${obj.venueAddress ?? ""}`.trim(),
                    );
                    Linking.openURL(
                      Platform.OS === "ios"
                        ? `maps:?q=${query}`
                        : `geo:0,0?q=${query}`,
                    );
                  }}
                  style={({ pressed }) => [
                    styles.quickLinkRow,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.quickLinkIcon}>{"\u{1F4CD}"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickLinkText} numberOfLines={1}>
                      {obj.venueName ?? obj.venueAddress}
                    </Text>
                    {obj.venueAddress && obj.venueName && (
                      <Text style={styles.quickLinkSubtext} numberOfLines={1}>
                        {obj.venueAddress}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
              {links.map((link, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    const url =
                      link.type === "phone"
                        ? `tel:${link.value.replace(/[^\d+]/g, "")}`
                        : link.value;
                    Linking.openURL(url);
                  }}
                  style={({ pressed }) => [
                    styles.quickLinkRow,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.quickLinkIcon}>
                    {link.type === "phone" ? "\u{1F4DE}" : "\u{1F517}"}
                  </Text>
                  <Text style={styles.quickLinkText} numberOfLines={1}>
                    {link.type === "url"
                      ? link.value
                          .replace(/^https?:\/\//, "")
                          .replace(/\/$/, "")
                      : link.value}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          );
        })()}

        {/* ── Mini Compass Preview ── */}
        {isThisActive && displayedNextObjective && userLocation && (
          <Animated.View
            entering={FadeInDown.delay(700)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.mapPreviewSection}
          >
            <Text style={styles.mapPreviewLabel}>COMPASS</Text>
            <MiniCompassPreview
              userLocation={userLocation}
              objectiveLat={displayedNextObjective.latitude!}
              objectiveLng={displayedNextObjective.longitude!}
              distanceLabel={miniDistance}
              venueName={
                displayedNextObjective.venueName ?? displayedNextObjective.title
              }
              emoji={displayedNextObjective.emoji ?? "\u{1F4CD}"}
              accentColor={accentHex}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCompass(true);
              }}
            />
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <Animated.View
          entering={FadeInDown.delay(600)
            .duration(400)
            .easing(Easing.out(Easing.cubic))}
          style={styles.actions}
        >
          {/* DEV: force check-in all objectives */}
          {__DEV__ && isThisActive && (
            <Pressable
              style={({ pressed }) => [
                styles.devButton,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleDevCheckinAll}
            >
              <Text style={styles.devButtonText}>
                DEV: Check in all + capture
              </Text>
            </Pressable>
          )}

          {isThisActive ? (
            <>
              <View style={styles.buttonRow}>
                {isChallenge ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.navigateButton,
                      { flex: 1 },
                      pressed && styles.navigateButtonPressed,
                      !nextUncheckedObjective && { opacity: 0.4 },
                    ]}
                    onPress={() => nextUncheckedObjective && handleManualCheckin(nextUncheckedObjective.id)}
                    disabled={!nextUncheckedObjective}
                  >
                    <Text style={styles.navigateButtonText}>
                      {nextUncheckedObjective ? "Mark Complete" : "All Done"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.navigateButton,
                      { flex: 1 },
                      pressed && styles.navigateButtonPressed,
                    ]}
                    onPress={handleNavigate}
                  >
                    <Text style={styles.navigateButtonText}>Navigate</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.endButton,
                    { flex: 1 },
                    pressed && styles.endButtonPressed,
                  ]}
                  onPress={handleDeactivate}
                >
                  <Text style={styles.endButtonText}>End</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.startButton,
                  styles.rowButton,
                  pressed && styles.startButtonPressed,
                  isActivating && styles.startButtonDisabled,
                ]}
                onPress={handleActivate}
                disabled={isActivating}
              >
                <Text style={styles.startButtonText}>
                  {isActivating ? "Activating..." : "Start"}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  styles.rowButton,
                  pressed && styles.deleteButtonPressed,
                ]}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </PullToActionScrollView>

      {/* Quest Compass overlay */}
      {isThisActive && (
        <QuestCompass
          visible={showCompass}
          onDismiss={() => setShowCompass(false)}
          objectives={objectives}
          userLocation={userLocation}
          accentColor={accentHex}
        />
      )}

      {/* Pre-quest prediction modal (expectancy capture) */}
      <PredictionCaptureModal
        visible={showPrediction}
        objectiveId={objectives[0]?.id ?? ""}
        objectiveTitle={displaySidequest?.title ?? objectives[0]?.title ?? ""}
        objectiveEmoji={objectives[0]?.emoji}
        onDismiss={() => setShowPrediction(false)}
        onComplete={handlePredictionComplete}
      />

      {/* Check-in capture modal */}
      <CheckinCaptureModal
        visible={!!captureObjective}
        objectiveId={captureObjective?.id ?? ""}
        sidequestId={id}
        objectiveTitle={captureObjective?.title ?? ""}
        objectiveEmoji={captureObjective?.emoji}
        suggestedActivities={captureObjective?.suggestedActivities ?? []}
        actionItems={captureObjective?.actionItems ?? []}
        journalPrompt={captureObjective?.journalPrompt}
        mode={isChallenge ? "challenge" : "venue"}
        onDismiss={() => {
          const capturedId = captureObjective?.id;
          setCaptureObjective(null);
          // Even on skip, show reflection if quest is complete
          const remaining = objectives.filter(
            (o) => !o.checkedInAt && o.id !== capturedId,
          );
          if (remaining.length === 0) {
            handleQuestComplete();
          }
        }}
        onComplete={() => {
          const capturedId = captureObjective?.id;
          setCaptureObjective(null);
          // Check if this was the last unchecked objective
          const remaining = objectives.filter(
            (o) => !o.checkedInAt && o.id !== capturedId,
          );
          if (remaining.length === 0) {
            handleQuestComplete();
          }
        }}
      />

      {/* Quest reflection moved to /quest-complete screen */}

      {/* Item detail modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedItem(null)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.modalBackdropFill}
          />
          {selectedItem && (
            <Animated.View
              entering={FadeInDown.duration(250).easing(
                Easing.out(Easing.cubic),
              )}
              style={styles.itemDetailCard}
            >
              <Pressable>
                {/* Accent bar */}
                <View style={styles.itemDetailAccent} />

                {/* Header + cost */}
                <View style={styles.itemDetailHeader}>
                  <View style={styles.itemDetailEmojiCircle}>
                    <Text style={styles.itemDetailEmoji}>
                      {selectedItem.emoji || "\u{1F4CD}"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemDetailTitle}>
                      {selectedItem.title}
                    </Text>
                  </View>
                  {Number(selectedItem.estimatedCost) > 0 && (
                    <View style={styles.itemDetailChipGreen}>
                      <Text style={styles.itemDetailChipGreenText}>
                        ~${Number(selectedItem.estimatedCost)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Venue — compact */}
                {selectedItem.venueName && (
                  <Pressable
                    onPress={() => {
                      const query = encodeURIComponent(
                        `${selectedItem.venueName ?? ""} ${selectedItem.venueAddress ?? ""}`.trim(),
                      );
                      Linking.openURL(
                        Platform.OS === "ios"
                          ? `maps:?q=${query}`
                          : `geo:0,0?q=${query}`,
                      );
                    }}
                    style={({ pressed }) => pressed && { opacity: 0.6 }}
                  >
                    <Text style={styles.itemDetailVenueCompact}>
                      {"\u{1F4CD}"} {selectedItem.venueName}
                      {selectedItem.venueCategory
                        ? ` · ${selectedItem.venueCategory}`
                        : ""}
                    </Text>
                    {selectedItem.venueAddress && (
                      <Text style={styles.itemDetailAddressCompact}>
                        {selectedItem.venueAddress}
                      </Text>
                    )}
                  </Pressable>
                )}
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
};

export default ItineraryDetailScreen;

const createStyles = (colors: Colors, accentHex = "#7dd3fc") => {
  const [ar, ag, ab] = hexToRgb(accentHex);
  return StyleSheet.create({
    scrollPadding: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl * 3,
    },
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
      gap: spacing.lg,
      paddingTop: spacing.sm,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 32,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 2,
    },
    heroLabelPill: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.1)`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    heroLabelText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: accentHex,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    heroDot: {
      fontSize: 13,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
    },
    heroDate: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    heroSummary: {
      fontSize: 15,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 23,
    },

    purposeBadge: {
      alignSelf: "flex-start" as const,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      marginBottom: 8,
    },
    purposeBadgeText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      letterSpacing: 1,
    },

    // ── Venue card ──
    venueCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: radius.md,
      padding: 12,
    },
    venueEmoji: {
      fontSize: 24,
    },
    venueInfo: {
      flex: 1,
      gap: 2,
    },
    venueName: {
      fontSize: 15,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    venueDetails: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    venueDifficulty: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
    },

    // ── Playbook ──
    playbookSection: {
      gap: 10,
    },
    playbookLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.disabled,
      letterSpacing: 1,
    },
    playbookDescription: {
      fontSize: 15,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 23,
    },
    playbookSteps: {
      gap: 6,
    },
    playbookStep: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: radius.sm,
    },
    playbookStepText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 20,
    },

    // ── Journal prompt ──
    journalPromptSection: {
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
    },
    journalPromptLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.disabled,
      letterSpacing: 1,
      marginBottom: 4,
    },
    journalPromptText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontStyle: "italic" as const,
      color: colors.text.secondary,
      lineHeight: 21,
    },

    strategyNoteContainer: {
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
    },
    strategyNoteLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.disabled,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      marginBottom: 4,
    },
    strategyNoteText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      fontStyle: "italic" as const,
      color: colors.text.secondary,
      lineHeight: 21,
    },

    // ── Stat bars ──
    statsBlock: {
      gap: spacing._10,
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      width: 76,
    },
    statBarTrack: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      overflow: "hidden",
    },
    statBarFill: {
      height: 3,
      borderRadius: 1.5,
    },
    statValue: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      width: 50,
      textAlign: "right",
    },

    // ── Vibe tags ──
    vibeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    vibePill: {
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    vibeText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      textTransform: "lowercase",
      letterSpacing: 0.3,
    },

    // ── Divider ──
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.lg,
    },

    // ── Progress ──
    progressSection: {
      marginTop: spacing.md,
      gap: 6,
    },
    mapPreviewSection: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    mapPreviewLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: accentHex,
      letterSpacing: 1,
    },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabel: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: accentHex,
      letterSpacing: 1,
    },
    progressCount: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: accentHex,
    },
    progressBarBg: {
      height: 3,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderRadius: 1.5,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 3,
      backgroundColor: accentHex,
      borderRadius: 1.5,
    },

    // ── Actions ──
    actions: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    buttonRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    rowButton: {
      flex: 1,
    },
    startButton: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.15)`,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    startButtonPressed: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.25)`,
    },
    startButtonDisabled: {
      opacity: 0.5,
    },
    startButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: accentHex,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    navigateButton: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.15)`,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    navigateButtonPressed: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.25)`,
    },
    navigateButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: accentHex,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    compassButton: {
      backgroundColor: "rgba(147, 197, 253, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(147, 197, 253, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    compassButtonPressed: {
      backgroundColor: "rgba(147, 197, 253, 0.2)",
    },
    compassButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#93c5fd",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    endButton: {
      backgroundColor: "rgba(252, 165, 165, 0.1)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    endButtonPressed: {
      backgroundColor: "rgba(252, 165, 165, 0.18)",
    },
    endButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#fca5a5",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    deleteButton: {
      backgroundColor: "rgba(252, 165, 165, 0.1)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    deleteButtonPressed: {
      backgroundColor: "rgba(252, 165, 165, 0.18)",
    },
    deleteButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#fca5a5",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },

    // ── Dev ──
    devButton: {
      borderWidth: 1,
      borderColor: "rgba(251, 191, 36, 0.3)",
      backgroundColor: "rgba(251, 191, 36, 0.08)",
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: "center" as const,
      marginBottom: spacing.sm,
    },
    devButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: "#fbbf24",
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },

    // ── Quick Links ──
    quickLinksSection: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    quickLinksLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: accentHex,
      letterSpacing: 1,
      marginBottom: 2,
    },
    quickLinkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.06)`,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    quickLinkIcon: {
      fontSize: 14,
    },
    quickLinkText: {
      flex: 1,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: accentHex,
      textDecorationLine: "underline" as const,
    },
    quickLinkSubtext: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.detail,
      marginTop: 1,
    },

    // ── Modal shared styles ──
    // ── Reflection overlay ──
    reflectionOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    reflectionCard: {
      maxWidth: 360,
      width: "100%" as const,
      gap: 16,
    },
    reflectionLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.disabled,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
    },
    reflectionText: {
      fontSize: 16,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      fontStyle: "italic" as const,
      color: colors.text.primary,
      lineHeight: 26,
    },
    reflectionShimmer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      paddingVertical: 8,
    },
    reflectionLoadingText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    reflectionButton: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      alignSelf: "flex-start" as const,
    },
    reflectionButtonText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.primary,
    },

    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    modalBackdropFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.light,
    },

    // ── Item detail modal ──
    itemDetailCard: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      width: "90%",
      maxWidth: 380,
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    itemDetailAccent: {
      height: 3,
      borderRadius: 2,
      width: 32,
      marginBottom: spacing.md,
      backgroundColor: accentHex,
    },
    itemDetailHeader: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
      marginBottom: spacing.md,
    },
    itemDetailEmojiCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.1)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      alignItems: "center",
      justifyContent: "center",
    },
    itemDetailEmoji: {
      fontSize: 22,
    },
    itemDetailTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 22,
    },
    itemDetailTime: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: accentHex,
      marginTop: 2,
    },
    itemDetailSection: {
      marginBottom: spacing.md,
      gap: 4,
    },
    itemDetailSectionLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    itemDetailSectionText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 20,
    },
    itemDetailVenueCompact: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    itemDetailAddressCompact: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: accentHex,
      textDecorationLine: "underline" as const,
      lineHeight: 18,
      marginTop: 2,
    },
    itemDetailVenueName: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    itemDetailMeta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.detail,
      marginTop: 2,
    },
    itemDetailChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: spacing.xs,
    },
    itemDetailChipGreen: {
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.3)`,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.08)`,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    itemDetailChipGreenText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: accentHex,
    },
    itemDetailChip: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    itemDetailChipText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
  });
};
