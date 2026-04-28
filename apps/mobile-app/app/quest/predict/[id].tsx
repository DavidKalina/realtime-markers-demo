import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import { apiClient } from "@/services/ApiClient";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { EdLabel, EdBtn } from "@/components/Editorial";
import { edColors, edFont, edRadius, edShadows } from "@/theme/editorial";

const TICKS = 11;
const THUMB_SIZE = 38;
const TRACK_HEIGHT = 6;

function gutToEmoji(g: number): string {
  if (g <= 2) return "😬";
  if (g <= 4) return "😐";
  if (g === 5) return "🙂";
  if (g <= 7) return "😊";
  return "✨";
}

const CHIPS: { emoji: string; label: string }[] = [
  { emoji: "😬", label: "Awkward" },
  { emoji: "🌟", label: "Surprised" },
  { emoji: "😮‍💨", label: "Tired" },
  { emoji: "🦆", label: "Animals" },
  { emoji: "🤝", label: "Meet someone" },
];

export default function QuestPredictScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quest, setQuest] = useState<SidequestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gut, setGut] = useState(5);
  const [sentence, setSentence] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());

  // Slider shared values
  const trackWidth = useSharedValue(0);
  const dragX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const trackWidthRef = useRef(0); // mirror for non-worklet read

  useEffect(() => {
    if (!id) return;
    apiClient.sidequests
      .getById(id)
      .then(setQuest)
      .catch((err) => console.error("[QuestPredict] Failed to load:", err))
      .finally(() => setLoading(false));
  }, [id]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidth.value = w;
    trackWidthRef.current = w;
  }, [trackWidth]);

  const liveIdx = useDerivedValue(() => {
    if (!isDragging.value || trackWidth.value === 0) return -1;
    const ratio = dragX.value / trackWidth.value;
    return Math.max(0, Math.min(10, Math.round(ratio * 10)));
  });

  useAnimatedReaction(
    () => liveIdx.value,
    (current, prev) => {
      if (current >= 0 && current !== prev) {
        runOnJS(setGut)(current);
      }
    },
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      startX.value = (gut / 10) * trackWidth.value;
      dragX.value = startX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      dragX.value = Math.max(0, Math.min(trackWidth.value, next));
    })
    .onEnd(() => {
      const idx = Math.round((dragX.value / trackWidth.value) * 10);
      const clamped = Math.max(0, Math.min(10, idx));
      dragX.value = withSpring((clamped / 10) * trackWidth.value, {
        damping: 18,
        stiffness: 180,
      });
      isDragging.value = false;
      runOnJS(setGut)(clamped);
    });

  const thumbStyle = useAnimatedStyle(() => {
    const x = isDragging.value
      ? dragX.value
      : (gut / 10) * trackWidth.value;
    return { transform: [{ translateX: x - THUMB_SIZE / 2 }] };
  });

  const toggleTag = useCallback((label: string) => {
    Haptics.selectionAsync();
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const navigateForward = useCallback(() => {
    if (!quest) return;
    router.replace({
      pathname: "/itineraries/[id]" as const,
      params: { id: quest.id },
    });
  }, [quest, router]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigateForward();
  }, [navigateForward]);

  const handleSave = useCallback(async () => {
    if (!quest) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const firstObjective = quest.objectives?.[0];
    if (!firstObjective) {
      navigateForward();
      return;
    }

    setSaving(true);
    try {
      // Map gut (0..10, low=nervous, high=excited) → predictedAnxiety (0..4, high=anxious).
      const predictedAnxiety = Math.round((10 - gut) / 2.5);
      const tagPrefix = Array.from(tags).length > 0
        ? `[${Array.from(tags).map((t) => CHIPS.find((c) => c.label === t)?.emoji ?? "").join(" ")}] `
        : "";
      const outcome = `${tagPrefix}${sentence.trim()}`.trim();

      await apiClient.sidequests.updateObjectivePrediction(firstObjective.id, {
        predictedAnxiety,
        ...(outcome && { predictedOutcome: outcome }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("[QuestPredict] Failed to save prediction:", err);
    } finally {
      setSaving(false);
      navigateForward();
    }
  }, [quest, gut, sentence, tags, navigateForward]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={edColors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (!quest) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Quest not found.</Text>
          <EdBtn label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.topRow}>
          <EdLabel color={edColors.coral}>BEFORE YOU GO · 1 OF 2</EdLabel>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <X size={18} color={edColors.ink} strokeWidth={1.6} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.h1}>
            What do you{" "}
            <Text style={styles.h1Italic}>think</Text> will happen?
          </Text>
          <Text style={styles.body}>
            A guess, a worry, a hope. We&apos;ll come back to it after.
          </Text>

          {/* Slider */}
          <View style={styles.sliderBlock}>
            <EdLabel>Gut feeling</EdLabel>
            <GestureDetector gesture={pan}>
              <View style={styles.sliderArea}>
                <View
                  style={styles.trackOuter}
                  onLayout={onTrackLayout}
                >
                  <Svg
                    style={StyleSheet.absoluteFill}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="none"
                  >
                    <Defs>
                      <SvgLinearGradient id="gutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor={edColors.coral} stopOpacity={0.6} />
                        <Stop offset="50%" stopColor={edColors.amber} stopOpacity={0.6} />
                        <Stop offset="100%" stopColor={edColors.sage} stopOpacity={0.6} />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx={TRACK_HEIGHT / 2}
                      ry={TRACK_HEIGHT / 2}
                      fill="url(#gutGrad)"
                    />
                  </Svg>
                  {Array.from({ length: TICKS }).map((_, i) => {
                    const tall = i % 5 === 0;
                    const leftPct = (i / (TICKS - 1)) * 100;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.tick,
                          {
                            left: `${leftPct}%`,
                            height: tall ? 12 : 6,
                            opacity: tall ? 0.4 : 0.2,
                            top: tall ? -3 : 0,
                          },
                        ]}
                      />
                    );
                  })}
                  <Animated.View style={[styles.thumb, thumbStyle]}>
                    <Text style={styles.thumbEmoji}>{gutToEmoji(gut)}</Text>
                  </Animated.View>
                </View>
                <View style={styles.sliderLabelsRow}>
                  <Text style={styles.sliderLabel}>nervous</Text>
                  <Text style={styles.sliderLabel}>excited</Text>
                </View>
              </View>
            </GestureDetector>
          </View>

          {/* Sentence input */}
          <View style={styles.sentenceBlock}>
            <EdLabel>In a sentence</EdLabel>
            <View style={styles.sentenceCard}>
              <TextInput
                value={sentence}
                onChangeText={setSentence}
                multiline
                placeholder="I'll probably feel a little awkward at first…"
                placeholderTextColor={edColors.inkMute}
                style={styles.sentenceInput}
                selectionColor={edColors.coral}
              />
            </View>
          </View>

          {/* Chip strip */}
          <View style={styles.chipsBlock}>
            <View style={styles.chipsRow}>
              {CHIPS.map((chip) => {
                const selected = tags.has(chip.label);
                return (
                  <Pressable
                    key={chip.label}
                    onPress={() => toggleTag(chip.label)}
                    style={[
                      styles.chip,
                      selected ? styles.chipSelected : styles.chipUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? edColors.paper : edColors.ink },
                      ]}
                    >
                      {chip.emoji} {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 120 + insets.bottom }} />
        </ScrollView>

        <View
          style={[styles.footerFade, { height: 110 + insets.bottom }]}
          pointerEvents="none"
        >
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <Defs>
              <SvgLinearGradient id="predictFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={edColors.paper} stopOpacity={0} />
                <Stop offset="40%" stopColor={edColors.paper} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#predictFade)" />
          </Svg>
        </View>
        <View style={[styles.footer, { bottom: 18 + insets.bottom }]}>
          <EdBtn
            label={saving ? "Saving…" : "Save & start the quest"}
            variant="primary"
            onPress={handleSave}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: edColors.paper },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontFamily: edFont.serifMedium,
    fontSize: 18,
    color: edColors.ink,
    letterSpacing: -0.3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 14 },
  h1: {
    fontFamily: edFont.serifRegular,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: edColors.ink,
  },
  h1Italic: {
    fontFamily: edFont.serifMediumItalic,
    color: edColors.coral,
  },
  body: {
    fontFamily: edFont.sansRegular,
    fontSize: 14,
    lineHeight: 21,
    color: edColors.inkSoft,
    marginTop: 12,
  },

  // Slider
  sliderBlock: { marginTop: 24, gap: 10 },
  sliderArea: { gap: 8 },
  trackOuter: {
    height: 56,
    justifyContent: "center",
    paddingHorizontal: THUMB_SIZE / 2,
  },
  tick: {
    position: "absolute",
    width: 1,
    backgroundColor: edColors.inkMute,
    top: 0,
  },
  thumb: {
    position: "absolute",
    top: 56 / 2 - THUMB_SIZE / 2,
    left: THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: edColors.paperHi,
    borderWidth: 1.5,
    borderColor: edColors.ink,
    alignItems: "center",
    justifyContent: "center",
    ...edShadows.cardResting,
  },
  thumbEmoji: { fontSize: 18 },
  sliderLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontFamily: edFont.sansRegular,
    fontSize: 11,
    color: edColors.inkMute,
    letterSpacing: -0.05,
  },

  // Sentence
  sentenceBlock: { marginTop: 22, gap: 10 },
  sentenceCard: {
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
  },
  sentenceInput: {
    fontFamily: edFont.serifRegularItalic,
    fontSize: 15,
    lineHeight: 22,
    color: edColors.ink,
    minHeight: 80,
    textAlignVertical: "top",
  },

  // Chips
  chipsBlock: { marginTop: 14 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: edRadius.pill,
  },
  chipSelected: {
    backgroundColor: edColors.ink,
  },
  chipUnselected: {
    backgroundColor: edColors.paperHi,
    borderWidth: 1,
    borderColor: edColors.rule,
  },
  chipText: {
    fontFamily: edFont.sansMedium,
    fontSize: 12,
    letterSpacing: -0.05,
  },

  // Footer
  footerFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
  },
});
