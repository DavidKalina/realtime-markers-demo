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

// ── Main step ────────────────────────────────────────────

export function StepNorthStar({
  northStar,
  setNorthStar,
  userLocation,
  isLoading,
  error,
  onFinish,
  onBack,
}: {
  northStar: string;
  setNorthStar: (v: string) => void;
  userLocation: [number, number] | null;
  isLoading: boolean;
  error: string | null;
  onFinish: () => void;
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
                  What would your life look like if this worked?
                </Text>
                <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                  Paint the picture.
                </Text>
              </View>
              <HeroCard step={8} rotation={-4} />
            </View>

            {/* Text input */}
            <View
              style={[
                s.inputWrap,
                { borderColor: `rgba(${colors.accent.rgb}, 0.2)` },
              ]}
            >
              <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholder="Friday night plans I look forward to. A group chat that's active. People who know my name."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={northStar}
                onChangeText={setNorthStar}
                multiline
                maxLength={200}
                textAlignVertical="top"
                editable={!isLoading}
                blurOnSubmit
                returnKeyType="done"
              />
            </View>

            {/* Location status */}
            <View style={s.statusRow}>
              <Text style={[s.statusIcon, { color: colors.accent.primary }]}>
                {userLocation ? "\u2713" : "\u25CB"}
              </Text>
              <Text style={[s.statusText, { color: colors.text.secondary }]}>
                {userLocation ? "Location acquired" : "Acquiring location..."}
              </Text>
            </View>

            {/* Error */}
            {error && (
              <View
                style={[
                  s.errorBox,
                  {
                    borderColor: colors.status.error.border,
                    backgroundColor: colors.status.error.bg,
                  },
                ]}
              >
                <Text style={[s.errorText, { color: colors.status.error.text }]}>
                  {error}
                </Text>
              </View>
            )}

            <View style={s.spacer} />

            {/* Launch button */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(250).springify()}
            >
              {error ? (
                <NextButton label="Retry" onPress={onFinish} disabled={isLoading} />
              ) : (
                <NextButton
                  label="Launch"
                  onPress={onFinish}
                  disabled={isLoading}
                  solid
                />
              )}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusIcon: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    opacity: 0.7,
  },
  spacer: {
    flex: 1,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
  },
});
