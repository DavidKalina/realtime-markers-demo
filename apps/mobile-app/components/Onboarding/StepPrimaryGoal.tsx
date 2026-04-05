import React, { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { NextButton, useTypewriter, GREEN_ACCENT } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors, type Colors } from "@/theme";

export function StepPrimaryGoal({
  primaryGoal,
  setPrimaryGoal,
  onNext,
  onBack,
}: {
  primaryGoal: string;
  setPrimaryGoal: (v: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const colors = useColors();

  const prompt = useTypewriter("What's your main goal?", 28, 150);
  const promptDone = prompt.length >= 22;

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (promptDone) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, [promptDone]);

  const canProceed = primaryGoal.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={s.container}>
          {onBack && (
            <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
              <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
            </Pressable>
          )}

          <View style={s.content}>
            <View style={s.promptWrap}>
              <Text style={s.promptText}>
                {prompt}
                {!promptDone && showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
              </Text>
              {promptDone && (
                <Animated.View entering={FadeIn.delay(150).duration(350)}>
                  <Text style={[s.promptSub, { color: colors.text.secondary }]}>
                    This can be anything {"\u2014"} become a comedian, overcome social anxiety, learn to cook, run a marathon...
                  </Text>
                </Animated.View>
              )}
            </View>

            {promptDone && (
              <Animated.View entering={FadeIn.delay(300).duration(400)} style={s.inputWrap}>
                <Text style={s.inputPrompt}>{"\u276F"}</Text>
                <TextInput
                  style={[s.input, { color: colors.text.primary }]}
                  placeholder={"type your goal..."}
                  placeholderTextColor={"rgba(255, 255, 255, 0.2)"}
                  value={primaryGoal}
                  onChangeText={setPrimaryGoal}
                  maxLength={500}
                  multiline
                  autoFocus
                  blurOnSubmit
                  returnKeyType="done"
                />
              </Animated.View>
            )}
          </View>

          <View style={s.bottom}>
            {promptDone && (
              <Animated.View entering={FadeInUp.delay(400).duration(250).springify().damping(28).stiffness(400)}>
                <NextButton onPress={onNext} disabled={!canProceed} />
              </Animated.View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 52,
    gap: spacing.xl,
  },
  promptWrap: {
    gap: spacing._10,
  },
  promptText: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  promptSub: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.3,
    opacity: 0.6,
  },
  cursor: {
    fontSize: 20,
    color: GREEN_ACCENT,
    opacity: 0.5,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.2)",
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  inputPrompt: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: GREEN_ACCENT,
    opacity: 0.4,
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingLeft: 36,
    paddingRight: spacing.lg,
    minHeight: 120,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    minHeight: 80,
  },
});
