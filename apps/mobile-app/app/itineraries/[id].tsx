import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
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
import ItineraryMapPreview from "@/components/Itinerary/ItineraryMapPreview";

import { apiClient } from "@/services/ApiClient";
import type {
  ItineraryResponse,
  ItineraryItemResponse,
} from "@/services/api/modules/itineraries";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { eventBroker, EventTypes } from "@/services/EventBroker";
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
      {prefix}
      {displayed}
      {suffix}
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

  // Active itinerary store
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const activateItinerary = useActiveItineraryStore((s) => s.activate);
  const deactivateItinerary = useActiveItineraryStore((s) => s.deactivate);
  const markCheckedIn = useActiveItineraryStore((s) => s.markCheckedIn);
  const isActivating = useActiveItineraryStore((s) => s.isLoading);

  const isThisActive = activeItinerary?.id === id;

  // Use active store's items if this itinerary is active (has live checkin data)
  const displayItinerary =
    isThisActive && activeItinerary ? activeItinerary : itinerary;

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

  // Listen for check-in events from push notifications
  useEffect(() => {
    const handler = (data: {
      itineraryId: string;
      itemId: string;
      completed: boolean;
    }) => {
      if (data.itineraryId === id) {
        markCheckedIn(data.itemId, new Date().toISOString());
        Haptics.notificationAsync(
          data.completed
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
    };

    const unsub = eventBroker.on(EventTypes.ITINERARY_CHECKIN, handler);
    return unsub;
  }, [id, markCheckedIn]);

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

  const handleShare = useCallback(async () => {
    if (!id || !itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { shareToken } = await apiClient.itineraries.share(id);
      const webUrl =
        process.env.EXPO_PUBLIC_WEB_URL || "https://dashboard.mapmoji.app";
      const shareUrl = `${webUrl}/i/${shareToken}`;

      await Share.share({
        message: shareUrl,
        url: shareUrl,
      });
    } catch (err) {
      console.error("[ItineraryDetail] Failed to share:", err);
    }
  }, [id, itinerary]);

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
      try {
        const result = await apiClient.itineraries.checkin(id, itemId);
        if (result.success && result.checkedInAt) {
          markCheckedIn(itemId, result.checkedInAt);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.error("[ItineraryDetail] Manual checkin failed:", err);
      }
    },
    [id, markCheckedIn],
  );

  const handleNavigate = useCallback(() => {
    if (!itinerary) return;

    const sortedItems = (itinerary.items ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.venueAddress || item.venueName || item.title);

    if (sortedItems.length === 0) return;

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
      Linking.openURL(
        `https://maps.apple.com/?daddr=${encodeURIComponent(label)}&dirflg=w`,
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
              (item) => `${item.emoji || "\u{1F4CD}"} ${item.title}`,
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

  // Item detail modal
  const [selectedItem, setSelectedItem] = useState<ItineraryItemResponse | null>(
    null,
  );

  const handleItemPress = useCallback((item: ItineraryItemResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
  }, []);

  // Save as ritual
  const [showSaveRitual, setShowSaveRitual] = useState(false);
  const [ritualName, setRitualName] = useState("");

  const ACTIVITY_EMOJI: Record<string, string> = {
    food: "\u{1F37D}\uFE0F",
    coffee: "\u2615",
    music: "\u{1F3B5}",
    art: "\u{1F3A8}",
    outdoors: "\u{1F333}",
    boarding: "\u{1F6F9}",
    hiking: "\u{1F97E}",
    walking: "\u{1F6B6}",
    nightlife: "\u{1F378}",
    sports: "\u26BD",
    culture: "\u{1F3DB}\uFE0F",
  };

  const handleSaveRitual = useCallback(async () => {
    if (!ritualName.trim() || !itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const emoji =
      ACTIVITY_EMOJI[itinerary.activityTypes?.[0]] || "\u{1F501}";

    try {
      await apiClient.rituals.create({
        name: ritualName.trim(),
        emoji,
        budgetMin: 0,
        budgetMax: itinerary.budgetMax,
        durationHours: itinerary.durationHours,
        activityTypes: itinerary.activityTypes,
        stopCount: itinerary.items.length,
      });
      setShowSaveRitual(false);
      setRitualName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("[ItineraryDetail] Failed to save ritual:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [ritualName, itinerary]);

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

  const items = displayItinerary?.items ?? [];
  const totalCost = items.reduce(
    (sum, i) => sum + (Number(i.estimatedCost) || 0),
    0,
  );
  const sortedForStats = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const firstTime =
    sortedForStats.length > 0 ? formatTime(sortedForStats[0].startTime) : null;
  const lastTime =
    sortedForStats.length > 0
      ? formatTime(sortedForStats[sortedForStats.length - 1].endTime)
      : null;

  // Check-in progress
  const checkedInCount = items.filter((i) => i.checkedInAt).length;
  const totalStops = items.length;
  const progressPct = totalStops > 0 ? checkedInCount / totalStops : 0;

  return (
    <Screen
      isScrollable={false}
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
            entering={FadeInDown.delay(100)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
          >
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <View style={styles.heroLabelRow}>
              <View style={styles.heroLabelPill}>
                <Text style={styles.heroLabelText}>ITINERARY</Text>
              </View>
              <Text style={styles.heroDot}> · </Text>
              <Text style={styles.heroDate}>
                {formatDate(itinerary.plannedDate)}
              </Text>
            </View>
          </Animated.View>

          {/* Summary */}
          {itinerary.summary && (
            <Animated.View
              entering={FadeInDown.delay(200)
                .duration(450)
                .easing(Easing.out(Easing.cubic))}
            >
              <Text style={styles.heroSummary}>{itinerary.summary}</Text>
            </Animated.View>
          )}

          {/* Stat chips — compact horizontal row */}
          <Animated.View
            entering={FadeInDown.delay(300)
              .duration(450)
              .easing(Easing.out(Easing.cubic))}
            style={styles.chipRow}
          >
            {firstTime && lastTime && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(147, 197, 253, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: STAT_COLORS[0] }]}>
                  {firstTime} – {lastTime}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.statChip,
                { borderColor: "rgba(134, 239, 172, 0.25)" },
              ]}
            >
              <AnimatedNumber
                value={items.length}
                suffix=" stops"
                delay={400}
                color={STAT_COLORS[1]}
                style={styles.statChipValue}
              />
            </View>
            {totalCost > 0 && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(196, 181, 253, 0.25)" },
                ]}
              >
                <AnimatedNumber
                  value={totalCost}
                  prefix="~$"
                  delay={500}
                  color={STAT_COLORS[3]}
                  style={styles.statChipValue}
                />
              </View>
            )}
            {displayItinerary?.forecast && (
              <View
                style={[
                  styles.statChip,
                  { borderColor: "rgba(253, 186, 116, 0.25)" },
                ]}
              >
                <Text style={[styles.statChipValue, { color: STAT_COLORS[4] }]}>
                  {displayItinerary.forecast.tempLowF}–
                  {displayItinerary.forecast.tempHighF}°F{" "}
                  {displayItinerary.forecast.dominantCondition}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Vibe tags + save as ritual */}
          <Animated.View
            entering={FadeInDown.delay(400)
              .duration(400)
              .easing(Easing.out(Easing.cubic))}
            style={styles.vibeAndRitualRow}
          >
            <View style={styles.vibeRow}>
              {(itinerary.activityTypes ?? []).map((vibe, i) => (
                <Animated.View
                  key={vibe}
                  entering={FadeInRight.delay(450 + i * 60).duration(350)}
                  style={styles.vibePill}
                >
                  <Text style={styles.vibeText}>{vibe}</Text>
                </Animated.View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.saveRitualToggle,
                pressed && styles.saveRitualTogglePressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSaveRitual(true);
              }}
            >
              <Text style={styles.saveRitualToggleText}>Save as ritual</Text>
            </Pressable>
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

        {/* ── Timeline ── */}
        <ItineraryTimeline
          items={items}
          forecast={displayItinerary?.forecast}
          isActive={isThisActive}
          onCheckin={isThisActive ? handleManualCheckin : undefined}
          onItemPress={handleItemPress}
        />

        {/* ── Map Preview ── */}
        <Animated.View
          entering={FadeInDown.delay(700)
            .duration(450)
            .easing(Easing.out(Easing.cubic))}
          style={styles.mapPreviewSection}
        >
          <Text style={styles.mapPreviewLabel}>ROUTE MAP</Text>
          <ItineraryMapPreview items={items} city={itinerary.city} />
        </Animated.View>

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
                    styles.rowButton,
                    pressed && styles.navigateButtonPressed,
                  ]}
                  onPress={handleNavigate}
                >
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.endButton,
                    styles.rowButton,
                    pressed && styles.endButtonPressed,
                  ]}
                  onPress={handleDeactivate}
                >
                  <Text style={styles.endButtonText}>End</Text>
                </Pressable>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.shareButtonPressed,
                ]}
                onPress={handleShare}
              >
                <Text style={styles.shareButtonText}>Share</Text>
              </Pressable>
            </>
          ) : (
            <>
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
                    styles.shareButton,
                    styles.rowButton,
                    pressed && styles.shareButtonPressed,
                  ]}
                  onPress={handleShare}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </Pressable>
              </View>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </>
          )}

        </Animated.View>
      </ScrollView>

      {/* Save as ritual modal */}
      <Modal
        visible={showSaveRitual}
        transparent
        animationType="none"
        onRequestClose={() => {
          setShowSaveRitual(false);
          setRitualName("");
        }}
      >
        <Pressable
          style={styles.ritualModalBackdrop}
          onPress={() => {
            setShowSaveRitual(false);
            setRitualName("");
          }}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.ritualModalBackdropFill}
          />
          <Animated.View
            entering={FadeInDown.duration(250).easing(Easing.out(Easing.cubic))}
            style={styles.ritualModalCard}
          >
            <Pressable>
              <View style={styles.ritualModalAccent} />
              <Text style={styles.ritualModalTitle}>Save as Ritual</Text>
              <Text style={styles.ritualModalDescription}>
                Save this itinerary's settings as a reusable ritual template.
              </Text>
              <TextInput
                style={styles.ritualModalInput}
                placeholder="Ritual name..."
                placeholderTextColor={colors.text.disabled}
                value={ritualName}
                onChangeText={setRitualName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveRitual}
                maxLength={50}
              />
              <View style={styles.ritualModalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.ritualModalCancel,
                    pressed && styles.ritualModalCancelPressed,
                  ]}
                  onPress={() => {
                    setShowSaveRitual(false);
                    setRitualName("");
                  }}
                >
                  <Text style={styles.ritualModalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.ritualModalSave,
                    pressed && styles.ritualModalSavePressed,
                    !ritualName.trim() && styles.ritualModalSaveDisabled,
                  ]}
                  onPress={handleSaveRitual}
                  disabled={!ritualName.trim()}
                >
                  <Text style={styles.ritualModalSaveText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Item detail modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.ritualModalBackdrop}
          onPress={() => setSelectedItem(null)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.ritualModalBackdropFill}
          />
          {selectedItem && (
            <Animated.View
              entering={FadeInDown.duration(250).easing(
                Easing.out(Easing.cubic),
              )}
              style={styles.itemDetailCard}
            >
              <Pressable>
                {/* Green accent bar */}
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
                      <Text style={styles.itemDetailTime}>
                        {formatTime(selectedItem.startTime)} –{" "}
                        {formatTime(selectedItem.endTime)}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {selectedItem.description && (
                    <Text style={styles.itemDetailDesc}>
                      {selectedItem.description}
                    </Text>
                  )}

                  {/* Why this stop */}
                  {selectedItem.whyThisStop && (
                    <View style={styles.itemDetailSection}>
                      <Text style={styles.itemDetailSectionLabel}>
                        WHY THIS STOP
                      </Text>
                      <Text style={styles.itemDetailSectionText}>
                        {selectedItem.whyThisStop}
                      </Text>
                    </View>
                  )}

                  {/* Pro tip */}
                  {selectedItem.proTip && (
                    <View style={styles.itemDetailProTip}>
                      <Text style={styles.itemDetailProTipLabel}>PRO TIP</Text>
                      <Text style={styles.itemDetailProTipText}>
                        {selectedItem.proTip}
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
                      {selectedItem.googleRating != null && (
                        <Text style={styles.itemDetailMeta}>
                          {"\u2B50"} {selectedItem.googleRating} on Google
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Cost + travel chips */}
                  <View style={styles.itemDetailChipRow}>
                    {Number(selectedItem.estimatedCost) > 0 && (
                      <View style={styles.itemDetailChipGreen}>
                        <Text style={styles.itemDetailChipGreenText}>
                          ~${Number(selectedItem.estimatedCost)}
                        </Text>
                      </View>
                    )}
                    {selectedItem.travelNote && (
                      <View style={styles.itemDetailChip}>
                        <Text style={styles.itemDetailChipText}>
                          {selectedItem.travelNote}
                        </Text>
                      </View>
                    )}
                  </View>
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
      flex: 1,
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
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      letterSpacing: 1,
    },
    progressCount: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#22c55e",
    },
    progressBarBg: {
      height: 4,
      backgroundColor: colors.bg.elevated,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 4,
      backgroundColor: "#22c55e",
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
    startButtonDisabled: {
      opacity: 0.5,
    },
    startButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#86efac",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    navigateButton: {
      backgroundColor: "rgba(134, 239, 172, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    navigateButtonPressed: {
      backgroundColor: "rgba(134, 239, 172, 0.2)",
    },
    navigateButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#86efac",
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
    shareButton: {
      backgroundColor: "rgba(147, 197, 253, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(147, 197, 253, 0.3)",
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: radius.md,
    },
    shareButtonPressed: {
      backgroundColor: "rgba(147, 197, 253, 0.2)",
    },
    shareButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#93c5fd",
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
      color: "#fca5a5",
      fontWeight: fontWeight.semibold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },

    // ── Vibe + ritual row ──
    vibeAndRitualRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: spacing.sm,
    },

    // ── Save as ritual ──
    saveRitualToggle: {
      flexShrink: 0,
      paddingVertical: 2,
    },
    saveRitualTogglePressed: {
      opacity: 0.6,
    },
    saveRitualToggleText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "#86efac",
      fontWeight: fontWeight.semibold,
      textDecorationLine: "underline",
    },

    // ── Ritual modal ──
    ritualModalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    ritualModalBackdropFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.light,
    },
    ritualModalCard: {
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      padding: spacing["2xl"],
      width: "85%",
      maxWidth: 360,
      borderWidth: 1,
      borderColor: colors.border.default,
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    ritualModalAccent: {
      height: 3,
      borderRadius: 2,
      width: 32,
      marginBottom: spacing.md,
      backgroundColor: "#86efac",
    },
    ritualModalTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      marginBottom: spacing.xs,
    },
    ritualModalDescription: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    ritualModalInput: {
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing.md,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      marginBottom: spacing.lg,
    },
    ritualModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.sm,
    },
    ritualModalCancel: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.bg.elevated,
    },
    ritualModalCancelPressed: {
      opacity: 0.7,
    },
    ritualModalCancelText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    ritualModalSave: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: "rgba(134, 239, 172, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.3)",
    },
    ritualModalSavePressed: {
      backgroundColor: "rgba(134, 239, 172, 0.25)",
    },
    ritualModalSaveDisabled: {
      opacity: 0.4,
    },
    ritualModalSaveText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#86efac",
      textTransform: "uppercase",
      letterSpacing: 0.5,
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
      borderColor: "rgba(134, 239, 172, 0.2)",
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
      backgroundColor: "#86efac",
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
      backgroundColor: "rgba(134, 239, 172, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.2)",
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
      color: "#86efac",
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
      color: "#86efac",
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
      backgroundColor: "rgba(134, 239, 172, 0.06)",
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.15)",
      borderRadius: radius.md,
      padding: spacing.md,
    },
    itemDetailProTipLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#86efac",
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
      borderColor: "rgba(134, 239, 172, 0.3)",
      backgroundColor: "rgba(134, 239, 172, 0.08)",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    itemDetailChipGreenText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#86efac",
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
