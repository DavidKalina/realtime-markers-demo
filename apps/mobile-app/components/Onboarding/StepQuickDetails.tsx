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
  AGE_RANGE_OPTIONS,
  ROUTINE_OPTIONS,
  TRANSPORT_OPTIONS,
  BUDGET_OPTIONS,
} from "./constants";
import { StepLayout, NextButton } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };

export interface QuickDetails {
  ageRange: string;
  dailyRoutine: string;
  transportation: string;
  budget: string;
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

export function StepQuickDetails({
  details,
  onUpdate,
  onNext,
  onBack,
}: {
  details: QuickDetails;
  onUpdate: (field: keyof QuickDetails, value: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const canProceed =
    details.ageRange !== "" &&
    details.dailyRoutine !== "" &&
    details.transportation !== "" &&
    details.budget !== "";

  return (
    <StepLayout
      title="A few practical details"
      subtitle="Helps us pick the right first quest"
      onBack={onBack}
      heroStep={5}
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
          selected={details.ageRange}
          onSelect={(v) => onUpdate("ageRange", v)}
        />
        <ChipRow
          label="Schedule"
          options={ROUTINE_OPTIONS}
          selected={details.dailyRoutine}
          onSelect={(v) => onUpdate("dailyRoutine", v)}
        />
        <ChipRow
          label="Getting around"
          options={TRANSPORT_OPTIONS}
          selected={details.transportation}
          onSelect={(v) => onUpdate("transportation", v)}
        />
        <ChipRow
          label="Quest budget"
          options={BUDGET_OPTIONS}
          selected={details.budget}
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
