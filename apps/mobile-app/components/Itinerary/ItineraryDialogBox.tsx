import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  useColors,
  fontFamily,
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import type { Category } from "@/services/api/base/types";
import { useJobProgress } from "@/hooks/useJobProgress";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import ItineraryTimeline from "./ItineraryTimeline";

const COLLAPSED_HEIGHT = 44;
const SHEEN_WIDTH = 100;
const EXPANDED_FORM_HEIGHT = 620;
const EXPANDED_RESULT_HEIGHT = 620;

// Matches ThirdSpaceScoreHero green palette
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

const ACTIVITY_OPTIONS = [
  { label: "Food", value: "food", emoji: "\u{1F37D}\uFE0F" },
  { label: "Music", value: "music", emoji: "\u{1F3B5}" },
  { label: "Art", value: "art", emoji: "\u{1F3A8}" },
  { label: "Outdoors", value: "outdoors", emoji: "\u{1F333}" },
  { label: "Nightlife", value: "nightlife", emoji: "\u{1F378}" },
  { label: "Sports", value: "sports", emoji: "\u26BD" },
  { label: "Culture", value: "culture", emoji: "\u{1F3DB}\uFE0F" },
];

const STOP_COUNT_OPTIONS = [
  { label: "Auto", value: 0 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "7", value: 7 },
  { label: "10", value: 10 },
];

const DURATION_OPTIONS = [
  { label: "2h", value: 2 },
  { label: "4h", value: 4 },
  { label: "Half day", value: 6 },
  { label: "Full day", value: 10 },
];

type Phase = "collapsed" | "form" | "generating" | "result";

interface ItineraryDialogBoxProps {
  city: string;
  style?: ViewStyle;
  onDismiss?: () => void;
}

export default function ItineraryDialogBox({
  city,
  style,
  onDismiss,
}: ItineraryDialogBoxProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>("collapsed");
  const [statusText, setStatusText] = useState("Plan your day");

  // Form state
  const [plannedDate, setPlannedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [budgetMax, setBudgetMax] = useState("50");
  const [durationHours, setDurationHours] = useState(4);
  const [stopCount, setStopCount] = useState(0); // 0 = auto
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ItineraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Job progress streaming
  const { activeJobs, trackJob } = useJobProgress();
  const itineraryJobStore = useItineraryJobStore();
  const trackedJob = activeJobId
    ? activeJobs.find((j) => j.jobId === activeJobId)
    : null;

  // Stable callbacks for scheduleOnRN — must not capture closures
  const setPhaseFormCb = useCallback(() => setPhase("form"), []);
  const setPhaseCollapsedCb = useCallback(() => setPhase("collapsed"), []);
  const setPhaseResultCb = useCallback(() => setPhase("result"), []);

  // Ref for onDismiss so worklet-scheduled callback stays stable
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const fireDismissCb = useCallback(() => {
    onDismissRef.current?.();
  }, []);

  // Refs for values needed inside worklet-scheduled callbacks
  const resultRef = useRef<ItineraryResponse | null>(null);
  resultRef.current = result;

  const setCollapsedStatusCb = useCallback(() => {
    setPhase("collapsed");
    setStatusText(resultRef.current ? "View itinerary" : "Plan your day");
  }, []);

  const setReExpandPhaseCb = useCallback(() => {
    setPhase(resultRef.current ? "result" : "form");
  }, []);

  // Animation shared values
  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const sheenPos = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const statusOpacity = useSharedValue(1);
  const sheenActive = useSharedValue(1);
  const [containerMeasured, setContainerMeasured] = useState(false);
  const containerWidthSV = useSharedValue(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, []);

  // Initial sheen animation
  useEffect(() => {
    sheenPos.value = 0;
    sheenPos.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      3,
      true,
    );

    // Auto-expand after sheen
    const timer = setTimeout(() => {
      expandToForm();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Watch job progress for status text updates and completion
  useEffect(() => {
    if (!trackedJob || !activeJobId) return;

    if (trackedJob.status === "processing" || trackedJob.status === "pending") {
      const label = trackedJob.stepLabel || "Crafting your day...";
      setStatusText(label);
      itineraryJobStore.updateStep(label);
    }

    if (trackedJob.status === "completed") {
      const itineraryId = (trackedJob.result as { itineraryId?: string })
        ?.itineraryId;
      if (!itineraryId) return;

      // Fetch the completed itinerary
      apiClient.itineraries
        .getById(itineraryId)
        .then((itinerary) => {
          setResult(itinerary);
          resultRef.current = itinerary;
          setActiveJobId(null);
          itineraryJobStore.completeJob();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Expand to show result
          cancelAnimation(sheenPos);
          setStatusText("Your itinerary is ready");
          sheenPos.value = withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(
              1,
              { duration: 600, easing: Easing.inOut(Easing.ease) },
              (fin) => {
                if (!fin) return;
                sheenActive.value = 0;
                statusOpacity.value = withTiming(0, { duration: 200 });
                animHeight.value = withTiming(
                  EXPANDED_RESULT_HEIGHT,
                  { duration: 400, easing: Easing.out(Easing.cubic) },
                  (fin2) => {
                    if (!fin2) return;
                    scheduleOnRN(setPhaseResultCb);
                    contentOpacity.value = withTiming(1, { duration: 250 });
                  },
                );
              },
            ),
          );
        })
        .catch((err) => {
          console.error("[ItineraryDialogBox] Failed to fetch itinerary:", err);
          cancelAnimation(sheenPos);
          sheenActive.value = 0;
          setError("Failed to load itinerary");
          setPhase("form");
          setActiveJobId(null);
          itineraryJobStore.failJob();
          statusOpacity.value = withTiming(0, { duration: 150 });
          animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
          });
          contentOpacity.value = withDelay(
            150,
            withTiming(1, { duration: 200 }),
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    }

    if (trackedJob.status === "failed") {
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      setError(trackedJob.error || "Failed to generate itinerary");
      setPhase("form");
      setActiveJobId(null);
      itineraryJobStore.failJob();
      statusOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [trackedJob?.status, trackedJob?.stepLabel, activeJobId]);

  const expandToForm = useCallback(() => {
    cancelAnimation(sheenPos);
    sheenActive.value = 0;
    statusOpacity.value = withTiming(0, { duration: 200 });
    animHeight.value = withTiming(
      EXPANDED_FORM_HEIGHT,
      { duration: 400, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setPhaseFormCb);
          contentOpacity.value = withTiming(1, { duration: 250 });
        }
      },
    );
  }, [setPhaseFormCb]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contentOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(
      COLLAPSED_HEIGHT,
      { duration: 350, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setCollapsedStatusCb);
          statusOpacity.value = withTiming(1, { duration: 200 });
        }
      },
    );
  }, [setCollapsedStatusCb]);

  const handleReExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    statusOpacity.value = withTiming(0, { duration: 150 });
    const targetH = resultRef.current ? EXPANDED_RESULT_HEIGHT : EXPANDED_FORM_HEIGHT;
    animHeight.value = withTiming(
      targetH,
      { duration: 350, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(setReExpandPhaseCb);
          contentOpacity.value = withDelay(50, withTiming(1, { duration: 200 }));
        }
      },
    );
  }, [setReExpandPhaseCb]);

  // Load real categories from DB
  useEffect(() => {
    apiClient.categories
      .getCategories()
      .then((cats) => setAvailableCategories(cats))
      .catch((err) => console.warn("[ItineraryDialogBox] Failed to load categories:", err));
  }, []);

  const toggleActivity = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedActivities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const toggleCategory = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const categoryNames = availableCategories
      .filter((c) => selectedCategoryIds.has(c.id))
      .map((c) => c.name);

    fireGenerate({
      duration: durationHours,
      stops: stopCount,
      activities: selectedActivities,
      catNames: categoryNames,
      budget: budgetMax,
    });
  }, [durationHours, stopCount, selectedActivities, selectedCategoryIds, availableCategories, budgetMax, fireGenerate]);

  // Fire-and-forget generate with explicit params (avoids stale closure from setState)
  const fireGenerate = useCallback(async (params: {
    duration: number;
    stops: number;
    activities: string[];
    catNames: string[];
    budget: string;
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("generating");
    setError(null);
    setStatusText("Crafting your day...");

    contentOpacity.value = withTiming(0, { duration: 150 });
    statusOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
    sheenActive.value = 1;
    sheenPos.value = 0;
    sheenPos.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    animHeight.value = withTiming(COLLAPSED_HEIGHT, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    try {
      const { jobId } = await apiClient.itineraries.create({
        city,
        plannedDate,
        budgetMin: 0,
        budgetMax: parseFloat(params.budget) || 0,
        durationHours: params.duration,
        activityTypes: params.activities,
        stopCount: params.stops || undefined,
        categoryNames: params.catNames.length > 0 ? params.catNames : undefined,
      });
      setActiveJobId(jobId);
      trackJob(jobId);
      itineraryJobStore.startJob(jobId);
    } catch (err) {
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      setError(err instanceof Error ? err.message : "Failed to generate");
      setPhase("form");
      statusOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(EXPANDED_FORM_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [city, plannedDate, trackJob]);

  const handleSurpriseMe = useCallback(() => {
    const randomDuration = DURATION_OPTIONS[Math.floor(Math.random() * DURATION_OPTIONS.length)].value;
    const randomStops = [3, 4, 5, 6][Math.floor(Math.random() * 4)];
    const shuffledActivities = [...ACTIVITY_OPTIONS].sort(() => Math.random() - 0.5);
    const randomActivities = shuffledActivities.slice(0, 2 + Math.floor(Math.random() * 2)).map((a) => a.value);
    const randomBudget = String([30, 50, 75, 100][Math.floor(Math.random() * 4)]);

    let randomCatNames: string[] = [];
    if (availableCategories.length > 0) {
      const shuffled = [...availableCategories].sort(() => Math.random() - 0.5);
      const count = Math.min(2 + Math.floor(Math.random() * 2), shuffled.length);
      randomCatNames = shuffled.slice(0, count).map((c) => c.name);
    }

    // Update form visuals (won't matter since it collapses, but keeps state consistent)
    setDurationHours(randomDuration);
    setStopCount(randomStops);
    setSelectedActivities(randomActivities);
    setBudgetMax(randomBudget);

    fireGenerate({
      duration: randomDuration,
      stops: randomStops,
      activities: randomActivities,
      catNames: randomCatNames,
      budget: randomBudget,
    });
  }, [availableCategories, fireGenerate]);

  const handleReset = useCallback(() => {
    setResult(null);
    resultRef.current = null;
    setError(null);
    contentOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(
      EXPANDED_FORM_HEIGHT,
      { duration: 300, easing: Easing.out(Easing.cubic) },
      (fin) => {
        if (fin) {
          scheduleOnRN(setPhaseFormCb);
          contentOpacity.value = withDelay(50, withTiming(1, { duration: 200 }));
        }
      },
    );
  }, [setPhaseFormCb]);

  // Date options
  const dateOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const value = d.toISOString().split("T")[0];
      const label =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      options.push({ label, value });
    }
    return options;
  }, []);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  const sheenAnimStyle = useAnimatedStyle(() => {
    if (sheenActive.value === 0) return { opacity: 0 };
    const translateX =
      containerWidthSV.value > 0
        ? interpolate(
            sheenPos.value,
            [0, 1],
            [-SHEEN_WIDTH, containerWidthSV.value + SHEEN_WIDTH],
          )
        : -SHEEN_WIDTH;
    const opacity = interpolate(sheenPos.value, [0, 0.05, 0.95, 1], [0, 0.8, 0.8, 0]);
    return { opacity, transform: [{ translateX }] };
  });

  const statusAnimStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Reanimated.View
      style={[styles.bubble, style, animatedContainerStyle]}
      onLayout={handleLayout}
    >
      {/* Status text overlay (collapsed / generating) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={phase === "collapsed" ? handleReExpand : undefined}
      >
        <Reanimated.View style={[styles.statusOverlay, statusAnimStyle]} pointerEvents="none">
          <Text style={styles.statusText}>{statusText}</Text>
        </Reanimated.View>
      </Pressable>

      {/* Sheen sweep */}
      {containerMeasured && (
        <Reanimated.View style={[styles.sheenBeam, sheenAnimStyle]} pointerEvents="none">
          <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
            <Defs>
              <LinearGradient id="itSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#86efac" stopOpacity="0" />
                <Stop offset="0.3" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="0.5" stopColor="#d4f5e0" stopOpacity="0.5" />
                <Stop offset="0.7" stopColor="#a8e6c0" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#86efac" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT} fill="url(#itSheen)" />
          </Svg>
        </Reanimated.View>
      )}

      {/* Floating dismiss button — always visible above scroll */}
      {(phase === "form" || phase === "result") && (
        <Reanimated.View style={[styles.floatingDismiss, contentAnimStyle]} pointerEvents="box-none">
          <Pressable onPress={handleDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>✕</Text>
          </Pressable>
        </Reanimated.View>
      )}

      {/* Content */}
      <Reanimated.View style={[{ flex: 1 }, contentAnimStyle]}>
        {phase === "form" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 36 }}
          >
            {/* Date */}
            <Text style={styles.sectionLabel}>When?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {dateOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.pill, plannedDate === opt.value && styles.pillActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPlannedDate(opt.value);
                  }}
                >
                  <Text style={[styles.pillText, plannedDate === opt.value && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Duration */}
            <Text style={styles.sectionLabel}>How long?</Text>
            <View style={styles.segmentRow}>
              {DURATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, durationHours === opt.value && styles.segmentActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDurationHours(opt.value);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      durationHours === opt.value && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Stops */}
            <Text style={styles.sectionLabel}>How many stops?</Text>
            <View style={styles.segmentRow}>
              {STOP_COUNT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, stopCount === opt.value && styles.segmentActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStopCount(opt.value);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      stopCount === opt.value && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Budget */}
            <Text style={styles.sectionLabel}>Budget</Text>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetCurrency}>$</Text>
              <TextInput
                style={styles.budgetInput}
                value={budgetMax}
                onChangeText={setBudgetMax}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor={colors.text.disabled}
                maxLength={5}
              />
              <Text style={styles.budgetLabel}>max</Text>
            </View>

            {/* Activities */}
            <Text style={styles.sectionLabel}>Vibes</Text>
            <View style={styles.activityGrid}>
              {ACTIVITY_OPTIONS.map((opt) => {
                const isSelected = selectedActivities.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => toggleActivity(opt.value)}
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Categories from DB */}
            {availableCategories.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Categories</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {availableCategories.map((cat) => {
                    const isSelected = selectedCategoryIds.has(cat.id);
                    return (
                      <Pressable
                        key={cat.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => toggleCategory(cat.id)}
                      >
                        {cat.icon && <Text style={styles.chipEmoji}>{cat.icon}</Text>}
                        <Text style={[styles.chipLabel, isSelected && styles.chipLabelActive]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Generate */}
            <Pressable style={styles.generateButton} onPress={handleGenerate}>
              <Text style={styles.generateButtonText}>Build My Plan</Text>
            </Pressable>

            <Pressable style={styles.surpriseButton} onPress={handleSurpriseMe}>
              <Text style={styles.surpriseButtonText}>Surprise Me</Text>
            </Pressable>
          </ScrollView>
        )}

        {phase === "result" && result && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces
            contentContainerStyle={{ paddingTop: 36 }}
          >
            <Text style={styles.resultTitle}>{result.title}</Text>
            {result.summary && (
              <Text style={styles.resultSummary}>{result.summary}</Text>
            )}
            <ItineraryTimeline items={result.items} />
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Build another</Text>
            </Pressable>
          </ScrollView>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bubble: {
      backgroundColor: colors.bg.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      overflow: "hidden",
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      marginBottom: -spacing.lg,
    },
    statusOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
    statusText: {
      color: colors.text.secondary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    sheenBeam: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 1,
    },
    floatingDismiss: {
      position: "absolute",
      top: 10,
      right: 8,
      zIndex: 10,
    },
    dismissButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bg.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissText: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 6,
      marginTop: spacing.md,
    },
    pillRow: {
      flexDirection: "row",
      gap: 6,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    pillActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    pillText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    pillTextActive: {
      color: GREEN_ACCENT,
    },
    segmentRow: {
      flexDirection: "row",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: GREEN_MUTED,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    segmentText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    segmentTextActive: {
      color: GREEN_ACCENT,
    },
    budgetRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      gap: 4,
    },
    budgetCurrency: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.lg,
      color: GREEN_ACCENT,
      fontWeight: "700",
    },
    budgetInput: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.lg,
      color: colors.text.primary,
      minWidth: 50,
      paddingVertical: 2,
      fontWeight: "700",
    },
    budgetLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.disabled,
      marginLeft: "auto",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    activityGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: 4,
    },
    chipActive: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    chipEmoji: {
      fontSize: 13,
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    chipLabelActive: {
      color: GREEN_ACCENT,
    },
    errorText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.status.error.text,
      marginTop: spacing.sm,
    },
    generateButton: {
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: 10,
      alignItems: "center",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    generateButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    surpriseButton: {
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    surpriseButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    resultTitle: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      color: colors.text.primary,
      fontWeight: "700",
    },
    resultSummary: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 4,
      marginBottom: spacing.sm,
      lineHeight: 19,
    },
    resetButton: {
      borderWidth: 1,
      borderColor: colors.border.accent,
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    resetButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
  });
