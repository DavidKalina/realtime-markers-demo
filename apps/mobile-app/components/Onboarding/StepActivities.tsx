import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ACTIVITY_OPTIONS } from "./constants";
import { NextButton } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const SPRING = { damping: 28, stiffness: 550 };

function ActivityPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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
      <Pressable onPress={handlePress} style={[s.pill, selected && { borderColor: `rgba(${colors.accent.rgb}, 0.4)`, backgroundColor: colors.accent.muted }]}>
        <Text style={[s.pillText, selected && { color: colors.accent.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function StepActivities({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: string[];
  onToggle: (activity: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();

  return (
    <View style={s.container}>
      {onBack && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} Back</Text>
        </Pressable>
      )}

      <View style={s.header}>
        <Text style={[s.title, { color: colors.text.primary }]}>Your interests</Text>
        <Text style={[s.subtitle, { color: colors.text.secondary }]}>
          Pick all that appeal to you
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.wrap}>
          {ACTIVITY_OPTIONS.map((activity) => (
            <ActivityPill
              key={activity}
              label={activity}
              selected={selected.includes(activity)}
              onPress={() => onToggle(activity)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={s.bottom}>
        <NextButton onPress={onNext} disabled={selected.length === 0} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 48,
    gap: spacing.xs,
    alignItems: "center",
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
    marginTop: spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: spacing.md,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  pillText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.55)",
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
});
