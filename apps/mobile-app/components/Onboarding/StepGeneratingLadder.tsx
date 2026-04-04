import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import { NextButton } from "./shared";

const GREEN = "#86efac";
const BAR_W = 20;
const CHAR_MS = 60;

interface GeneratedScenario {
  id: string;
  text: string;
  dimension: string;
}

export function StepGeneratingLadder({
  primaryGoal,
  goals,
  barriers,
  activities,
  onScenariosReady,
  onBack,
}: {
  primaryGoal: string;
  goals: string[];
  barriers: string[];
  activities: string[];
  onScenariosReady: (scenarios: GeneratedScenario[], dimensions: string[]) => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const [error, setError] = useState<string | null>(null);
  const [barFill, setBarFill] = useState(0);
  const calledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate a progress bar while waiting
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setBarFill((prev) => Math.min(prev + 1, BAR_W - 2)); // Stop just before full
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
        const result = await apiClient.sidequests.generateFearLadder({
          primaryGoal,
          goals,
          barriers,
          activities,
        });

        // Fill bar to 100% then advance
        setBarFill(BAR_W);
        if (intervalRef.current) clearInterval(intervalRef.current);

        setTimeout(() => {
          onScenariosReady(result.scenarios, result.dimensions);
        }, 400);
      } catch (err: unknown) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        console.error("[StepGeneratingLadder] Error:", err);
        setError(
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to generate your personalized assessment. Please try again.",
        );
      }
    })();
  }, [primaryGoal, goals, barriers, activities, onScenariosReady]);

  const handleRetry = () => {
    setError(null);
    setBarFill(0);
    calledRef.current = false;
    intervalRef.current = setInterval(() => {
      setBarFill((prev) => Math.min(prev + 1, BAR_W - 2));
    }, CHAR_MS);
  };

  const bar = "\u2588".repeat(barFill) + "\u2591".repeat(BAR_W - barFill);
  const pct = Math.round((barFill / BAR_W) * 100);

  return (
    <View style={s.container}>
      {onBack && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} Back</Text>
        </Pressable>
      )}

      <View style={s.content}>
        <Animated.View entering={FadeIn.duration(400)} style={s.readoutBox}>
          <View style={s.headerRow}>
            <Text style={s.headerCursor}>{"\u2588"}</Text>
            <Text style={s.headerText}>Personalizing your assessment...</Text>
          </View>

          <View style={s.goalRow}>
            <Text style={[s.goalLabel, { color: colors.text.secondary }]}>Goal:</Text>
            <Text style={s.goalValue} numberOfLines={1}>{primaryGoal}</Text>
          </View>

          <View style={s.barRow}>
            <Text style={s.barLabel}>Generating</Text>
            <Text style={[s.bar, barFill >= BAR_W && s.barDone]}>{bar}</Text>
            <Text style={[s.pct, barFill >= BAR_W && s.pctDone]}>{pct}%</Text>
          </View>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
              <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
            </View>
            <View style={s.retryWrap}>
              <NextButton label="Retry" onPress={handleRetry} />
            </View>
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
    top: 12,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: spacing.xl,
  },
  readoutBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.12)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerCursor: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: GREEN,
  },
  headerText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: GREEN,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  goalLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  goalValue: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: GREEN,
    flex: 1,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  barLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
    width: 76,
  },
  bar: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: -1,
    flex: 1,
    color: "rgba(255, 255, 255, 0.5)",
  },
  barDone: {
    color: GREEN,
  },
  pct: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.3)",
    width: 32,
    textAlign: "right",
  },
  pctDone: {
    color: GREEN,
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
  retryWrap: {
    marginTop: spacing.md,
  },
});
