import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";

export function StepComfortZone({
  comfortZone,
  setComfortZone,
  onNext,
  onBack,
}: {
  comfortZone: string;
  setComfortZone: (v: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.flex}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={s.outer}>
          <StepCard style={s.card}>
            {onBack && <BackButton onPress={onBack} />}

            <View style={s.topRow}>
              <View style={s.headerText}>
                <Text style={[s.title, { color: colors.text.primary }]}>
                  What does a typical day look like?
                </Text>
                <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                  Optional {"\u2014"} helps us meet you where you are
                </Text>
              </View>
              <HeroCard step={8} rotation={3} />
            </View>

            <View
              style={[
                s.inputWrap,
                { borderColor: `rgba(${colors.accent.rgb}, 0.2)` },
              ]}
            >
              <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholder="I work from home, go to the same coffee shop on weekends..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={comfortZone}
                onChangeText={setComfortZone}
                multiline
                maxLength={300}
                textAlignVertical="top"
                blurOnSubmit
                returnKeyType="done"
              />
            </View>

            <View style={s.spacer} />

            <Animated.View
              entering={FadeInUp.delay(200).duration(250).springify()}
            >
              <NextButton onPress={onNext} />
            </Animated.View>
          </StepCard>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 110,
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
  },
});
