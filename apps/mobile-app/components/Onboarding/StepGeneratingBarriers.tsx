import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { NextButton, GREEN_ACCENT } from "./shared";

const BAR_W = 24;
const CHAR_MS = 60;

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
  const [barFill, setBarFill] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const calledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle through phases
  useEffect(() => {
    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => Math.min(prev + 1, PHASE_LABELS.length - 1));
    }, 1400);
    return () => clearInterval(phaseInterval);
  }, []);

  // Animate progress bar
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setBarFill((prev) => Math.min(prev + 1, BAR_W - 3));
    }, CHAR_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const result = await apiClient.sidequests.generateBarriers({
          primaryGoal,
        });

        setBarFill(BAR_W);
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
    setBarFill(0);
    setPhaseIndex(0);
    calledRef.current = false;
    intervalRef.current = setInterval(() => {
      setBarFill((prev) => Math.min(prev + 1, BAR_W - 3));
    }, CHAR_MS);
  };

  const bar = "\u2588".repeat(barFill) + "\u2591".repeat(BAR_W - barFill);
  const pct = Math.round((barFill / BAR_W) * 100);
  const isDone = barFill >= BAR_W;

  return (
    <View style={s.container}>
      {onBack && !isDone && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
        </Pressable>
      )}

      <View style={s.content}>
        <Animated.View entering={FadeIn.duration(400)} style={s.titleWrap}>
          <Text style={s.title}>Personalizing barriers</Text>
          <Text style={[s.subtitle, { color: colors.text.secondary }]}>
            Identifying what might hold you back from your goal
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(400)} style={s.terminalBlock}>
          <View style={s.configSection}>
            <View style={s.configRow}>
              <Text style={s.configKey}>goal</Text>
              <Text style={s.configVal} numberOfLines={1}>{primaryGoal}</Text>
            </View>
          </View>

          <View style={s.separator} />

          <View style={s.phaseSection}>
            {PHASE_LABELS.map((label, i) => (
              <Animated.View
                key={label}
                entering={FadeInDown.delay(300 + i * 120).duration(180).springify().damping(28).stiffness(400)}
                style={s.phaseRow}
              >
                <Text style={[
                  s.phaseIcon,
                  (i < phaseIndex || isDone) && s.phaseDone,
                  i === phaseIndex && !isDone && s.phaseActive,
                ]}>
                  {i < phaseIndex || isDone ? "\u2713" : i === phaseIndex ? "\u25B8" : "\u00B7"}
                </Text>
                <Text style={[
                  s.phaseLabel,
                  (i < phaseIndex || isDone) && s.phaseLabelDone,
                  i === phaseIndex && !isDone && s.phaseLabelActive,
                ]}>
                  {label}
                </Text>
              </Animated.View>
            ))}
          </View>

          <View style={s.barRow}>
            <Text style={[s.barText, isDone && s.barDone]}>{bar}</Text>
            <Text style={[s.pctText, isDone && s.pctDone]}>{pct}%</Text>
          </View>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(300)} style={s.errorSection}>
            <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
              <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
            </View>
            <NextButton label="Retry" onPress={handleRetry} />
          </Animated.View>
        )}
      </View>
    </View>
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
    paddingHorizontal: 28,
    paddingTop: 52,
    gap: spacing.xl,
  },
  titleWrap: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
    opacity: 0.6,
  },
  terminalBlock: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.15)",
    padding: spacing.xl,
    gap: 12,
  },
  configSection: {
    gap: 8,
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  configKey: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.35)",
    width: 56,
  },
  configVal: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(134, 239, 172, 0.7)",
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  phaseSection: {
    gap: 10,
  },
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  phaseIcon: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.15)",
    width: 16,
  },
  phaseActive: {
    color: GREEN_ACCENT,
  },
  phaseDone: {
    color: "rgba(134, 239, 172, 0.5)",
  },
  phaseLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.2)",
    letterSpacing: 0.3,
  },
  phaseLabelActive: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  phaseLabelDone: {
    color: "rgba(134, 239, 172, 0.45)",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  barText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: -1,
    flex: 1,
    color: "rgba(255, 255, 255, 0.25)",
  },
  barDone: {
    color: GREEN_ACCENT,
  },
  pctText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.2)",
    width: 35,
    textAlign: "right",
  },
  pctDone: {
    color: GREEN_ACCENT,
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
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
});
