import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { StepCard, NextButton, HeroCard } from "./shared";
import { fontFamily, fontWeight, spacing, useColors, type Colors } from "@/theme";

export function StepWelcome({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.outer}>
      <StepCard style={s.card}>
        {/* Placeholder matching BackButton height for vertical alignment with other steps */}
        <View style={s.backPlaceholder} />
        <View style={s.topRow}>
          <Animated.View
            entering={FadeInUp.delay(200).duration(500).springify()}
            style={s.headerText}
          >
            <Text style={s.title}>Building a social life is hard.</Text>
            <Text style={s.body}>
              We'll give you a plan {"\u2014"} so you can stop overthinking and
              start showing up.
            </Text>
            <Text style={s.hint}>
              A few questions so we know where you're starting from.
            </Text>
          </Animated.View>
          <HeroCard step={1} rotation={-4} />
        </View>

        <View style={s.spacer} />

        <Animated.View
          entering={FadeInDown.delay(500).duration(400).springify()}
        >
          <NextButton label="Begin" onPress={onNext} solid />
        </Animated.View>
      </StepCard>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    outer: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    card: {
      flex: 1,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.lg,
    },
    headerText: {
      flex: 1,
      gap: spacing.md,
    },
    title: {
      fontFamily: fontFamily.mono,
      fontSize: 22,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 30,
    },
    body: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      color: colors.text.primary,
      lineHeight: 24,
      opacity: 0.9,
    },
    hint: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      opacity: 0.7,
    },
    backPlaceholder: {
      height: 28,
    },
    spacer: {
      flex: 1,
    },
  });
