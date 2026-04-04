import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  FEAR_LADDER_SCENARIOS,
  FEAR_RATING_LABELS,
} from "./constants";
import { NextButton } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";
const SPRING = { damping: 20, stiffness: 400 };

// ── Rating button row ──────────────────────────────────────

function RatingButton({
  value,
  active,
  onPress,
}: {
  value: number;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSequence(
      withSpring(0.85, SPRING),
      withSpring(1, SPRING),
    );
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        style={[s.ratingBtn, active && s.ratingBtnActive]}
      >
        <Text
          style={[
            s.ratingNum,
            { color: active ? GREEN_ACCENT : colors.text.secondary },
          ]}
        >
          {value}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Scenario row ───────────────────────────────────────────

function ScenarioRow({
  scenario,
  rating,
  onRate,
}: {
  scenario: { id: string; text: string; dimension: string };
  rating: number | undefined;
  onRate: (scenarioId: string, value: number) => void;
}) {
  const colors = useColors();

  return (
    <View style={s.scenarioCard}>
      <Text style={[s.scenarioText, { color: colors.text.primary }]}>
        {scenario.text}
      </Text>
      <View style={s.ratingRow}>
        {[1, 2, 3, 4, 5].map((v) => (
          <RatingButton
            key={v}
            value={v}
            active={rating === v}
            onPress={() => onRate(scenario.id, v)}
          />
        ))}
      </View>
      {rating != null && (
        <Text style={[s.ratingLabel, { color: colors.text.secondary }]}>
          {FEAR_RATING_LABELS[rating - 1]}
        </Text>
      )}
    </View>
  );
}

// ── Main step ──────────────────────────────────────────────

export function StepFearLadder({
  scenarios,
  responses,
  onRate,
  onNext,
  onBack,
}: {
  scenarios?: { id: string; text: string; dimension: string }[];
  responses: Record<string, number>;
  onRate: (scenarioId: string, value: number) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const scenarioList = scenarios ?? FEAR_LADDER_SCENARIOS;
  const answeredCount = Object.keys(responses).length;
  const totalCount = scenarioList.length;
  const allAnswered = answeredCount === totalCount;

  return (
    <View style={s.container}>
      {onBack && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>
            {"\u2190"} Back
          </Text>
        </Pressable>
      )}

      <View style={s.headerWrap}>
        <Text style={[s.title, { color: colors.text.primary }]}>
          How scary would it be to...
        </Text>
        <Text style={[s.subtitle, { color: colors.text.secondary }]}>
          Rate each scenario honestly — this calibrates your quests
        </Text>
        <Text style={[s.progress, { color: colors.text.secondary }]}>
          {answeredCount}/{totalCount} answered
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {scenarioList.map((scenario) => (
          <ScenarioRow
            key={scenario.id}
            scenario={scenario}
            rating={responses[scenario.id]}
            onRate={onRate}
          />
        ))}
      </ScrollView>

      <View style={s.bottom}>
        <NextButton onPress={onNext} disabled={!allAnswered} />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

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
  headerWrap: {
    paddingTop: 52,
    paddingHorizontal: 28,
    gap: spacing.sm,
    alignItems: "center",
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  progress: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 20,
    gap: spacing.md,
  },
  scenarioCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    gap: spacing.sm,
  },
  scenarioText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  ratingRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 4,
  },
  ratingBtn: {
    width: 40,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBtnActive: {
    borderColor: "rgba(134, 239, 172, 0.4)",
    backgroundColor: GREEN_MUTED,
  },
  ratingNum: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  ratingLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
});
