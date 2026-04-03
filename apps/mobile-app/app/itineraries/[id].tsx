import ItineraryTimeline from "@/components/Itinerary/ItineraryTimeline";
import QuestCompass, { MiniCompassPreview } from "@/components/Itinerary/QuestCompass";
import { CheckinCaptureModal } from "@/components/Itinerary/CheckinCaptureModal";

import PullToActionScrollView from "@/components/Layout/PullToActionScrollView";
import Screen from "@/components/Layout/Screen";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";
import { getCategoryColor } from "@/utils/categoryColors";
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
import { useDeckBadgeStore } from "@/stores/useDeckBadgeStore";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
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
      {prefix}
      {displayed}
      {suffix}
    </Text>
  );
};



type SidequestCheckinEvent = BaseEvent & {
  sidequestId: string;
  objectiveId: string;
  completed: boolean;
};

// --- Hero stat pill ---

const STAT_COLORS = ["#93c5fd", "#86efac", "#fcd34d", "#c4b5fd", "#f9a8d4"];

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
  const markNewDeckCard = useDeckBadgeStore((s) => s.markNewCard);
  const isActivating = useActiveItineraryStore((s) => s.isLoading);

  const isThisActive = activeItinerary?.id === id;

  // Compass overlay
  const [showCompass, setShowCompass] = useState(false);

  // Check-in capture modal
  const [captureObjective, setCaptureObjective] = useState<{
    id: string;
    title: string;
    emoji?: string;
    suggestedActivities: string[];
    journalPrompt?: string;
  } | null>(null);
  const { userLocation, startLocationTracking, stopLocationTracking } = useUserLocation();

  // Start continuous location tracking while this sidequest is active
  useEffect(() => {
    if (isThisActive) {
      startLocationTracking();
    }
    return () => {
      stopLocationTracking();
    };
  }, [isThisActive, startLocationTracking, stopLocationTracking]);

  // Use active store's data if this sidequest is active (has live checkin data)
  const displaySidequest =
    isThisActive && activeItinerary
      ? activeItinerary
      : itinerary;

  // Derive accent color from sidequest category to match card colors
  const accentHex = useMemo(() => getSidequestAccent(itinerary), [itinerary]);
  const styles = useMemo(() => createStyles(colors, accentHex), [colors, accentHex]);

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

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
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

  const handleActivate = useCallback(async () => {
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          journalPrompt: objective.journalPrompt,
        });
      }

      // Fire API call in background — no need to block UI
      try {
        await apiClient.sidequests.checkin(id, itemId);
      } catch (err) {
        console.error("[ItineraryDetail] Manual checkin failed:", err);
        // TODO: could roll back markCheckedIn here, but for now
        // the server will reconcile on next refresh
      }
    },
    [id, markCheckedIn, displaySidequest],
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
  const [selectedItem, setSelectedItem] =
    useState<ObjectiveResponse | null>(null);

  const handleItemPress = useCallback((item: ObjectiveResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
  }, []);

  // Next unchecked objective for mini compass
  const displayedNextObjective = useMemo(
    () =>
      [...(displaySidequest?.objectives ?? [])]
        .filter((o) => !o.checkedInAt && o.latitude != null && o.longitude != null)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null,
    [displaySidequest?.objectives],
  );

  const miniDistance = useMemo(() => {
    if (!userLocation || !displayedNextObjective?.latitude || !displayedNextObjective?.longitude)
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
      <PullToActionScrollView
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.scrollPadding}
      >
        {/* ── Hero Section ── */}
        <Animated.View
          entering={FadeIn.duration(500).easing(Easing.out(Easing.cubic))}
          style={styles.hero}
        >
          {/* Title block */}
          <Animated.View
            entering={FadeInDown.delay(100)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
          >
            <Text style={styles.heroTitle}>
              {(itinerary)?.title ?? "Sidequest"}
            </Text>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>SIDEQUEST</Text>
              </View>
              <Text style={styles.heroDot}> · </Text>
              <Text style={styles.heroDate}>{itinerary.city}</Text>
            </View>
          </Animated.View>

          {/* Summary */}
          {(itinerary)?.summary && (
            <Animated.View
              entering={FadeInDown.delay(200)
                .duration(450)
                .easing(Easing.out(Easing.cubic))}
            >
              <Text style={styles.heroSummary}>
                {(itinerary)?.summary}
              </Text>
            </Animated.View>
          )}

          {/* Stat chips — compact horizontal row */}
          <Animated.View
            entering={FadeInDown.delay(300)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.chipRow}
          >
            <View
              style={[
                styles.statChip,
                { borderColor: styles.vibePill.borderColor },
              ]}
            >
              <AnimatedNumber
                value={objectives.length}
                suffix=" stops"
                delay={400}
                color={accentHex}
                style={styles.statChipValue}
              />
            </View>
            {totalCost > 0 && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: styles.vibePill.borderColor },
                ]}
              >
                <AnimatedNumber
                  value={totalCost}
                  prefix="~$"
                  delay={500}
                  color={accentHex}
                  style={styles.statChipValue}
                />
              </View>
            )}
          </Animated.View>

          {/* Vibe tags */}
          <Animated.View
            entering={FadeInDown.delay(400)
              .duration(400)
              .easing(Easing.out(Easing.cubic))}
            style={styles.vibeRow}
          >
            {(itinerary.activityTypes ?? []).map((vibe, i) => (
              <Animated.View
                key={vibe}
                entering={FadeInRight.delay(450 + i * 60).duration(350)}
                style={styles.vibePill}
              >
                <Text style={styles.vibeText}>{vibe}</Text>
              </Animated.View>
            ))}
          </Animated.View>
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

        {/* DEV: Force capture modal */}
        {__DEV__ && objectives.length > 0 && (
          <Pressable
            onPress={() => {
              const obj = objectives[0];
              setCaptureObjective({
                id: obj.id,
                title: obj.title,
                emoji: obj.emoji,
                suggestedActivities: obj.suggestedActivities ?? [],
                journalPrompt: obj.journalPrompt,
              });
            }}
            style={{
              backgroundColor: "rgba(134, 239, 172, 0.1)",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "rgba(134, 239, 172, 0.25)",
              padding: 10,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "#86efac",
                fontFamily: "SpaceMono",
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              DEV: Test Check-in Capture
            </Text>
          </Pressable>
        )}

        {/* DEV: Complete sidequest (check in all objectives) */}
        {__DEV__ && id && objectives.length > 0 && (
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const unchecked = objectives.filter((o) => !o.checkedInAt);
              for (const obj of unchecked) {
                markCheckedIn(obj.id, new Date().toISOString());
                apiClient.sidequests.checkin(id, obj.id).catch((err) => {
                  console.error("[DEV] checkin failed:", err);
                });
              }
              // Open capture modal for the first objective — existing
              // onDismiss/onComplete handlers navigate to deck when all
              // objectives are checked in.
              const first = objectives[0];
              if (first) {
                setCaptureObjective({
                  id: first.id,
                  title: first.title,
                  emoji: first.emoji,
                  suggestedActivities: first.suggestedActivities ?? [],
                  journalPrompt: first.journalPrompt,
                });
              }
            }}
            style={{
              backgroundColor: "rgba(168, 85, 247, 0.1)",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "rgba(168, 85, 247, 0.3)",
              padding: 10,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "rgba(168, 85, 247, 0.95)",
                fontFamily: "SpaceMono",
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              DEV: Complete Quest → Deck
            </Text>
          </Pressable>
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
              venueName={displayedNextObjective.venueName ?? displayedNextObjective.title}
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
          {isThisActive ? (
            <>
              <View style={styles.buttonRow}>
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

      {/* Check-in capture modal */}
      <CheckinCaptureModal
        visible={!!captureObjective}
        objectiveId={captureObjective?.id ?? ""}
        objectiveTitle={captureObjective?.title ?? ""}
        objectiveEmoji={captureObjective?.emoji}
        suggestedActivities={captureObjective?.suggestedActivities ?? []}
        journalPrompt={captureObjective?.journalPrompt}
        onDismiss={() => {
          const capturedId = captureObjective?.id;
          setCaptureObjective(null);
          // Even on skip, navigate to deck if quest is complete
          const remaining = objectives.filter(
            (o) => !o.checkedInAt && o.id !== capturedId,
          );
          if (remaining.length === 0) {
            markNewDeckCard();
            setTimeout(() => router.push("/deck"), 300);
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
            // Quest complete — go to deck to see/promote the card
            markNewDeckCard();
            setTimeout(() => router.push("/deck"), 300);
          }
        }}
      />

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

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: spacing.lg }}
                >
                  {/* Header */}
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
                  </View>

                  {/* Description */}
                  {selectedItem.description && (
                    <Text style={styles.itemDetailDesc}>
                      {selectedItem.description}
                    </Text>
                  )}

                  {/* Hook (why this stop) */}
                  {selectedItem.hook && (
                    <View style={styles.itemDetailProTip}>
                      <Text style={styles.itemDetailProTipLabel}>
                        WHY THIS STOP
                      </Text>
                      <Text style={styles.itemDetailProTipText}>
                        {selectedItem.hook}
                      </Text>
                    </View>
                  )}

                  {/* Venue info */}
                  {(selectedItem.venueName || selectedItem.venueAddress) && (
                    <View style={styles.itemDetailSection}>
                      <Text style={styles.itemDetailSectionLabel}>VENUE</Text>
                      {selectedItem.venueName && (
                        <Text style={styles.itemDetailVenueName}>
                          {selectedItem.venueName}
                        </Text>
                      )}
                      {selectedItem.venueAddress && (
                        <Text style={styles.itemDetailSectionText}>
                          {selectedItem.venueAddress}
                        </Text>
                      )}
                      {selectedItem.venueCategory && (
                        <Text style={styles.itemDetailMeta}>
                          {selectedItem.venueCategory}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Cost chip */}
                  {Number(selectedItem.estimatedCost) > 0 && (
                    <View style={styles.itemDetailChipRow}>
                      <View style={styles.itemDetailChipGreen}>
                        <Text style={styles.itemDetailChipGreenText}>
                          ~${Number(selectedItem.estimatedCost)}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
};

export default ItineraryDetailScreen;

const createStyles = (colors: Colors, accentHex = "#86efac") => {
  const [ar, ag, ab] = hexToRgb(accentHex);
  return StyleSheet.create({
    scrollPadding: {
      paddingHorizontal: spacing.lg,
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
      gap: spacing.md,
      paddingTop: spacing.xs,
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
      fontSize: 13,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },

    // ── Vibe tags ──
    vibeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    vibePill: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.08)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    vibeText: {
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: accentHex,
      textTransform: "lowercase",
      letterSpacing: 0.5,
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
      color: colors.text.label,
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
      color: colors.text.label,
      letterSpacing: 1,
    },
    progressCount: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: accentHex,
    },
    progressBarBg: {
      height: 4,
      backgroundColor: colors.bg.elevated,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 4,
      backgroundColor: accentHex,
      borderRadius: 2,
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
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.3)`,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    startButtonPressed: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
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
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.3)`,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    navigateButtonPressed: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
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
      borderWidth: 1,
      borderColor: "rgba(252, 165, 165, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    endButtonPressed: {
      backgroundColor: "rgba(252, 165, 165, 0.08)",
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
      borderWidth: 1,
      borderColor: "rgba(252, 165, 165, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    deleteButtonPressed: {
      backgroundColor: "rgba(252, 165, 165, 0.08)",
    },
    deleteButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#fca5a5",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },

    // ── Modal shared styles ──
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
    itemDetailDesc: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: spacing.md,
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
    itemDetailProTip: {
      marginBottom: spacing.md,
      gap: 4,
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.06)`,
      borderWidth: 1,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.15)`,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    itemDetailProTipLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: accentHex,
      letterSpacing: 1.5,
    },
    itemDetailProTipText: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 20,
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
