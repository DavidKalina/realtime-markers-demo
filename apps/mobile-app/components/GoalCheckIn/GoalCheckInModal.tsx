import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const PARALLAX = [1.0, 0.92, 0.84, 0.78];

type Milestone = "early_momentum" | "midpoint" | "approaching" | "final_stretch" | "target_reached";

interface GoalCheckInModalProps {
  visible: boolean;
  milestone: Milestone;
  journalPrompt: string;
  goalTitle?: string;
  percentElapsed?: number;
  remainingDays?: number;
  completedQuestCount?: number;
  onDismiss: () => void;
  onComplete: (journalEntry: string) => void;
}

const MILESTONE_CONFIG: Record<Milestone, { emoji: string; title: string; subtitle: string }> = {
  early_momentum: {
    emoji: "\uD83C\uDF31",
    title: "Early check-in",
    subtitle: "You've been at this for a bit. Let's reflect.",
  },
  midpoint: {
    emoji: "\uD83C\uDFAF",
    title: "Halfway there",
    subtitle: "Look how far you've come.",
  },
  approaching: {
    emoji: "\u26A1",
    title: "Getting closer",
    subtitle: "Your target is on the horizon.",
  },
  final_stretch: {
    emoji: "\uD83C\uDFC1",
    title: "Final stretch",
    subtitle: "Almost there. How are you feeling?",
  },
  target_reached: {
    emoji: "\u2B50",
    title: "Target date reached",
    subtitle: "Time to take stock of the journey.",
  },
};

// ── Parallax widget wrapper ───────────────────────────────────────

const ParallaxWidget: React.FC<{
  scrollY: SharedValue<number>;
  index: number;
  enterDelay: number;
  children: React.ReactNode;
}> = ({ scrollY, index, enterDelay, children }) => {
  const rate = PARALLAX[index] ?? 0.7;

  const parallaxStyle = useAnimatedStyle(() => {
    const offset = scrollY.value * (1 - rate);
    return {
      transform: [{ translateY: -offset }],
    };
  });

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(400)}>
      <Animated.View style={parallaxStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};

// ── Component ─────────────────────────────────────────────────────

export function GoalCheckInModal({
  visible,
  milestone,
  journalPrompt,
  goalTitle,
  percentElapsed,
  remainingDays,
  completedQuestCount,
  onDismiss,
  onComplete,
}: GoalCheckInModalProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const scrollY = useSharedValue(0);

  const [journalText, setJournalText] = useState("");
  const [saving, setSaving] = useState(false);

  const config = MILESTONE_CONFIG[milestone];

  const reset = useCallback(() => {
    setJournalText("");
    setSaving(false);
    scrollY.value = 0;
  }, [scrollY]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const handleSave = useCallback(async () => {
    if (!journalText.trim()) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      onComplete(journalText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
    } catch (err) {
      console.error("[GoalCheckIn] Save failed:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaving(false);
    }
  }, [journalText, onComplete, reset]);

  const handleSkip = useCallback(() => {
    reset();
    onDismiss();
  }, [reset, onDismiss]);

  if (!visible) return null;

  let widgetIdx = 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={s.container}
      >
        <BlurView
          tint="dark"
          intensity={60}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Pressable style={s.closeButton} hitSlop={16} onPress={handleSkip}>
          <X size={18} color={colors.text.secondary} />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.keyboardView}
        >
          <Animated.ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Header ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={100}>
              <View style={s.headerWidget}>
                <Text style={s.headerEmoji}>{config.emoji}</Text>
                <Text style={s.headerTitle}>{config.title}</Text>
                <Text style={s.headerSub}>{config.subtitle}</Text>
              </View>
            </ParallaxWidget>

            {/* ── Goal + progress ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={200}>
              <Text style={s.widgetLabel}>YOUR GOAL</Text>
              <View style={s.goalBox}>
                {goalTitle && (
                  <Text style={s.goalText} numberOfLines={3}>
                    {"\u201C"}{goalTitle}{"\u201D"}
                  </Text>
                )}
                <View style={s.statsRow}>
                  {percentElapsed != null && (
                    <View style={s.stat}>
                      <Text style={s.statValue}>{percentElapsed}%</Text>
                      <Text style={s.statLabel}>elapsed</Text>
                    </View>
                  )}
                  {remainingDays != null && (
                    <View style={s.stat}>
                      <Text style={s.statValue}>{remainingDays}</Text>
                      <Text style={s.statLabel}>days left</Text>
                    </View>
                  )}
                  {completedQuestCount != null && (
                    <View style={s.stat}>
                      <Text style={s.statValue}>{completedQuestCount}</Text>
                      <Text style={s.statLabel}>quests done</Text>
                    </View>
                  )}
                </View>
                {percentElapsed != null && (
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, percentElapsed)}%` }]} />
                  </View>
                )}
              </View>
            </ParallaxWidget>

            {/* ── Journal ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={350}>
              <Text style={s.widgetLabel}>
                {"\u201C"}{journalPrompt}{"\u201D"}
              </Text>
              <TextInput
                style={[s.textInput, s.journalInput]}
                placeholder={"Take a moment to reflect..."}
                placeholderTextColor={colors.text.disabled}
                value={journalText}
                onChangeText={setJournalText}
                multiline
                numberOfLines={5}
                maxLength={1000}
                textAlignVertical="top"
                autoFocus
              />
            </ParallaxWidget>

            {/* ── Actions ── */}
            <ParallaxWidget scrollY={scrollY} index={widgetIdx++} enterDelay={450}>
              <Pressable
                style={[s.saveButton, (!journalText.trim() || saving) && s.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!journalText.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={s.saveButtonText}>Save reflection</Text>
                )}
              </Pressable>
              <Pressable style={s.skipButton} onPress={handleSkip} disabled={saving}>
                <Text style={s.skipButtonText}>Not right now</Text>
              </Pressable>
            </ParallaxWidget>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    closeButton: {
      position: "absolute",
      top: 56,
      right: 20,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 100,
      paddingHorizontal: 28,
      paddingBottom: 80,
      gap: spacing["2xl"],
    },

    // ── Header ──
    headerWidget: {
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerEmoji: {
      fontSize: 48,
      textShadowColor: "rgba(0, 0, 0, 0.4)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    headerTitle: {
      fontFamily: fontFamily.display,
      fontSize: 22,
      color: colors.text.primary,
      textAlign: "center",
      lineHeight: 28,
    },
    headerSub: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      textAlign: "center",
      letterSpacing: 0.5,
    },

    // ── Widget label ──
    widgetLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.sm,
      fontStyle: "italic",
    },

    // ── Goal box ──
    goalBox: {
      borderWidth: 1,
      borderColor: colors.accent.muted,
      borderRadius: radius.lg,
      backgroundColor: `rgba(${colors.accent.rgb}, 0.04)`,
      padding: spacing.lg,
      gap: spacing.md,
    },
    goalText: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      color: `rgba(${colors.accent.rgb}, 0.8)`,
      lineHeight: 22,
      fontStyle: "italic",
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.xl,
    },
    stat: {
      alignItems: "center",
      gap: 2,
    },
    statValue: {
      fontFamily: fontFamily.mono,
      fontSize: 18,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    statLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    progressTrack: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 1.5,
      backgroundColor: colors.accent.primary,
      opacity: 0.6,
    },

    // ── Text inputs ──
    textInput: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    journalInput: {
      height: 140,
      textAlignVertical: "top",
    },

    // ── Actions ──
    saveButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      width: "100%",
      alignItems: "center",
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: "#000000",
      fontWeight: fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    skipButton: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    skipButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
  });
