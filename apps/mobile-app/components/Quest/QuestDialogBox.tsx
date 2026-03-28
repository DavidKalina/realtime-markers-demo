import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  type LayoutChangeEvent,
  ScrollView,
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
  QUEST_STATUS_MESSAGES,
  GEN_EMOJIS,
  STOP_TITLES,
} from "@/constants/questOptions";
import {
  ACTIVITY_OPTIONS,
  INTENTION_OPTIONS,
  type AdventureOption,
} from "@/constants/adventureOptions";

// ── Constants ──────────────────────────────────────────────────────────

const COLLAPSED_HEIGHT = 44;
const FORM_HEIGHT = 500;
const GENERATING_HEIGHT = 260;
const SHEEN_WIDTH = 100;
const ANIM_DURATION = 300;
const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";
const REEL_H = 24;
const REEL_SPINS = 2;
const DEFAULT_BUDGET = 50;
const DEFAULT_RADIUS = 30;

type Phase = "collapsed" | "form" | "generating";

// ── Styles ─────────────────────────────────────────────────────────────

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
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 6,
    },
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
      minHeight: 52,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.full,
      backgroundColor: colors.bg.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    chipSelected: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    chipEmoji: {
      fontSize: 13,
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
    chipLabelSelected: {
      color: GREEN_ACCENT,
    },
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
      paddingBottom: spacing.xl,
    },
  });

// ── Toggle chip ────────────────────────────────────────────────────────

const ToggleChip = React.memo(function ToggleChip({
  option,
  selected,
  onPress,
  styles,
}: {
  option: AdventureOption;
  selected: boolean;
  onPress: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(option.value);
  }, [option.value, onPress]);

  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
    >
      <Text style={styles.chipEmoji}>{option.emoji}</Text>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {option.label}
      </Text>
    </Pressable>
  );
});

// ── Generating skeleton components ─────────────────────────────────────

const EmojiReel: React.FC = React.memo(() => {
  const translateY = useSharedValue(0);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < REEL_SPINS + 1; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  const spin = useCallback(() => {
    const landIdx =
      REEL_SPINS * GEN_EMOJIS.length +
      Math.floor(Math.random() * GEN_EMOJIS.length);
    translateY.value = 0;
    translateY.value = withTiming(-landIdx * REEL_H, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  useEffect(() => {
    spin();
    const timer = setInterval(spin, 2800);
    return () => clearInterval(timer);
  }, [spin]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height: REEL_H, width: REEL_H, overflow: "hidden" }}>
      <Reanimated.View style={animStyle}>
        {reelEmojis.map((emoji, i) => (
          <Text
            key={i}
            style={{
              height: REEL_H,
              lineHeight: REEL_H,
              fontSize: 18,
              textAlign: "center",
            }}
          >
            {emoji}
          </Text>
        ))}
      </Reanimated.View>
    </View>
  );
});
EmojiReel.displayName = "EmojiReel";

const SkeletonStopRow: React.FC<{
  index: number;
  isLast: boolean;
  colors: Colors;
}> = React.memo(({ index, isLast, colors }) => {
  const reelTranslateY = useSharedValue(0);
  const [titleIdx, setTitleIdx] = useState(index % STOP_TITLES.length);
  const titleOpacity = useSharedValue(1);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < 3; i++) items.push(...GEN_EMOJIS);
    return items;
  }, []);

  useEffect(() => {
    const interval = 2200 + index * 250;
    const delay = index * 300;
    const spin = () => {
      const landIdx =
        2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
      reelTranslateY.value = 0;
      reelTranslateY.value = withTiming(-landIdx * 24, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    };
    const startTimer = setTimeout(() => {
      spin();
      const id = setInterval(spin, interval);
      return () => clearInterval(id);
    }, delay);
    const id = setInterval(() => {
      reelTranslateY.value = 0;
      const landIdx =
        2 * GEN_EMOJIS.length + Math.floor(Math.random() * GEN_EMOJIS.length);
      reelTranslateY.value = withTiming(-landIdx * 24, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    }, 2200 + index * 250);
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, [index]);

  useEffect(() => {
    const interval = 2600 + index * 200;
    const delay = index * 350;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      intervalId = setInterval(() => {
        titleOpacity.value = withSequence(
          withTiming(0, { duration: 250 }),
          withTiming(1, { duration: 250 }),
        );
        setTimeout(() => {
          setTitleIdx((i) => (i + 1) % STOP_TITLES.length);
        }, 250);
      }, interval);
    }, delay);
    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [index]);

  const reelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reelTranslateY.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  return (
    <View style={genStyles.stopRow}>
      <View style={genStyles.stopLeft}>
        <View style={[genStyles.stopDot, { backgroundColor: colors.border.medium }]} />
        {!isLast && (
          <View style={[genStyles.stopLine, { backgroundColor: colors.border.default }]} />
        )}
      </View>
      <View style={genStyles.stopContent}>
        <View style={{ width: 24, height: 24, overflow: "hidden" }}>
          <Reanimated.View style={reelStyle}>
            {reelEmojis.map((emoji, i) => (
              <Text
                key={i}
                style={{ height: 24, lineHeight: 24, fontSize: 16, textAlign: "center" }}
              >
                {emoji}
              </Text>
            ))}
          </Reanimated.View>
        </View>
        <Reanimated.Text
          style={[genStyles.stopTitle, { color: colors.text.secondary }, titleAnimStyle]}
          numberOfLines={1}
        >
          {STOP_TITLES[titleIdx]}
        </Reanimated.Text>
      </View>
    </View>
  );
});
SkeletonStopRow.displayName = "SkeletonStopRow";

const genStyles = StyleSheet.create({
  container: {
    gap: 14,
    paddingTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusTextCol: {
    flex: 1,
    gap: 2,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
  },
  stopLeft: {
    width: 20,
    alignItems: "center",
    paddingTop: 4,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stopLine: {
    width: 1,
    flex: 1,
    marginTop: 4,
  },
  stopContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  stopTitle: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
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
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());
  const [selectedIntention, setSelectedIntention] = useState<string | null>(null);
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
  const genContentOpacity = useSharedValue(0);
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

  const genContentAnimStyle = useAnimatedStyle(() => ({
    opacity: genContentOpacity.value,
  }));

  const genStatusTextOpacity = useSharedValue(1);
  const genStatusAnimStyle = useAnimatedStyle(() => ({
    opacity: genStatusTextOpacity.value,
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
    statusOpacity.value = 0;
    genContentOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
    animHeight.value = withTiming(GENERATING_HEIGHT, {
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    startSheen();
  }, [animHeight, contentOpacity, statusOpacity, genContentOpacity, startSheen]);

  // Start sheen on mount
  useEffect(() => {
    const timer = setTimeout(() => startSheen(), 500);
    return () => clearTimeout(timer);
  }, [startSheen]);

  // Watch tracked jobs
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

  // When activeJobId clears, animate back to collapsed
  useEffect(() => {
    if (phase === "generating" && !activeJobId) {
      genContentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withDelay(
        150,
        withTiming(COLLAPSED_HEIGHT, {
          duration: ANIM_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
      );
      statusOpacity.value = withDelay(300, withTiming(1, { duration: 200 }));
      startSheen();
      setPhase("collapsed");
      setStatusText("Begin a Sidequest");
      setPrompt("");
      setSelectedVibes(new Set());
      setSelectedIntention(null);
    }
  }, [activeJobId, phase]);

  // Update status text from job step label
  useEffect(() => {
    if (phase === "generating" && stepLabel) {
      genStatusTextOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );
      setTimeout(() => setStatusText(stepLabel), 200);
    }
  }, [phase, stepLabel]);

  // ── Handlers ────────────────────────────────────────────────────────
  const toggleVibe = useCallback((value: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  const toggleIntention = useCallback((value: string) => {
    setSelectedIntention((prev) => (prev === value ? null : value));
  }, []);

  // ── Embark (submit) ─────────────────────────────────────────────────
  const handleEmbark = useCallback(async () => {
    if (!userLocation) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    enterGenerating();

    try {
      const result = await apiClient.sidequests.createSidequest({
        prompt: prompt.trim(),
        radiusMiles: DEFAULT_RADIUS,
        budgetMax: DEFAULT_BUDGET,
        latitude: userLocation[1],
        longitude: userLocation[0],
        timezone: getUserTimezone(),
        activityTypes: Array.from(selectedVibes),
        intention: selectedIntention ?? undefined,
      });

      trackJob(result.jobId);
      startJob(result.jobId, result.sidequestId);
      onQuestCreated?.(result.sidequestId);
    } catch (err) {
      console.error("[QuestDialogBox] Failed to create sidequest:", err);
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
    selectedVibes,
    selectedIntention,
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

  const canEmbark = !activeJobId;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Reanimated.View
      style={[styles.bubble, style, animatedContainerStyle]}
      onLayout={handleLayout}
    >
      {/* Status text overlay (collapsed) */}
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

      {/* Sheen sweep */}
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

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            {/* Prompt */}
            <View>
              <Text style={styles.sectionLabel}>Quest Prompt</Text>
              <TextInput
                ref={promptInputRef}
                style={styles.promptInput}
                value={prompt}
                onChangeText={setPrompt}
                placeholder="What are you in the mood for?"
                placeholderTextColor={colors.text.secondary}
                maxLength={200}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                blurOnSubmit
              />
            </View>

            {/* Vibes (multi-select) */}
            <View>
              <Text style={styles.sectionLabel}>Vibes</Text>
              <View style={styles.chipWrap}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <ToggleChip
                    key={opt.value}
                    option={opt}
                    selected={selectedVibes.has(opt.value)}
                    onPress={toggleVibe}
                    styles={styles}
                  />
                ))}
              </View>
            </View>

            {/* Intention (single-select) */}
            <View>
              <Text style={styles.sectionLabel}>Intention</Text>
              <View style={styles.chipWrap}>
                {INTENTION_OPTIONS.map((opt) => (
                  <ToggleChip
                    key={opt.value}
                    option={opt}
                    selected={selectedIntention === opt.value}
                    onPress={toggleIntention}
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
        </ScrollView>
      </Reanimated.View>

      {/* Generating skeleton content */}
      {phase === "generating" && (
        <Reanimated.View
          style={[{ position: "absolute", top: 12, left: 16, right: 16, bottom: 12 }, genContentAnimStyle]}
          pointerEvents="none"
        >
          <View style={genStyles.container}>
            <View style={genStyles.statusRow}>
              <EmojiReel />
              <View style={genStyles.statusTextCol}>
                <Reanimated.Text
                  style={[
                    {
                      fontFamily: fontFamily.mono,
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.text.primary,
                    },
                    genStatusAnimStyle,
                  ]}
                  numberOfLines={1}
                >
                  {statusText}
                </Reanimated.Text>
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 10,
                    color: colors.text.disabled,
                  }}
                >
                  Crafting your adventure
                </Text>
              </View>
            </View>

            <View>
              <SkeletonStopRow index={0} isLast={false} colors={colors} />
              <SkeletonStopRow index={1} isLast={true} colors={colors} />
            </View>
          </View>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

export default React.memo(QuestDialogBox);
