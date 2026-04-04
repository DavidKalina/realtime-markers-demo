import React from "react";
import { StyleSheet, View } from "react-native";
import { GOAL_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { spacing } from "@/theme";

export function StepGoals({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  return (
    <StepLayout
      title="Your goals"
      subtitle="Pick all that apply"
      onBack={onBack}
      bottomAction={
        <NextButton onPress={onNext} disabled={selected.length === 0} />
      }
    >
      <View style={s.grid}>
        {GOAL_OPTIONS.map(({ key, label }) => (
          <OnboardingChip
            key={key}
            label={label}
            selected={selected.includes(key)}
            onPress={() => onToggle(key)}
          />
        ))}
      </View>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  grid: {
    gap: spacing.sm,
    alignSelf: "stretch",
  },
});
