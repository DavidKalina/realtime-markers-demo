import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
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
import { NextButton, GREEN_ACCENT, GREEN_MUTED } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };
const PER_PAGE = 3;

// ── Rating button ─────────────────────────────────────────

function RatingButton({
  value,
  label,
  active,
  onPress,
}: {
  value: number;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
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
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <Pressable
        onPress={handlePress}
        style={[s.ratingBtn, active && s.ratingBtnActive]}
      >
        <Text style={[s.ratingNum, active && s.ratingNumActive]}>
          {value}
        </Text>
        <Text style={[s.ratingLabel, active && s.ratingLabelActive]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Scenario card ─────────────────────────────────────────

function ScenarioCard({
  scenario,
  rating,
  onRate,
  index,
}: {
  scenario: { id: string; text: string; dimension: string };
  rating: number | undefined;
  onRate: (scenarioId: string, value: number) => void;
  index: number;
}) {
  const colors = useColors();

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(250)}
      style={[s.scenarioCard, rating != null && s.scenarioCardAnswered]}
    >
      <Text style={[s.scenarioText, { color: colors.text.primary }]}>
        {scenario.text}
      </Text>
      <View style={s.ratingRow}>
        {[1, 2, 3, 4, 5].map((v) => (
          <RatingButton
            key={v}
            value={v}
            label={FEAR_RATING_LABELS[v - 1]}
            active={rating === v}
            onPress={() => onRate(scenario.id, v)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ── Main step ─────────────────────────────────────────────

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
  const totalCount = scenarioList.length;
  const answeredCount = Object.keys(responses).length;

  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const pageScenarios = useMemo(
    () => scenarioList.slice(page * PER_PAGE, (page + 1) * PER_PAGE),
    [scenarioList, page],
  );

  const pageAllAnswered = pageScenarios.every((sc) => responses[sc.id] != null);
  const isLastPage = page === totalPages - 1;
  const allAnswered = answeredCount === totalCount;

  const handlePageNext = useCallback(() => {
    if (isLastPage) {
      onNext();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPage((p) => p + 1);
    }
  }, [isLastPage, onNext]);

  const handlePageBack = useCallback(() => {
    if (page === 0) {
      onBack?.();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPage((p) => p - 1);
    }
  }, [page, onBack]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerWrap}>
        <Pressable onPress={handlePageBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>
            {"\u2190"} back
          </Text>
        </Pressable>

        <Text style={[s.title, { color: colors.text.primary }]}>
          How scary would it be to...
        </Text>
        <Text style={[s.subtitle, { color: colors.text.secondary }]}>
          Rate honestly {"\u2014"} this calibrates your quests
        </Text>

        {/* Horizontal page dots + counter */}
        <View style={s.progressRow}>
          <View style={s.dotsRow}>
            {Array.from({ length: totalPages }, (_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === page && s.dotCurrent,
                  i < page && s.dotDone,
                ]}
              />
            ))}
          </View>
          <Text style={[s.progressCount, { color: colors.text.secondary }]}>
            {answeredCount}/{totalCount}
          </Text>
        </View>
      </View>

      {/* Cards */}
      <ScrollView
        key={page}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {pageScenarios.map((scenario, i) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            rating={responses[scenario.id]}
            onRate={onRate}
            index={i}
          />
        ))}
      </ScrollView>

      {/* Bottom */}
      <View style={s.bottom}>
        <NextButton
          label={isLastPage ? "Next" : "Continue"}
          onPress={handlePageNext}
          disabled={isLastPage ? !allAnswered : !pageAllAnswered}
        />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    paddingTop: 8,
    paddingHorizontal: 28,
    gap: 6,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 8,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
    opacity: 0.5,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  dotCurrent: {
    width: 18,
    borderRadius: 3,
    backgroundColor: GREEN_ACCENT,
  },
  dotDone: {
    backgroundColor: "rgba(134, 239, 172, 0.4)",
  },
  progressCount: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    gap: spacing.md,
  },
  scenarioCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    gap: spacing.md,
  },
  scenarioCardAnswered: {
    borderColor: "rgba(134, 239, 172, 0.15)",
    backgroundColor: "rgba(134, 239, 172, 0.03)",
  },
  scenarioText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 6,
  },
  ratingBtn: {
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  ratingBtnActive: {
    borderColor: "rgba(134, 239, 172, 0.5)",
    backgroundColor: "rgba(134, 239, 172, 0.12)",
  },
  ratingNum: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: "rgba(255, 255, 255, 0.35)",
  },
  ratingNumActive: {
    color: GREEN_ACCENT,
  },
  ratingLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 7,
    color: "rgba(255, 255, 255, 0.2)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  ratingLabelActive: {
    color: "rgba(134, 239, 172, 0.7)",
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 44,
  },
});
