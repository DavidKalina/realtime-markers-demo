import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  useColors,
  fontFamily,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { useUserLocation } from "@/contexts/LocationContext";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { getUserTimezone } from "@/utils/dateTimeFormatting";
import {
  BUDGET_TIERS,
  DEFAULT_RADIUS_MILES,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
  QUEST_STATUS_MESSAGES,
  type BudgetTier,
} from "@/constants/questOptions";

// ── Constants ──────────────────────────────────────────────────────────

const COLLAPSED_HEIGHT = 44;
const FORM_HEIGHT = 370;
const SHEEN_WIDTH = 100;
const ANIM_DURATION = 300;
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

type Phase = "collapsed" | "form" | "generating";

// ── Styles (matches ItineraryDialogBox aesthetic) ─────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    // Main container — identical to ItineraryDialogBox.bubble
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
    // Status text overlay (collapsed / generating)
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
    // Header row — same as ItineraryDialogBox
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
      zIndex: 5,
    },
    headerTitle: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.5,
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
    // Section labels
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    sliderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sliderValueText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: GREEN_ACCENT,
    },
    // Text input
    promptInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      minHeight: 72,
    },
    // Budget chips — same style as ItineraryDialogBox pills
    chipRow: {
      flexDirection: "row",
      gap: 6,
    },
    chip: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      alignItems: "center",
    },
    chipSelected: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    chipLabelSelected: {
      color: GREEN_ACCENT,
    },
    chipSublabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.secondary,
      marginTop: 1,
    },
    chipSublabelSelected: {
      color: GREEN_ACCENT,
    },
    // Footer / Embark button — same as ItineraryDialogBox generateButton
    footerRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
      zIndex: 5,
    },
    embarkButton: {
      flex: 1,
      backgroundColor: GREEN_MUTED,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.25)",
      paddingVertical: 8,
      alignItems: "center",
    },
    embarkButtonDisabled: {
      opacity: 0.4,
    },
    embarkText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: GREEN_ACCENT,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    formSection: {
      gap: spacing.md,
    },
  });

// ── Radius slider ──────────────────────────────────────────────────────

const SLIDER_THUMB_SIZE = 22;
const SLIDER_STEP = 0.5;

const RadiusSlider = React.memo(function RadiusSlider({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: Colors;
}) {
  const trackWidth = useRef(0);
  const trackX = useRef(0);

  const fraction =
    (value - MIN_RADIUS_MILES) / (MAX_RADIUS_MILES - MIN_RADIUS_MILES);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    (
      e.target as unknown as {
        measureInWindow: (cb: (x: number) => void) => void;
      }
    ).measureInWindow((x: number) => {
      trackX.current = x;
    });
  }, []);

  const clampToStep = useCallback((pageX: number) => {
    const relX = pageX - trackX.current;
    const pct = Math.max(0, Math.min(1, relX / trackWidth.current));
    const raw = MIN_RADIUS_MILES + pct * (MAX_RADIUS_MILES - MIN_RADIUS_MILES);
    const stepped = Math.round(raw / SLIDER_STEP) * SLIDER_STEP;
    return Math.max(MIN_RADIUS_MILES, Math.min(MAX_RADIUS_MILES, stepped));
  }, []);

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      const next = clampToStep(e.nativeEvent.pageX);
      if (next !== value) {
        Haptics.selectionAsync();
        onChange(next);
      }
    },
    [value, onChange, clampToStep],
  );

  return (
    <View style={sliderStaticStyles.wrapper}>
      <View
        style={sliderStaticStyles.track}
        onLayout={onTrackLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View
          style={[
            sliderStaticStyles.trackBg,
            { backgroundColor: colors.border.subtle },
          ]}
        />
        <View
          style={[sliderStaticStyles.trackFill, { width: `${fraction * 100}%` }]}
        />
        <View
          style={[
            sliderStaticStyles.thumb,
            {
              left: `${fraction * 100}%`,
              marginLeft: -SLIDER_THUMB_SIZE / 2,
            },
          ]}
        />
      </View>
    </View>
  );
});

const sliderStaticStyles = StyleSheet.create({
  wrapper: {
    paddingVertical: 4,
  },
  track: {
    height: SLIDER_THUMB_SIZE,
    justifyContent: "center",
    marginHorizontal: SLIDER_THUMB_SIZE / 2,
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN_ACCENT,
  },
  thumb: {
    position: "absolute",
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    borderRadius: SLIDER_THUMB_SIZE / 2,
    backgroundColor: GREEN_ACCENT,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
  },
});

// ── Budget chip ────────────────────────────────────────────────────────

const BudgetChip = React.memo(function BudgetChip({
  tier,
  selected,
  onPress,
  styles,
}: {
  tier: BudgetTier;
  selected: boolean;
  onPress: (tier: BudgetTier) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(tier);
  }, [tier, onPress]);

  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {tier.label}
      </Text>
    </Pressable>
  );
});

// ── Main component ─────────────────────────────────────────────────────

interface QuestDialogBoxProps {
  style?: ViewStyle;
  onQuestCreated?: (itineraryId: string) => void;
}

function QuestDialogBox({ style, onQuestCreated }: QuestDialogBoxProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userLocation } = useUserLocation();
  const { trackJob, activeJobs } = useJobProgressContext();
  const startJob = useItineraryJobStore((s) => s.startJob);
  const completeJob = useItineraryJobStore((s) => s.completeJob);
  const failJob = useItineraryJobStore((s) => s.failJob);
  const activeJobId = useItineraryJobStore((s) => s.activeJobId);
  const stepLabel = useItineraryJobStore((s) => s.stepLabel);

  // ── Form state ──────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [selectedBudget, setSelectedBudget] = useState<BudgetTier>(
    BUDGET_TIERS[1],
  );
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [statusText, setStatusText] = useState("Begin a Sidequest");
  const promptInputRef = useRef<TextInput>(null);

  // ── Rotating status message ─────────────────────────────────────────
  const [statusMsgIdx, setStatusMsgIdx] = useState(0);
  useEffect(() => {
    if (phase !== "generating") return;
    const timer = setInterval(() => {
      setStatusMsgIdx((prev) => {
        const next = (prev + 1) % QUEST_STATUS_MESSAGES.length;
        setStatusText(QUEST_STATUS_MESSAGES[next]);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Animation shared values ─────────────────────────────────────────
  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const contentOpacity = useSharedValue(0);
  const statusOpacity = useSharedValue(1);
  const sheenPos = useSharedValue(0);
  const sheenActive = useSharedValue(1);
  const containerWidthSV = useSharedValue(0);
  const [containerMeasured, setContainerMeasured] = useState(false);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, [containerWidthSV]);

  // ── Animated styles ─────────────────────────────────────────────────
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
    const opacity = interpolate(
      sheenPos.value,
      [0, 0.05, 0.95, 1],
      [0, 0.8, 0.8, 0],
    );
    return { opacity, transform: [{ translateX }] };
  });

  const statusAnimStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // ── Phase transitions ───────────────────────────────────────────────
  const startSheen = useCallback(() => {
    sheenActive.value = 1;
    sheenPos.value = 0;
    sheenPos.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [sheenPos, sheenActive]);

  const stopSheen = useCallback(() => {
    cancelAnimation(sheenPos);
    sheenActive.value = 0;
  }, [sheenPos, sheenActive]);

  const expand = useCallback(() => {
    if (phase !== "collapsed") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase("form");
    stopSheen();
    statusOpacity.value = withTiming(0, { duration: 150 });
    animHeight.value = withTiming(FORM_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
  }, [phase, animHeight, contentOpacity, statusOpacity, stopSheen]);

  const collapse = useCallback(() => {
    setPhase("collapsed");
    setStatusText("Begin a Sidequest");
    contentOpacity.value = withTiming(0, { duration: 150 });
    statusOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
    animHeight.value = withTiming(COLLAPSED_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    startSheen();
  }, [animHeight, contentOpacity, statusOpacity, startSheen]);

  const enterGenerating = useCallback(() => {
    setPhase("generating");
    setStatusText(QUEST_STATUS_MESSAGES[0]);
    contentOpacity.value = withTiming(0, { duration: 150 });
    statusOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
    animHeight.value = withTiming(COLLAPSED_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    startSheen();
  }, [animHeight, contentOpacity, statusOpacity, startSheen]);

  // Start sheen on mount
  useEffect(() => {
    const timer = setTimeout(() => startSheen(), 500);
    return () => clearTimeout(timer);
  }, [startSheen]);

  // Watch tracked jobs — when our job completes/fails, update the store
  useEffect(() => {
    if (!activeJobId) return;
    const job = activeJobs.find((j) => j.jobId === activeJobId);
    if (!job) return;
    if (job.status === "completed") {
      completeJob();
    } else if (job.status === "failed") {
      failJob();
    }
  }, [activeJobs, activeJobId, completeJob, failJob]);

  // When activeJobId clears (via completeJob/failJob), reset the form
  useEffect(() => {
    if (phase === "generating" && !activeJobId) {
      setPhase("collapsed");
      setStatusText("Begin a Sidequest");
      setPrompt("");
      setRadiusMiles(DEFAULT_RADIUS_MILES);
      setSelectedBudget(BUDGET_TIERS[1]);
    }
  }, [activeJobId, phase]);

  // Update status text from job step label
  useEffect(() => {
    if (phase === "generating" && stepLabel) {
      setStatusText(stepLabel);
    }
  }, [phase, stepLabel]);

  // ── Embark (submit) ─────────────────────────────────────────────────
  const handleEmbark = useCallback(async () => {
    if (!userLocation) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    enterGenerating();

    try {
      const result = await apiClient.itineraries.createSidequest({
        prompt: prompt.trim(),
        radiusMiles,
        budgetMax: selectedBudget.value,
        latitude: userLocation[1],
        longitude: userLocation[0],
        timezone: getUserTimezone(),
      });

      trackJob(result.jobId);
      startJob(result.jobId, result.itineraryId);
      onQuestCreated?.(result.itineraryId);
    } catch (err) {
      console.error("[QuestDialogBox] Failed to create sidequest:", err);
      // Revert to form on error
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      setPhase("form");
      statusOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(FORM_HEIGHT, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withDelay(150, withTiming(1, { duration: 200 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [
    userLocation,
    prompt,
    radiusMiles,
    selectedBudget,
    enterGenerating,
    trackJob,
    startJob,
    onQuestCreated,
    sheenPos,
    sheenActive,
    statusOpacity,
    animHeight,
    contentOpacity,
  ]);

  const handleBudgetSelect = useCallback((tier: BudgetTier) => {
    setSelectedBudget(tier);
  }, []);

  const canEmbark = !activeJobId;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Reanimated.View
      style={[styles.bubble, style, animatedContainerStyle]}
      onLayout={handleLayout}
    >
      {/* Status text overlay (collapsed / generating) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={phase === "collapsed" ? expand : undefined}
      >
        <Reanimated.View
          style={[styles.statusOverlay, statusAnimStyle]}
          pointerEvents="none"
        >
          <Text style={styles.statusText}>{statusText}</Text>
        </Reanimated.View>
      </Pressable>

      {/* Sheen sweep — identical to ItineraryDialogBox */}
      {containerMeasured && (
        <Reanimated.View
          style={[styles.sheenBeam, sheenAnimStyle]}
          pointerEvents="none"
        >
          <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
            <Defs>
              <LinearGradient id="questSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={GREEN_ACCENT} stopOpacity="0" />
                <Stop offset="0.5" stopColor={GREEN_ACCENT} stopOpacity="0.15" />
                <Stop offset="1" stopColor={GREEN_ACCENT} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              width={SHEEN_WIDTH}
              height={COLLAPSED_HEIGHT}
              fill="url(#questSheen)"
            />
          </Svg>
        </Reanimated.View>
      )}

      {/* Expanded form content */}
      <Reanimated.View style={contentAnimStyle} pointerEvents={phase === "form" ? "auto" : "none"}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Begin a Sidequest</Text>
          <Pressable onPress={collapse} style={styles.dismissButton}>
            <Text style={styles.dismissText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.formSection}>
          {/* Prompt */}
          <View>
            <Text style={styles.sectionLabel}>Quest Prompt</Text>
            <TextInput
              ref={promptInputRef}
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe your quest... or leave blank for a surprise"
              placeholderTextColor={colors.text.secondary}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              blurOnSubmit
            />
          </View>

          {/* Distance slider */}
          <View>
            <View style={styles.sliderRow}>
              <Text style={styles.sectionLabel}>Quest Radius</Text>
              <Text style={styles.sliderValueText}>{radiusMiles} mi</Text>
            </View>
            <RadiusSlider
              value={radiusMiles}
              onChange={setRadiusMiles}
              colors={colors}
            />
          </View>

          {/* Budget chips */}
          <View>
            <Text style={styles.sectionLabel}>Gold Budget</Text>
            <View style={styles.chipRow}>
              {BUDGET_TIERS.map((tier) => (
                <BudgetChip
                  key={tier.value}
                  tier={tier}
                  selected={selectedBudget.value === tier.value}
                  onPress={handleBudgetSelect}
                  styles={styles}
                />
              ))}
            </View>
          </View>

          {/* Embark button */}
          <View style={styles.footerRow}>
            <Pressable
              style={[
                styles.embarkButton,
                !canEmbark && styles.embarkButtonDisabled,
              ]}
              onPress={handleEmbark}
              disabled={!canEmbark}
            >
              <Text style={styles.embarkText}>Embark</Text>
            </Pressable>
          </View>
        </View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default React.memo(QuestDialogBox);
