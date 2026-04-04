import React from "react";
import { StyleSheet, View } from "react-native";
import { BARRIER_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { spacing } from "@/theme";

export function StepBarriers({
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
      title="What holds you back?"
      subtitle="No judgment — helps us calibrate"
      onBack={onBack}
      bottomAction={
        <NextButton onPress={onNext} disabled={selected.length === 0} />
      }
    >
      <View style={s.grid}>
        {BARRIER_OPTIONS.map(({ key, label }) => (
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
