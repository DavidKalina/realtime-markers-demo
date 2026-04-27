import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  GENDER_OPTIONS,
  TIME_IN_AREA_OPTIONS,
  WORK_SITUATION_OPTIONS,
  LIVING_SITUATION_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from "./constants";
import { StepLayout, NextButton } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };

export interface AboutYou {
  gender: string;
  timeInArea: string;
  workSituation: string;
  livingSituation: string;
  lookingFor: string[];
}

function Chip({
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
      <Pressable
        onPress={handlePress}
        style={[
          s.chip,
          selected && {
            borderColor: `rgba(${colors.accent.rgb}, 0.4)`,
            backgroundColor: `rgba(${colors.accent.rgb}, 0.08)`,
          },
        ]}
      >
        <Text style={[s.chipText, selected && { color: colors.accent.primary }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function SingleChipRow({
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
        {options.map(({ key, label: chipLabel }) => (
          <Chip
            key={key}
            label={chipLabel}
            selected={selected === key}
            onPress={() => onSelect(key)}
          />
        ))}
      </View>
    </View>
  );
}

function MultiChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={s.chipGroup}>
      <Text style={[s.groupLabel, { color: colors.text.secondary }]}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(({ key, label: chipLabel }) => (
          <Chip
            key={key}
            label={chipLabel}
            selected={selected.includes(key)}
            onPress={() => onToggle(key)}
          />
        ))}
      </View>
    </View>
  );
}

export function StepAboutYou({
  details,
  onUpdate,
  onToggleLookingFor,
  onNext,
  onBack,
  loading,
}: {
  details: AboutYou;
  onUpdate: (field: Exclude<keyof AboutYou, "lookingFor">, value: string) => void;
  onToggleLookingFor: (key: string) => void;
  onNext: () => void;
  onBack?: () => void;
  loading?: boolean;
}) {
  const canProceed =
    details.gender !== "" &&
    details.timeInArea !== "" &&
    details.workSituation !== "" &&
    details.livingSituation !== "" &&
    details.lookingFor.length > 0;

  return (
    <StepLayout
      title="A bit more about you"
      subtitle="So the AI can prescribe quests that fit your life"
      onBack={onBack}
      heroStep={6}
      bottomAction={
        <NextButton
          label={loading ? "Generating ideas..." : "Finish"}
          onPress={onNext}
          disabled={!canProceed || loading}
        />
      }
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SingleChipRow
          label="Gender"
          options={GENDER_OPTIONS}
          selected={details.gender}
          onSelect={(v) => onUpdate("gender", v)}
        />
        <SingleChipRow
          label="Time in this area"
          options={TIME_IN_AREA_OPTIONS}
          selected={details.timeInArea}
          onSelect={(v) => onUpdate("timeInArea", v)}
        />
        <SingleChipRow
          label="Work"
          options={WORK_SITUATION_OPTIONS}
          selected={details.workSituation}
          onSelect={(v) => onUpdate("workSituation", v)}
        />
        <SingleChipRow
          label="Living"
          options={LIVING_SITUATION_OPTIONS}
          selected={details.livingSituation}
          onSelect={(v) => onUpdate("livingSituation", v)}
        />
        <MultiChipRow
          label="Looking for (pick any that fit)"
          options={LOOKING_FOR_OPTIONS}
          selected={details.lookingFor}
          onToggle={onToggleLookingFor}
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
    borderRadius: radius.full,
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
