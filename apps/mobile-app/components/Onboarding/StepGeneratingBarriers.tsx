import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";

const PHASE_LABELS = [
  "Analyzing your goal",
  "Identifying challenge areas",
  "Generating barriers",
];

export function StepGeneratingBarriers({
  primaryGoal,
  onBarriersReady,
  onBack,
}: {
  primaryGoal: string;
  onBarriersReady: (barriers: { key: string; label: string; text: string }[]) => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const calledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => Math.min(prev + 1, PHASE_LABELS.length - 1));
    }, 1400);
    return () => clearInterval(phaseInterval);
  }, []);

  useEffect(() => {
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = 1 - Math.exp(-elapsed / 3500);
      setProgress(p * 0.95);
    }, 80);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const result = await apiClient.sidequests.generateBarriers({ primaryGoal });

        setProgress(1);
        setPhaseIndex(PHASE_LABELS.length - 1);
        if (intervalRef.current) clearInterval(intervalRef.current);

        setTimeout(() => {
          onBarriersReady(result.barriers);
        }, 500);
      } catch (err: unknown) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        console.error("[StepGeneratingBarriers] Error:", err);
        setError(
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to generate barriers. Please try again.",
        );
      }
    })();
  }, [primaryGoal, onBarriersReady]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setPhaseIndex(0);
    calledRef.current = false;
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = 1 - Math.exp(-elapsed / 3500);
      setProgress(p * 0.95);
    }, 80);
  };

  const isDone = progress >= 1;
  const pct = Math.round(progress * 100);

  return (
    <View style={s.outer}>
      <StepCard style={s.card}>
        {onBack && !isDone ? <BackButton onPress={onBack} /> : <View style={s.backPlaceholder} />}

        <View style={s.topRow}>
            <View style={s.headerText}>
              <Text style={[s.title, { color: colors.text.primary }]}>
                Personalizing barriers
              </Text>
              <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                Identifying what might hold you back from your goal
              </Text>
            </View>
            <HeroCard step={4} rotation={4} />
          </View>

          <View style={s.phases}>
            {PHASE_LABELS.map((label, i) => (
              <Animated.View
                key={label}
                entering={FadeInDown.delay(200 + i * 100).duration(200).springify()}
                style={s.phaseRow}
              >
                {i === phaseIndex && !isDone ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.accent.primary}
                    style={s.phaseIndicator}
                  />
                ) : (
                  <Text
                    style={[
                      s.phaseCheck,
                      (i < phaseIndex || isDone) && { color: colors.accent.primary },
                    ]}
                  >
                    {i < phaseIndex || isDone ? "\u2713" : "\u2022"}
                  </Text>
                )}
                <Text
                  style={[
                    s.phaseLabel,
                    (i < phaseIndex || isDone) && { color: colors.text.primary, opacity: 0.7 },
                    i === phaseIndex && !isDone && { color: colors.text.primary },
                  ]}
                >
                  {label}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${pct}%` as any,
                    backgroundColor: colors.accent.primary,
                  },
                ]}
              />
            </View>
            <Text style={[s.progressPct, { color: colors.text.secondary }]}>
              {pct}%
            </Text>
          </View>

          {error && (
            <Animated.View entering={FadeIn.duration(300)} style={s.errorSection}>
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
              <NextButton label="Retry" onPress={handleRetry} />
            </Animated.View>
          )}
      </StepCard>
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    flex: 1,
  },
  backPlaceholder: {
    height: 28,
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
  phases: {
    gap: spacing.md,
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  phaseIndicator: {
    width: 18,
    height: 18,
  },
  phaseCheck: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.4)",
    width: 18,
    textAlign: "center",
  },
  phaseLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
  },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressPct: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    width: 35,
    textAlign: "right",
    opacity: 0.7,
  },
  errorSection: {
    gap: spacing.md,
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
