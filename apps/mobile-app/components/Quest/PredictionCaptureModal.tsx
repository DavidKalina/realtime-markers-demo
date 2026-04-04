import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { apiClient } from "@/services/ApiClient";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const AMBER_ACCENT = "#fbbf24";
const AMBER_MUTED = "rgba(251, 191, 36, 0.12)";

interface PredictionCaptureModalProps {
  visible: boolean;
  objectiveId: string;
  objectiveTitle: string;
  objectiveEmoji?: string;
  onDismiss: () => void;
  onComplete: () => void;
}

const ANXIETY_LABELS = ["Calm", "A little nervous", "Nervous", "Anxious", "Very anxious"];
const DIFFICULTY_LABELS = ["Easy", "Manageable", "Moderate", "Hard", "Very hard"];

function PredictionCaptureModal({
  visible,
  objectiveId,
  objectiveTitle,
  objectiveEmoji,
  onDismiss,
  onComplete,
}: PredictionCaptureModalProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [anxiety, setAnxiety] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [outcome, setOutcome] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (anxiety == null && difficulty == null && !outcome.trim()) {
      // Nothing entered — just proceed
      onComplete();
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiClient.sidequests.updateObjectivePrediction(objectiveId, {
        ...(anxiety != null && { predictedAnxiety: anxiety }),
        ...(difficulty != null && { predictedDifficulty: difficulty }),
        ...(outcome.trim() && { predictedOutcome: outcome.trim() }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (err) {
      console.error("[PredictionCapture] Failed to save:", err);
      // Proceed anyway — don't block activation on prediction save failure
      onComplete();
    } finally {
      setIsSaving(false);
    }
  }, [anxiety, difficulty, outcome, objectiveId, onComplete]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  }, [onComplete]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setAnxiety(null);
      setDifficulty(null);
      setOutcome("");
      setIsSaving(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={s.backdrop}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.keyboardAvoid}
        >
          <Animated.View
            entering={FadeInDown.duration(300).springify().damping(20)}
            style={s.card}
          >
            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerEmoji}>{objectiveEmoji ?? "\u{1F52E}"}</Text>
              <Text style={s.headerTitle} numberOfLines={2}>
                {objectiveTitle}
              </Text>
              <Text style={s.headerSubtitle}>
                Before you go — what do you expect?
              </Text>
            </View>

            {/* Anxiety slider */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>How nervous does this make you?</Text>
              <View style={s.chipRow}>
                {ANXIETY_LABELS.map((label, i) => {
                  const value = i + 1;
                  const selected = anxiety === value;
                  return (
                    <Pressable
                      key={value}
                      style={[s.chip, selected && s.chipSelected]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setAnxiety(selected ? null : value);
                      }}
                    >
                      <Text style={[s.chipText, selected && s.chipTextSelected]}>
                        {value}
                      </Text>
                      <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Difficulty slider */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>How hard do you think it'll be?</Text>
              <View style={s.chipRow}>
                {DIFFICULTY_LABELS.map((label, i) => {
                  const value = i + 1;
                  const selected = difficulty === value;
                  return (
                    <Pressable
                      key={value}
                      style={[s.chip, selected && s.chipSelected]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setDifficulty(selected ? null : value);
                      }}
                    >
                      <Text style={[s.chipText, selected && s.chipTextSelected]}>
                        {value}
                      </Text>
                      <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Optional outcome text */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>What's the worst that could happen?</Text>
              <TextInput
                style={s.textInput}
                value={outcome}
                onChangeText={setOutcome}
                placeholder="Optional — a sentence or two"
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>

            {/* Actions */}
            <View style={s.actions}>
              <Pressable
                style={({ pressed }) => [s.saveButton, pressed && s.saveButtonPressed]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={s.saveButtonText}>
                    {anxiety != null || difficulty != null || outcome.trim()
                      ? "Save & Start"
                      : "Start Quest"}
                  </Text>
                )}
              </Pressable>
              <Pressable onPress={handleSkip} style={s.skipButton}>
                <Text style={s.skipButtonText}>Skip</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    keyboardAvoid: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
    },
    card: {
      width: "90%",
      maxWidth: 400,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: AMBER_MUTED,
      padding: spacing.lg,
    },
    header: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    headerEmoji: {
      fontSize: 36,
      marginBottom: spacing.sm,
    },
    headerTitle: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      fontWeight: fontWeight.bold as "700",
      color: "#fff",
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    headerSubtitle: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: AMBER_ACCENT,
      textAlign: "center",
      letterSpacing: 0.5,
    },
    section: {
      marginBottom: spacing.md,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: "rgba(255,255,255,0.6)",
      marginBottom: spacing.sm,
      letterSpacing: 0.3,
    },
    chipRow: {
      flexDirection: "row",
      gap: 6,
    },
    chip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    chipSelected: {
      borderColor: AMBER_ACCENT,
      backgroundColor: AMBER_MUTED,
    },
    chipText: {
      fontFamily: fontFamily.mono,
      fontSize: 16,
      fontWeight: fontWeight.bold as "700",
      color: "rgba(255,255,255,0.4)",
    },
    chipTextSelected: {
      color: AMBER_ACCENT,
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      color: "rgba(255,255,255,0.25)",
      marginTop: 2,
      textAlign: "center",
    },
    chipLabelSelected: {
      color: AMBER_ACCENT,
    },
    textInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#fff",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 60,
      maxHeight: 100,
    },
    actions: {
      alignItems: "center",
      marginTop: spacing.sm,
    },
    saveButton: {
      width: "100%",
      backgroundColor: AMBER_ACCENT,
      paddingVertical: spacing.md,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    saveButtonPressed: {
      opacity: 0.85,
    },
    saveButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      fontWeight: fontWeight.bold as "700",
      color: "#000",
      letterSpacing: 0.5,
    },
    skipButton: {
      paddingVertical: spacing.md,
    },
    skipButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: "rgba(255,255,255,0.35)",
    },
  });

export default React.memo(PredictionCaptureModal);
