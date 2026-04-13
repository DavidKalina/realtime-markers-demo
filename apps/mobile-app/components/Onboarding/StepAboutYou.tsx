import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AGE_RANGE_OPTIONS,
  GENDER_OPTIONS,
  TIME_IN_AREA_OPTIONS,
  WORK_OPTIONS,
  LIVING_OPTIONS,
  ROUTINE_OPTIONS,
  TRANSPORT_OPTIONS,
  BUDGET_OPTIONS,
} from "./constants";
import { StepLayout, NextButton } from "./shared";
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

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const colors = useColors();

  return (
    <View style={s.chipGroup}>
      <Text style={[s.groupLabel, { color: colors.text.secondary }]}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(({ key, label: chipLabel }) => {
          const isSelected = selected === key;
          return (
            <ChipButton
              key={key}
              label={chipLabel}
              selected={isSelected}
              onPress={() => onSelect(key)}
            />
          );
        })}
      </View>
    </View>
  );
}

function ChipButton({
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

export interface SocialSituation {
  ageRange: string;
  gender: string;
  timeInArea: string;
  workSituation: string;
  livingSituation: string;
  dailyRoutine?: string;
  transportation?: string;
  budget?: string;
}

export function StepAboutYou({
  situation,
  onUpdate,
  onNext,
  onBack,
}: {
  situation: SocialSituation;
  onUpdate: (field: keyof SocialSituation, value: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const canProceed =
    situation.ageRange !== "" &&
    situation.gender !== "" &&
    situation.timeInArea !== "" &&
    situation.workSituation !== "" &&
    situation.livingSituation !== "";

  return (
    <StepLayout
      title="A little about you"
      subtitle="Helps us tailor everything"
      onBack={onBack}
      heroStep={2}
      bottomAction={
        <NextButton onPress={onNext} disabled={!canProceed} />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ChipRow
          label="Age"
          options={AGE_RANGE_OPTIONS}
          selected={situation.ageRange}
          onSelect={(v) => onUpdate("ageRange", v)}
        />
        <ChipRow
          label="Gender"
          options={GENDER_OPTIONS}
          selected={situation.gender}
          onSelect={(v) => onUpdate("gender", v)}
        />
        <ChipRow
          label="How long in this area?"
          options={TIME_IN_AREA_OPTIONS}
          selected={situation.timeInArea}
          onSelect={(v) => onUpdate("timeInArea", v)}
        />
        <ChipRow
          label="Work"
          options={WORK_OPTIONS}
          selected={situation.workSituation}
          onSelect={(v) => onUpdate("workSituation", v)}
        />
        <ChipRow
          label="Living"
          options={LIVING_OPTIONS}
          selected={situation.livingSituation}
          onSelect={(v) => onUpdate("livingSituation", v)}
        />
        <ChipRow
          label="Schedule"
          options={ROUTINE_OPTIONS}
          selected={situation.dailyRoutine ?? ""}
          onSelect={(v) => onUpdate("dailyRoutine", v)}
        />
        <ChipRow
          label="Getting around"
          options={TRANSPORT_OPTIONS}
          selected={situation.transportation ?? ""}
          onSelect={(v) => onUpdate("transportation", v)}
        />
        <ChipRow
          label="Quest budget"
          options={BUDGET_OPTIONS}
          selected={situation.budget ?? ""}
          onSelect={(v) => onUpdate("budget", v)}
        />
      </ScrollView>
    </StepLayout>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: spacing.md,
  },
  chipGroup: {
    gap: 8,
  },
  groupLabel: {
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
