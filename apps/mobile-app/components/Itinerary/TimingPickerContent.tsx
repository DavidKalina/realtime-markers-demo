import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "lucide-react-native";
import {
  DURATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
} from "@/constants/adventureOptions";
import { useColors, fontFamily, fontSize, spacing, radius, type Colors } from "@/theme";

const GREEN_ACCENT = "#86efac";
const GREEN_MUTED = "rgba(134, 239, 172, 0.12)";

interface TimingPickerContentProps {
  onConfirm: (duration: string, timeOfDay: string) => void;
}

export default function TimingPickerContent({
  onConfirm,
}: TimingPickerContentProps) {
  const colors = useColors();
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const handleDurationTap = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDuration((prev) => (prev === value ? null : value));
  }, []);

  const handleTimeTap = useCallback((value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTime((prev) => (prev === value ? null : value));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedDuration || !selectedTime) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selectedDuration, selectedTime);
  }, [selectedDuration, selectedTime, onConfirm]);

  const canConfirm = selectedDuration !== null && selectedTime !== null;

  const s = styles(colors);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>How long?</Text>
      <View style={s.optionsGrid}>
        {DURATION_OPTIONS.map((opt) => {
          const selected = selectedDuration === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[s.chip, selected && s.chipSelected]}
              onPress={() => handleDurationTap(opt.value)}
            >
              <View style={s.chipLeft}>
                <Text style={s.chipEmoji}>{opt.emoji}</Text>
                <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>
                  {opt.label}
                </Text>
              </View>
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <View style={s.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.sectionLabel, { marginTop: spacing.md }]}>When?</Text>
      <View style={s.optionsGrid}>
        {TIME_OF_DAY_OPTIONS.map((opt) => {
          const selected = selectedTime === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[s.chip, selected && s.chipSelected]}
              onPress={() => handleTimeTap(opt.value)}
            >
              <View style={s.chipLeft}>
                <Text style={s.chipEmoji}>{opt.emoji}</Text>
                <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>
                  {opt.label}
                </Text>
              </View>
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <View style={s.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Reanimated.View entering={FadeIn.duration(200)} style={s.confirmRow}>
        <Pressable
          style={[
            s.confirmButton,
            !canConfirm && s.confirmButtonDisabled,
            { marginLeft: "auto" },
          ]}
          onPress={handleConfirm}
          disabled={!canConfirm}
        >
          <ArrowRight size={20} color={GREEN_ACCENT} strokeWidth={2.5} />
        </Pressable>
      </Reanimated.View>
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
      color: colors.text.detail,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    optionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      width: "48%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chipSelected: {
      backgroundColor: GREEN_MUTED,
      borderColor: "rgba(134, 239, 172, 0.4)",
    },
    chipLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    chipEmoji: {
      fontSize: 16,
    },
    chipLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: "600",
    },
    chipLabelSelected: {
      color: GREEN_ACCENT,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: GREEN_ACCENT,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: GREEN_ACCENT,
    },
    confirmRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingTop: spacing.sm,
    },
    confirmButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(134, 239, 172, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    confirmButtonDisabled: {
      opacity: 0.3,
    },
  });
