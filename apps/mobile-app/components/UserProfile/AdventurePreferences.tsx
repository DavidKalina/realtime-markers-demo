import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronUp, Check } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import {
  ACTIVITY_OPTIONS,
  INTENTION_OPTIONS,
} from "@/constants/adventureOptions";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
  radius,
  duration,
  type Colors,
} from "@/theme";

const PACE_CARDS = [
  { value: "chill", emoji: "\u{1F9D8}", title: "Chill" },
  { value: "balanced", emoji: "\u{2696}\u{FE0F}", title: "Balanced" },
  { value: "send_it", emoji: "\u{1F680}", title: "Send It" },
];

const AdventurePreferences: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, refreshAuth } = useAuth();
  const profile = user?.onboardingProfile;

  const [expanded, setExpanded] = useState(false);
  const [activities, setActivities] = useState<string[]>(
    profile?.activities ?? [],
  );
  const [vibes, setVibes] = useState<string[]>(profile?.vibes ?? []);
  const [idealDay, setIdealDay] = useState(profile?.idealDay ?? "");
  const [pace, setPace] = useState(profile?.pace ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChanges = useMemo(() => {
    const orig = profile ?? { activities: [], vibes: [], idealDay: "", pace: "" };
    return (
      JSON.stringify(activities.slice().sort()) !==
        JSON.stringify((orig.activities ?? []).slice().sort()) ||
      JSON.stringify(vibes.slice().sort()) !==
        JSON.stringify((orig.vibes ?? []).slice().sort()) ||
      idealDay.trim() !== (orig.idealDay ?? "") ||
      pace !== (orig.pace ?? "")
    );
  }, [activities, vibes, idealDay, pace, profile]);

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => !prev);
  }, []);

  const toggleActivity = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivities((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }, []);

  const toggleVibe = useCallback(
    (value: string) => {
      if (!vibes.includes(value) && vibes.length >= 2) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setVibes((prev) =>
        prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value],
      );
    },
    [vibes],
  );

  const selectPace = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPace(value);
  }, []);

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    setIsSaving(true);
    try {
      await apiClient.onboarding.submitOnboardingProfile({
        activities,
        vibes,
        idealDay: idealDay.trim(),
        pace,
      });
      await refreshAuth();
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.warn("Failed to save preferences:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  }, [activities, vibes, idealDay, pace, refreshAuth]);

  // Summary of current preferences for collapsed view
  const summaryText = useMemo(() => {
    if (!profile) return "Not set";
    const parts: string[] = [];
    if (profile.activities?.length) {
      parts.push(`${profile.activities.length} activities`);
    }
    if (profile.vibes?.length) {
      const vibeLabels = profile.vibes
        .map((v) => INTENTION_OPTIONS.find((o) => o.value === v)?.label)
        .filter(Boolean);
      if (vibeLabels.length) parts.push(vibeLabels.join(", "));
    }
    if (profile.pace) {
      const paceLabel = PACE_CARDS.find((p) => p.value === profile.pace)?.title;
      if (paceLabel) parts.push(paceLabel);
    }
    return parts.join(" \u00B7 ") || "Not set";
  }, [profile]);

  const isValid = activities.length >= 3 && vibes.length >= 1 && pace !== "";

  return (
    <View>
      {/* Header row */}
      <Pressable style={styles.headerRow} onPress={toggleExpanded}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerLabel}>Adventure Preferences</Text>
          <Text style={styles.headerSummary} numberOfLines={1}>
            {summaryText}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={14} color={colors.text.secondary} />
        ) : (
          <ChevronDown size={14} color={colors.text.secondary} />
        )}
      </Pressable>

      {/* Expanded editor */}
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(duration.normal)}
          exiting={FadeOut.duration(duration.fast)}
          style={styles.editorContainer}
        >
          {/* Activities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activities</Text>
            <Text style={styles.sectionHint}>
              {activities.length}/3 minimum
            </Text>
            <View style={styles.chipGrid}>
              {ACTIVITY_OPTIONS.map((option) => {
                const isSelected = activities.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleActivity(option.value)}
                  >
                    <Text style={styles.chipEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.chipLabel,
                        isSelected && styles.chipLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Vibes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vibes</Text>
            <Text style={styles.sectionHint}>{vibes.length}/2 max</Text>
            <View style={styles.chipGrid}>
              {INTENTION_OPTIONS.map((option) => {
                const isSelected = vibes.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleVibe(option.value)}
                  >
                    <Text style={styles.chipEmoji}>{option.emoji}</Text>
                    <Text
                      style={[
                        styles.chipLabel,
                        isSelected && styles.chipLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pace */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pace</Text>
            <View style={styles.paceRow}>
              {PACE_CARDS.map((card) => {
                const isSelected = pace === card.value;
                return (
                  <Pressable
                    key={card.value}
                    style={[
                      styles.paceCard,
                      isSelected && styles.paceCardSelected,
                    ]}
                    onPress={() => selectPace(card.value)}
                  >
                    <Text style={styles.paceEmoji}>{card.emoji}</Text>
                    <Text
                      style={[
                        styles.paceLabel,
                        isSelected && styles.paceLabelSelected,
                      ]}
                    >
                      {card.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ideal Day */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ideal Day Out</Text>
            <TextInput
              style={styles.textInput}
              value={idealDay}
              onChangeText={setIdealDay}
              placeholder="Describe your perfect day out..."
              placeholderTextColor={colors.text.disabled}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{idealDay.length}/500</Text>
          </View>

          {/* Save button */}
          {hasChanges && (
            <Animated.View entering={FadeIn.duration(duration.fast)}>
              <Pressable
                style={[
                  styles.saveButton,
                  (!isValid || isSaving) && styles.saveButtonDisabled,
                ]}
                onPress={isValid && !isSaving ? handleSave : undefined}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Preferences</Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {/* Saved confirmation */}
          {saved && (
            <Animated.View
              entering={FadeIn.duration(duration.fast)}
              exiting={FadeOut.duration(duration.fast)}
              style={styles.savedRow}
            >
              <Check size={14} color={colors.status.success.text} />
              <Text style={styles.savedText}>Preferences saved</Text>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    headerTextContainer: {
      flex: 1,
      marginRight: spacing.md,
    },
    headerLabel: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
    },
    headerSummary: {
      fontSize: fontSize.xs,
      color: colors.text.disabled,
      fontFamily: fontFamily.mono,
      marginTop: 2,
    },
    editorContainer: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: spacing.xs,
    },
    sectionHint: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginBottom: spacing.sm,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.elevated,
    },
    chipSelected: {
      borderColor: colors.accent.primary,
      backgroundColor: colors.accent.muted,
    },
    chipEmoji: {
      fontSize: fontSize.sm,
    },
    chipLabel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    chipLabelSelected: {
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },
    paceRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    paceCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.elevated,
      gap: 4,
    },
    paceCardSelected: {
      borderColor: colors.accent.primary,
      backgroundColor: colors.accent.muted,
    },
    paceEmoji: {
      fontSize: 20,
    },
    paceLabel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    paceLabelSelected: {
      color: colors.accent.primary,
      fontWeight: fontWeight.semibold,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.md,
      backgroundColor: colors.bg.elevated,
      padding: spacing.md,
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: lineHeight.relaxed,
      minHeight: 80,
      maxHeight: 140,
    },
    charCount: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      textAlign: "right",
      marginTop: 4,
    },
    saveButton: {
      backgroundColor: colors.accent.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      fontFamily: fontFamily.mono,
      color: colors.text.inverse,
    },
    savedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    savedText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.status.success.text,
    },
  });

export default AdventurePreferences;
