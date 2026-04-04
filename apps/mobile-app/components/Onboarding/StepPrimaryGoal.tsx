import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { NextButton, useTypewriter } from "./shared";
import { fontFamily, fontWeight, radius, spacing, useColors, type Colors } from "@/theme";

const GREEN = "#86efac";

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

  const prompt = useTypewriter("What's your main goal?", 30, 200);
  const promptDone = prompt.length >= 22;

  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (promptDone) return;
    const interval = setInterval(() => setShowCursor((v) => !v), 500);
    return () => clearInterval(interval);
  }, [promptDone]);

  const canProceed = primaryGoal.trim().length > 0;

  return (
    <View style={s.container}>
      {onBack && (
        <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
          <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} Back</Text>
        </Pressable>
      )}

      <View style={s.content}>
        <View style={s.promptWrap}>
          <Text style={s.promptText}>
            {prompt}
            {!promptDone && showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
          </Text>
          {promptDone && (
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <Text style={[s.promptSub, { color: colors.text.secondary }]}>
                This can be anything — become a comedian, overcome social anxiety, learn to cook, run a marathon...
              </Text>
            </Animated.View>
          )}
        </View>

        {promptDone && (
          <Animated.View entering={FadeIn.delay(400).duration(400)}>
            <TextInput
              style={[s.input, { color: colors.text.primary }]}
              placeholder={"e.g. become a stand-up comedian"}
              placeholderTextColor={colors.text.disabled}
              value={primaryGoal}
              onChangeText={setPrimaryGoal}
              maxLength={500}
              autoFocus
            />
          </Animated.View>
        )}
      </View>

      <View style={s.bottom}>
        {promptDone && (
          <Animated.View entering={FadeIn.delay(600).duration(400)}>
            <NextButton onPress={onNext} disabled={!canProceed} />
          </Animated.View>
        )}
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
    gap: spacing.xl,
  },
  promptWrap: {
    gap: spacing.sm,
  },
  promptText: {
    fontFamily: fontFamily.mono,
    fontSize: 20,
    color: GREEN,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  promptSub: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  cursor: {
    fontSize: 18,
    color: GREEN,
    opacity: 0.6,
  },
  input: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    minHeight: 80,
  },
});
