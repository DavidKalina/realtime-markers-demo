import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CURRENT_SOCIAL_OPTIONS,
  LOOKING_FOR_OPTIONS,
  GOAL_OPTIONS,
} from "./constants";
import { StepLayout, OnboardingChip, NextButton } from "./shared";
import { fontFamily, fontWeight, spacing, useColors } from "@/theme";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { radius as themeRadius } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };

function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSequence(withSpring(0.93, SPRING), withSpring(1, SPRING));
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <View
        style={[
          s.chip,
          selected && {
            borderColor: `rgba(${colors.accent.rgb}, 0.4)`,
            backgroundColor: colors.accent.muted,
          },
        ]}
      >
        <Text
          style={[s.chipText, selected && { color: colors.accent.primary }]}
          onPress={handlePress}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

export function StepSocialLife({
  currentLevel,
  lookingFor,
  selectedGoal,
  onSetLevel,
  onToggleLookingFor,
  onSetGoal,
  onNext,
  onBack,
}: {
  currentLevel: string;
  lookingFor: string[];
  selectedGoal: string;
  onSetLevel: (level: string) => void;
  onToggleLookingFor: (key: string) => void;
  onSetGoal: (key: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();
  const canProceed = currentLevel !== "" && lookingFor.length > 0;

  return (
    <StepLayout
      title="Where you're at socially"
      subtitle="No judgment — just so we know"
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
        {/* Current social life level */}
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

        {/* Looking for */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.text.secondary }]}>
            What are you looking for?
          </Text>
          <View style={s.chipRow}>
            {LOOKING_FOR_OPTIONS.map(({ key, label }) => (
              <SelectChip
                key={key}
                label={label}
                selected={lookingFor.includes(key)}
                onPress={() => onToggleLookingFor(key)}
              />
            ))}
          </View>
        </View>

        {/* Goal framing */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.text.secondary }]}>
            Pick the one that fits
          </Text>
          {GOAL_OPTIONS.map(({ key, label }) => (
            <OnboardingChip
              key={key}
              label={label}
              selected={selectedGoal === key}
              onPress={() => onSetGoal(key)}
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: themeRadius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  chipText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.55)",
  },
});
