import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { GOAL_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { spacing } from "@/theme";

export function StepGoal({
  selectedGoal,
  onSetGoal,
  onNext,
  onBack,
}: {
  selectedGoal: string;
  onSetGoal: (key: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  return (
    <StepLayout
      title="What brings you here?"
      subtitle="Pick the one that fits best"
      onBack={onBack}
      heroStep={2}
      bottomAction={
        <NextButton onPress={onNext} disabled={selectedGoal === ""} />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {GOAL_OPTIONS.map(({ key, label }) => (
          <OnboardingChip
            key={key}
            label={label}
            selected={selectedGoal === key}
            onPress={() => onSetGoal(key)}
          />
        ))}
      </ScrollView>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: spacing.md,
  },
});
