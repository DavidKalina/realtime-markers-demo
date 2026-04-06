import React, { useCallback, useEffect, useRef, useState } from "react";
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { fontFamily, fontWeight, radius, spacing, useColors } from "@/theme";
import { apiClient } from "@/services/ApiClient";
import type { GoalRefinementState } from "@/services/api/modules/sidequests";
import { NextButton, GREEN_ACCENT } from "./shared";

type Feasibility = "actionable" | "ambitious" | "unfeasible" | "concerning";

interface Props {
  primaryGoal: string;
  onRefined: (refinedGoal: string, signals: GoalRefinementState["extractedSignals"]) => void;
  onRedirect: (message: string) => void;
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

  // ── Phase 1: Assess ───────────────────────────────────────
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const result = await apiClient.sidequests.assessGoal({ goal: primaryGoal });

        // Feasibility gate
        if (result.feasibility === "unfeasible" || result.feasibility === "concerning") {
          onRedirect(result.redirectMessage ?? "Let's try a different goal.");
          return;
        }

        // Already specific enough
        if (!result.needsRefinement && result.refinedGoal) {
          onRefined(result.refinedGoal, result.state.extractedSignals);
          return;
        }

        // Needs refinement — show first question
        setRefinementState(result.state);
        setQuestion(result.firstQuestion);
        setPhase("asking");
      } catch (err) {
        console.error("[StepGoalRefinement] Assess error:", err);
        // On error, just pass through the raw goal
        onRefined(primaryGoal, {});
      }
    })();
  }, [primaryGoal, onRefined, onRedirect]);

  // ── Phase 2: Answer questions ─────────────────────────────
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
  const turnNumber = (refinementState?.turns.length ?? 0) + 1;

  // ── Assessing state ───────────────────────────────────────
  if (phase === "assessing") {
    return (
      <View style={s.container}>
        {onBack && (
          <Pressable onPress={onBack} style={s.backButton} hitSlop={12}>
            <Text style={[s.backText, { color: colors.text.secondary }]}>{"\u2190"} back</Text>
          </Pressable>
        )}
        <View style={s.content}>
          <Animated.View entering={FadeIn.duration(400)} style={s.assessingWrap}>
            <Text style={s.assessingDot}>{"\u25CF"}</Text>
            <Text style={[s.assessingText, { color: colors.text.secondary }]}>
              Understanding your goal...
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Asking state ──────────────────────────────────────────
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
            <Animated.View entering={FadeIn.duration(300)} style={s.goalEcho}>
              <Text style={s.goalEchoLabel}>your goal</Text>
              <Text style={s.goalEchoText} numberOfLines={2}>
                {"\u201C"}{primaryGoal}{"\u201D"}
              </Text>
            </Animated.View>

            <Animated.View
              key={question}
              entering={FadeInDown.delay(150).duration(300).springify().damping(28).stiffness(400)}
              style={s.questionWrap}
            >
              <Text style={s.questionText}>{question}</Text>
              <Text style={[s.turnHint, { color: colors.text.secondary }]}>
                {turnNumber <= 2 ? `question ${turnNumber} of 3` : "last question"}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(300).duration(400)} style={s.inputWrap}>
              <Text style={s.inputPrompt}>{"\u276F"}</Text>
              <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholder="type your answer..."
                placeholderTextColor="rgba(255, 255, 255, 0.2)"
                value={answer}
                onChangeText={setAnswer}
                maxLength={1000}
                multiline
                autoFocus
                blurOnSubmit
                returnKeyType="done"
              />
            </Animated.View>

            {error && (
              <Animated.View entering={FadeIn.duration(300)}>
                <View style={[s.errorBox, { borderColor: colors.status.error.border, backgroundColor: colors.status.error.bg }]}>
                  <Text style={[s.errorText, { color: colors.status.error.text }]}>{error}</Text>
                </View>
              </Animated.View>
            )}
          </View>

          <View style={s.bottom}>
            <Animated.View entering={FadeInUp.delay(400).duration(250).springify().damping(28).stiffness(400)}>
              <NextButton
                onPress={handleSubmitAnswer}
                disabled={!canSubmit}
                label={submitting ? "Thinking..." : "Continue"}
              />
            </Animated.View>
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
    paddingHorizontal: 28,
    paddingTop: 52,
    gap: spacing.xl,
  },
  // Assessing
  assessingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 40,
  },
  assessingDot: {
    fontSize: 10,
    color: GREEN_ACCENT,
    opacity: 0.6,
  },
  assessingText: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  // Goal echo
  goalEcho: {
    gap: 6,
  },
  goalEchoLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.3)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  goalEchoText: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: "rgba(134, 239, 172, 0.6)",
    lineHeight: 20,
    fontStyle: "italic",
  },
  // Question
  questionWrap: {
    gap: spacing.sm,
  },
  questionText: {
    fontFamily: fontFamily.mono,
    fontSize: 18,
    color: GREEN_ACCENT,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
    lineHeight: 26,
  },
  turnHint: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    opacity: 0.5,
  },
  // Input
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
    minHeight: 100,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  // Error
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
  // Bottom
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    minHeight: 80,
  },
});
