import React, { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { NextButton, useTypewriter, GREEN_ACCENT } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors, type Colors } from "@/theme";

// ── Per-quest progress bars ─────────────────────────────

export interface QuestGenProgress {
  progress: number;       // 0-100 overall
  currentQuest: number;   // 1-based
  totalQuests: number;
  stepProgress: number;   // 0-100 within current quest
}

const BAR_W = 24;

function QuestBar({
  index,
  currentQuest,
  stepProgress,
}: {
  index: number; // 1-based
  currentQuest: number;
  stepProgress: number;
}) {
  const isDone = index < currentQuest;
  const isActive = index === currentQuest;

  // Smooth between poll updates with asymptotic fill
  const [displayProgress, setDisplayProgress] = useState(0);
  const targetRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (isDone) {
      setDisplayProgress(100);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (!isActive) {
      setDisplayProgress(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Active quest: smoothly approach stepProgress, never hang
    targetRef.current = stepProgress;
    if (!intervalRef.current) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        // Asymptotic approach to target, but always creep forward
        const base = 1 - Math.exp(-elapsed / 5000);
        const floor = base * 95; // always-moving floor
        setDisplayProgress((prev) => {
          const target = Math.max(targetRef.current, floor);
          // Ease toward target
          return prev + (target - prev) * 0.08;
        });
      }, 60);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isDone, isActive, stepProgress]);

  const fill = Math.round((displayProgress / 100) * BAR_W);
  const bar = "\u2588".repeat(fill) + "\u2591".repeat(BAR_W - fill);
  const pct = Math.round(displayProgress);

  return (
    <View style={readoutStyles.row}>
      <Text style={[
        readoutStyles.icon,
        isDone && readoutStyles.iconDone,
        isActive && readoutStyles.iconActive,
      ]}>
        {isDone ? "\u2713" : isActive ? "\u25B8" : "\u00B7"}
      </Text>
      <Text style={[
        readoutStyles.label,
        isDone && readoutStyles.labelDone,
        isActive && readoutStyles.labelActive,
      ]}>
        Quest {index}
      </Text>
      <Text style={[
        readoutStyles.bar,
        isDone && readoutStyles.barDone,
        isActive && readoutStyles.barActive,
      ]}>
        {bar}
      </Text>
      <Text style={[
        readoutStyles.pct,
        isDone && readoutStyles.pctDone,
      ]}>
        {isDone ? "\u2713" : isActive ? `${pct}%` : "\u2014"}
      </Text>
    </View>
  );
}

function GeneratingReadout({
  label,
  progress,
}: {
  label: string;
  progress: QuestGenProgress;
}) {
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  const quests = Array.from({ length: progress.totalQuests }, (_, i) => i + 1);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={readoutStyles.container}>
      <Text style={readoutStyles.header}>
        {showCursor ? "\u2588" : " "}{" "}{label}
      </Text>

      <View style={readoutStyles.questList}>
        {quests.map((i) => (
          <QuestBar
            key={i}
            index={i}
            currentQuest={progress.currentQuest}
            stepProgress={progress.stepProgress}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const readoutStyles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  questList: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.15)",
    width: 14,
  },
  iconActive: {
    color: GREEN_ACCENT,
  },
  iconDone: {
    color: "rgba(134, 239, 172, 0.5)",
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.2)",
    width: 64,
  },
  labelActive: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  labelDone: {
    color: "rgba(134, 239, 172, 0.45)",
  },
  bar: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: -1,
    flex: 1,
    color: "rgba(255, 255, 255, 0.1)",
  },
  barActive: {
    color: "rgba(255, 255, 255, 0.35)",
  },
  barDone: {
    color: GREEN_ACCENT,
  },
  pct: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.2)",
    width: 32,
    textAlign: "right",
  },
  pctDone: {
    color: "rgba(134, 239, 172, 0.5)",
  },
});

// ── Main step ─────────────────────────────────────────────

export function StepNorthStar({
  northStar,
  setNorthStar,
  userLocation,
  isLoading,
  generatingQuest,
  generatingLabel,
  generatingProgress,
  error,
  onFinish,
  onBack,
}: {
  northStar: string;
  setNorthStar: (v: string) => void;
  userLocation: [number, number] | null;
  isLoading: boolean;
  generatingQuest: boolean;
  generatingLabel: string;
  generatingProgress: QuestGenProgress;
  error: string | null;
  onFinish: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();

  const prompt = useTypewriter("What does success look like?", 28, 150);
  const promptDone = prompt.length >= 28;

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (promptDone) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, [promptDone]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={s.container}>
          {onBack && !generatingQuest && (
            <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
              <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
            </Pressable>
          )}

          <View style={s.content}>
            {/* Typewriter prompt */}
            <View style={s.promptWrap}>
              <Text style={s.promptText}>
                {prompt}
                {!promptDone && showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
              </Text>
              {promptDone && (
                <Animated.View entering={FadeIn.delay(150).duration(350)}>
                  <Text style={[s.promptSub, { color: colors.text.secondary }]}>
                    Optional {"\u2014"} but it helps us understand what matters to you
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Text input */}
            {promptDone && !generatingQuest && (
              <Animated.View entering={FadeIn.delay(300).duration(400)} style={s.inputWrap}>
                <TextInput
                  style={[s.input, { color: colors.text.primary }]}
                  placeholder={"I'd finally feel like I belong somewhere..."}
                  placeholderTextColor={"rgba(255, 255, 255, 0.2)"}
                  value={northStar}
                  onChangeText={setNorthStar}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  editable={!generatingQuest && !isLoading}
                  blurOnSubmit
                  returnKeyType="done"
                />
              </Animated.View>
            )}

            {/* Location status */}
            {promptDone && !generatingQuest && (
              <Animated.View entering={FadeIn.delay(500).duration(400)} style={s.statusRow}>
                <Text style={s.statusDot}>{userLocation ? "\u2713" : "\u25CB"}</Text>
                <Text style={[s.statusText, { color: colors.text.secondary }]}>
                  {userLocation ? "Location acquired" : "Acquiring location..."}
                </Text>
              </Animated.View>
            )}

            {/* Generating readout */}
            {generatingQuest && (
              <GeneratingReadout label={generatingLabel} progress={generatingProgress} />
            )}

            {/* Error */}
            {error && (
              <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
                <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
              </View>
            )}
          </View>

          {/* Launch button */}
          <View style={s.bottom}>
            {!generatingQuest && promptDone && (
              <Animated.View entering={FadeInUp.delay(600).duration(250).springify().damping(28).stiffness(400)}>
                {error ? (
                  <NextButton label="Retry" onPress={onFinish} disabled={isLoading} />
                ) : (
                  <NextButton label="Launch" onPress={onFinish} disabled={isLoading} solid />
                )}
              </Animated.View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 52,
    gap: spacing.xl,
  },
  promptWrap: {
    gap: spacing._10,
  },
  promptText: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  promptSub: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.3,
    opacity: 0.6,
  },
  cursor: {
    fontSize: 20,
    color: GREEN_ACCENT,
    opacity: 0.5,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.2)",
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 110,
    lineHeight: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: GREEN_ACCENT,
    opacity: 0.6,
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    opacity: 0.5,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    minHeight: 80,
  },
});
