import React from "react";
import { StyleSheet, View } from "react-native";
import { QUEST_REFLECTION_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { spacing } from "@/theme";

export function StepQuestReflection({
  selected,
  onSelect,
  onNext,
}: {
  selected: string;
  onSelect: (key: string) => void;
  onNext: () => void;
}) {
  return (
    <StepLayout
      title="You just finished your first quest"
      subtitle="How did it feel?"
      heroStep={1}
      bottomAction={
        <NextButton onPress={onNext} disabled={selected === ""} />
      }
    >
      <View style={s.list}>
        {QUEST_REFLECTION_OPTIONS.map(({ key, label }) => (
          <OnboardingChip
            key={key}
            label={label}
            selected={selected === key}
            onPress={() => onSelect(key)}
          />
        ))}
      </View>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  list: {
    gap: spacing._10,
  },
});
