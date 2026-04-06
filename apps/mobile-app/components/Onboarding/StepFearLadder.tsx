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
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };
const PER_PAGE = 3;

// ── Rating button ────────────────────────────────────────

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
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <Pressable
        onPress={handlePress}
        style={[
          s.ratingBtn,
          active && {
            borderColor: `rgba(${colors.accent.rgb}, 0.5)`,
            backgroundColor: `rgba(${colors.accent.rgb}, 0.12)`,
          },
        ]}
      >
        <Text
          style={[s.ratingNum, active && { color: colors.accent.primary }]}
        >
          {value}
        </Text>
        <Text
          style={[
            s.ratingLabel,
            active && { color: `rgba(${colors.accent.rgb}, 0.7)` },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Scenario card ────────────────────────────────────────

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
      style={[
        s.scenarioCard,
        rating != null && {
          borderColor: `rgba(${colors.accent.rgb}, 0.15)`,
          backgroundColor: `rgba(${colors.accent.rgb}, 0.03)`,
        },
      ]}
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

// ── Main step ────────────────────────────────────────────

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
    <View style={s.outer}>
      <StepCard style={s.card}>
        <BackButton onPress={handlePageBack} />

        <View style={s.topRow}>
          <View style={s.headerText}>
            <Text style={[s.title, { color: colors.text.primary }]}>
              How scary would it be to...
            </Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>
              Rate honestly {"\u2014"} this calibrates your quests
            </Text>
          </View>
          <HeroCard step={7} rotation={5} />
        </View>

        {/* Page dots + counter */}
        <View style={s.progressRow}>
          <View style={s.dotsRow}>
            {Array.from({ length: totalPages }, (_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === page && {
                    width: 18,
                    borderRadius: 4,
                    backgroundColor: colors.accent.primary,
                  },
                  i < page && {
                    backgroundColor: `rgba(${colors.accent.rgb}, 0.4)`,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[s.progressCount, { color: colors.text.secondary }]}>
            {answeredCount}/{totalCount}
          </Text>
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

        <NextButton
          label={isLastPage ? "Next" : "Continue"}
          onPress={handlePageNext}
          disabled={isLastPage ? !allAnswered : !pageAllAnswered}
        />
      </StepCard>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────

const s = StyleSheet.create({
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
    opacity: 0.7,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  progressCount: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    opacity: 0.7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  scenarioCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    gap: spacing.md,
  },
  scenarioText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 21,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 6,
  },
  ratingBtn: {
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  ratingNum: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: "rgba(255, 255, 255, 0.5)",
  },
  ratingLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 7,
    color: "rgba(255, 255, 255, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
