import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CURRENT_SOCIAL_OPTIONS } from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { fontFamily, fontWeight, spacing, useColors } from "@/theme";

export function StepSocialLife({
  currentLevel,
  onSetLevel,
  onNext,
  onBack,
  title,
  subtitle,
}: {
  currentLevel: string;
  onSetLevel: (level: string) => void;
  onNext: () => void;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}) {
  const colors = useColors();
  const canProceed = currentLevel !== "";

  return (
    <StepLayout
      title={title ?? "Where you're at socially"}
      subtitle={subtitle ?? "No judgment \u2014 just so we know"}
      onBack={onBack}
      heroStep={3}
      bottomAction={
        <NextButton onPress={onNext} disabled={!canProceed} />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.text.secondary }]}>
            Your social life right now
          </Text>
          {CURRENT_SOCIAL_OPTIONS.map(({ key, label }) => (
            <OnboardingChip
              key={key}
              label={label}
              selected={currentLevel === key}
              onPress={() => onSetLevel(key)}
            />
          ))}
        </View>
      </ScrollView>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 24,
    paddingBottom: spacing.md,
  },
  section: {
    gap: spacing._10,
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
