import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { GoalRefinementState } from "@/services/api/modules/sidequests";
import { BackButton, NextButton, StepCard, HeroCard } from "./shared";

interface Props {
  primaryGoal: string;
  onRefined: (refinedGoal: string, signals: GoalRefinementState["extractedSignals"]) => void;
  onRedirect: (message: string, suggestedGoal?: string) => void;
  onBack?: () => void;
}

export function StepGoalRefinement({ primaryGoal, onRefined, onRedirect, onBack }: Props) {
  const colors = useColors();

  const [phase, setPhase] = useState<"assessing" | "asking" | "done">("assessing");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [refinementState, setRefinementState] = useState<GoalRefinementState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const result = await apiClient.sidequests.assessGoal({ goal: primaryGoal });

        if (result.feasibility === "unfeasible" || result.feasibility === "concerning") {
          onRedirect(result.redirectMessage ?? "Let's try a different goal.");
          return;
        }

        if (result.feasibility === "out_of_scope") {
          onRedirect(
            result.reframeSuggestion ?? "This app is best at helping you get out into the world and try new things. Can you reframe your goal around that?",
            result.reframedGoal ?? undefined,
          );
          return;
        }

        if (!result.needsRefinement && result.refinedGoal) {
          onRefined(result.refinedGoal, result.state.extractedSignals);
          return;
        }

        setRefinementState(result.state);
        setQuestion(result.firstQuestion);
        setPhase("asking");
      } catch (err) {
        console.error("[StepGoalRefinement] Assess error:", err);
        onRefined(primaryGoal, {});
      }
    })();
  }, [primaryGoal, onRefined, onRedirect]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!refinementState || !answer.trim() || submitting) return;

    Keyboard.dismiss();
    setSubmitting(true);
    setError(null);

    try {
      const result = await apiClient.sidequests.refineGoal({
        state: refinementState,
        response: answer.trim(),
      });

      if (result.done && result.refinedGoal) {
        setPhase("done");
        onRefined(result.refinedGoal, result.state.extractedSignals);
      } else {
        setRefinementState(result.state);
        setQuestion(result.question);
        setAnswer("");
      }
    } catch (err) {
      console.error("[StepGoalRefinement] Refine error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [refinementState, answer, submitting, onRefined]);

  const canSubmit = answer.trim().length > 0 && !submitting;

  // ── Assessing state ───────────────────────────────────
  if (phase === "assessing") {
    return (
      <View style={s.outer}>
        <View style={s.centered}>
          <StepCard>
            {onBack && <BackButton onPress={onBack} />}
            <View style={s.topRow}>
              <Animated.View entering={FadeIn.duration(400)} style={s.loadingContent}>
                <ActivityIndicator color={colors.accent.primary} />
                <Text style={[s.loadingText, { color: colors.text.secondary }]}>
                  Understanding your goal...
                </Text>
              </Animated.View>
              <HeroCard step={3} rotation={-2} />
            </View>
          </StepCard>
        </View>
      </View>
    );
  }

  // ── Asking state ──────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.flex}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={s.outerFull}>
          <StepCard style={s.card}>
            {onBack && <BackButton onPress={onBack} />}

            <View style={s.topRow}>
              <View style={s.headerText}>
                <Animated.View entering={FadeIn.duration(300)} style={s.goalEcho}>
                  <Text style={s.goalEchoLabel}>Your goal</Text>
                  <Text
                    style={[s.goalEchoText, { color: `rgba(${colors.accent.rgb}, 0.6)` }]}
                    numberOfLines={2}
                  >
                    {"\u201C"}{primaryGoal}{"\u201D"}
                  </Text>
                </Animated.View>
              </View>
              <HeroCard step={3} rotation={-2} />
            </View>

            <Animated.View
              key={question}
              entering={FadeInDown.delay(150).duration(300).springify()}
              style={s.questionWrap}
            >
              <Text style={[s.questionText, { color: colors.text.primary }]}>
                {question}
              </Text>
              <Text style={[s.turnHint, { color: colors.text.secondary }]}>
                Just a quick question to sharpen your goal
              </Text>
            </Animated.View>

            <View style={[s.inputWrap, { borderColor: `rgba(${colors.accent.rgb}, 0.2)` }]}>
              <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholder="Type your answer..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={answer}
                onChangeText={setAnswer}
                maxLength={1000}
                multiline
                autoFocus
                blurOnSubmit
                returnKeyType="done"
              />
            </View>

            {error && (
              <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
                <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
              </View>
            )}

            <View style={s.spacer} />

            <Animated.View entering={FadeInUp.delay(300).duration(250).springify()}>
              <NextButton
                onPress={handleSubmitAnswer}
                disabled={!canSubmit}
                label={submitting ? "Thinking..." : "Continue"}
              />
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
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  centered: {
    maxWidth: 440,
    alignSelf: "center",
    width: "100%",
  },
  outerFull: {
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
  },
  loadingContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
  },
  goalEcho: {
    gap: 6,
  },
  goalEchoLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: fontWeight.medium,
  },
  goalEchoText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  questionWrap: {
    gap: spacing.sm,
  },
  questionText: {
    fontFamily: fontFamily.mono,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    lineHeight: 26,
  },
  turnHint: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    opacity: 0.7,
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
    minHeight: 100,
    lineHeight: 24,
    textAlignVertical: "top",
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
