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
      <View style={s.centered}>
        <StepCard>
          <View style={s.topRow}>
            <Animated.View
              entering={FadeInUp.delay(200).duration(500).springify()}
              style={s.headerText}
            >
              <Text style={s.title}>You have a goal.</Text>
              <Text style={s.body}>
                We'll turn it into real-world quests tailored to your comfort
                zone.
              </Text>
              <Text style={s.hint}>
                It only takes a few minutes to get started.
              </Text>
            </Animated.View>
            <HeroCard step={1} rotation={-4} />
          </View>

          <Animated.View
            entering={FadeInDown.delay(500).duration(400).springify()}
          >
            <NextButton label="Begin" onPress={onNext} solid />
          </Animated.View>
        </StepCard>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    outer: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing["4xl"],
    },
    centered: {
      maxWidth: 440,
      alignSelf: "center",
      width: "100%",
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
      fontSize: 24,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 32,
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
  });
