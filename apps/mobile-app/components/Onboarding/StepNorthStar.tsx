import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

// ── Per-quest progress ──────────────────────────────────

export interface QuestGenProgress {
  progress: number;
  currentQuest: number;
  totalQuests: number;
  stepProgress: number;
}

function QuestProgressBar({
  index,
  currentQuest,
  stepProgress,
}: {
  index: number;
  currentQuest: number;
  stepProgress: number;
}) {
  const colors = useColors();
  const isDone = index < currentQuest;
  const isActive = index === currentQuest;

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
    targetRef.current = stepProgress;
    if (!intervalRef.current) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const base = 1 - Math.exp(-elapsed / 5000);
        const floor = base * 95;
        setDisplayProgress((prev) => {
          const target = Math.max(targetRef.current, floor);
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

  const pct = Math.round(displayProgress);

  return (
    <View style={readoutStyles.row}>
      <Text
        style={[
          readoutStyles.label,
          isDone && { color: `rgba(${colors.accent.rgb}, 0.6)` },
          isActive && { color: colors.text.primary },
        ]}
      >
        Quest {index}
      </Text>
      <View style={readoutStyles.trackWrap}>
        <View style={readoutStyles.track}>
          <View
            style={[
              readoutStyles.fill,
              {
                width: `${pct}%` as any,
                backgroundColor: isDone
                  ? `rgba(${colors.accent.rgb}, 0.5)`
                  : colors.accent.primary,
              },
            ]}
          />
        </View>
      </View>
      <Text
        style={[
          readoutStyles.pct,
          isDone && { color: `rgba(${colors.accent.rgb}, 0.6)` },
        ]}
      >
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
  const colors = useColors();
  const quests = Array.from({ length: progress.totalQuests }, (_, i) => i + 1);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={readoutStyles.container}>
      <View style={readoutStyles.headerRow}>
        <ActivityIndicator size="small" color={colors.accent.primary} />
        <Text style={[readoutStyles.header, { color: colors.text.primary }]}>
          {label}
        </Text>
      </View>

      <View style={readoutStyles.questList}>
        {quests.map((i) => (
          <QuestProgressBar
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
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  header: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  questList: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    width: 64,
  },
  trackWrap: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  pct: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    width: 32,
    textAlign: "right",
  },
});

// ── Main step ────────────────────────────────────────────

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.flex}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={s.outer}>
          <StepCard style={s.card}>
            {onBack && !generatingQuest && <BackButton onPress={onBack} />}

            <View style={s.topRow}>
              <View style={s.headerText}>
                <Text style={[s.title, { color: colors.text.primary }]}>
                  What does success look like?
                </Text>
                <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                  Optional {"\u2014"} but it helps us understand what matters to you
                </Text>
              </View>
              <HeroCard step={8} rotation={-4} />
            </View>

            {/* Text input */}
            {!generatingQuest && (
              <View
                style={[
                  s.inputWrap,
                  { borderColor: `rgba(${colors.accent.rgb}, 0.2)` },
                ]}
              >
                <TextInput
                  style={[s.input, { color: colors.text.primary }]}
                  placeholder="I'd finally feel like I belong somewhere..."
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  value={northStar}
                  onChangeText={setNorthStar}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  editable={!generatingQuest && !isLoading}
                  blurOnSubmit
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Location status */}
            {!generatingQuest && (
              <View style={s.statusRow}>
                <Text style={[s.statusIcon, { color: colors.accent.primary }]}>
                  {userLocation ? "\u2713" : "\u25CB"}
                </Text>
                <Text style={[s.statusText, { color: colors.text.secondary }]}>
                  {userLocation ? "Location acquired" : "Acquiring location..."}
                </Text>
              </View>
            )}

            {/* Generating readout */}
            {generatingQuest && (
              <GeneratingReadout
                label={generatingLabel}
                progress={generatingProgress}
              />
            )}

            {/* Error */}
            {error && (
              <View
                style={[
                  s.errorBox,
                  {
                    borderColor: colors.status.error.border,
                    backgroundColor: colors.status.error.bg,
                  },
                ]}
              >
                <Text style={[s.errorText, { color: colors.status.error.text }]}>
                  {error}
                </Text>
              </View>
            )}

            <View style={s.spacer} />

            {/* Launch button */}
            {!generatingQuest && (
              <Animated.View
                entering={FadeInUp.delay(200).duration(250).springify()}
              >
                {error ? (
                  <NextButton label="Retry" onPress={onFinish} disabled={isLoading} />
                ) : (
                  <NextButton
                    label="Launch"
                    onPress={onFinish}
                    disabled={isLoading}
                    solid
                  />
                )}
              </Animated.View>
            )}
          </StepCard>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: {
    flex: 1,
  },
  outer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
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
  statusIcon: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    opacity: 0.7,
  },
  spacer: {
    flex: 1,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
  },
});
