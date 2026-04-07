import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
} from "@/theme";

export function StepPrimaryGoal({
  primaryGoal,
  setPrimaryGoal,
  onNext,
  onBack,
  redirectMessage,
  onClearRedirect,
}: {
  primaryGoal: string;
  setPrimaryGoal: (v: string) => void;
  onNext: () => void;
  onBack?: () => void;
  redirectMessage?: string | null;
  onClearRedirect?: () => void;
}) {
  const colors = useColors();
  const canProceed = primaryGoal.trim().length > 0;

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
                  What's your main goal?
                </Text>
                <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                  Something that gets you out into the world {"\u2014"} building
                  confidence, exploring your city, meeting people, trying new
                  things...
                </Text>
              </View>
              <HeroCard step={2} rotation={3} />
            </View>

            {redirectMessage && (
              <Animated.View entering={FadeIn.duration(300)}>
                <View style={s.redirectBox}>
                  <Text style={s.redirectText}>{redirectMessage}</Text>
                  <Pressable
                    onPress={() => {
                      setPrimaryGoal("");
                      onClearRedirect?.();
                    }}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        s.redirectDismiss,
                        { color: colors.accent.primary },
                      ]}
                    >
                      try again
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            <View
              style={[
                s.inputWrap,
                { borderColor: `rgba(${colors.accent.rgb}, 0.2)` },
              ]}
            >
              <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholder="Type your goal..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={primaryGoal}
                onChangeText={(v) => {
                  setPrimaryGoal(v);
                  if (redirectMessage) onClearRedirect?.();
                }}
                maxLength={500}
                multiline
                autoFocus
                blurOnSubmit
                returnKeyType="done"
              />
            </View>

            <View style={s.spacer} />

            <Animated.View
              entering={FadeInUp.delay(200).duration(250).springify()}
            >
              <NextButton onPress={onNext} disabled={!canProceed} />
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
    minHeight: 120,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  spacer: {
    flex: 1,
  },
  redirectBox: {
    backgroundColor: "rgba(250, 204, 21, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.25)",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  redirectText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(250, 204, 21, 0.9)",
    lineHeight: 20,
  },
  redirectDismiss: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
});
