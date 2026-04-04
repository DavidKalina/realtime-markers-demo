import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PACE_OPTIONS } from "./constants";
import { NextButton } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";
const SPRING = { damping: 28, stiffness: 550 };

function PaceCard({
  emoji,
  label,
  desc,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    scale.value = withSequence(
      withSpring(0.95, SPRING),
      withSpring(1, SPRING),
    );
    onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        style={[s.card, active && s.cardActive]}
      >
        <Text style={s.emoji}>{emoji}</Text>
        <View style={s.textWrap}>
          <Text style={[s.label, { color: active ? GREEN_ACCENT : colors.text.primary }]}>
            {label}
          </Text>
          <Text style={[s.desc, { color: colors.text.secondary }]}>
            {desc}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function StepPace({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: string;
  onSelect: (key: string) => void;
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
      <View style={s.content}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text.primary }]}>
            Your pace
          </Text>
          <Text style={[s.subtitle, { color: colors.text.secondary }]}>
            You can always change this later
          </Text>
        </View>

        <View style={s.cards}>
          {PACE_OPTIONS.map((option) => (
            <PaceCard
              key={option.key}
              emoji={option.emoji}
              label={option.label}
              desc={option.desc}
              active={selected === option.key}
              onPress={() => onSelect(option.key)}
            />
          ))}
        </View>
      </View>

      <View style={s.bottom}>
        <NextButton onPress={onNext} disabled={!selected} />
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
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: spacing["2xl"],
  },
  header: {
    gap: spacing.sm,
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
    lineHeight: 20,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  cardActive: {
    borderColor: "rgba(134, 239, 172, 0.4)",
    backgroundColor: GREEN_MUTED,
  },
  emoji: {
    fontSize: 36,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  desc: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
});
