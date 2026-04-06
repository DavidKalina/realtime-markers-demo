import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BARRIER_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { spacing } from "@/theme";

export function StepBarriers({
  selected,
  onToggle,
  onNext,
  onBack,
  options,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  onNext: () => void;
  onBack?: () => void;
  options?: { key: string; label: string; text: string }[];
}) {
  const barrierOptions = options ?? BARRIER_OPTIONS;
  return (
    <StepLayout
      title="What holds you back?"
      subtitle="Select all that apply \u2014 this calibrates your quest difficulty"
      onBack={onBack}
      bottomAction={
        <NextButton onPress={onNext} disabled={selected.length === 0} />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {barrierOptions.map(({ key, label }) => (
          <OnboardingChip
            key={key}
            label={label}
            selected={selected.includes(key)}
            onPress={() => onToggle(key)}
          />
        ))}
      </ScrollView>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  scroll: {
    alignSelf: "stretch",
    maxHeight: 400,
  },
  grid: {
    gap: spacing._10,
  },
});
