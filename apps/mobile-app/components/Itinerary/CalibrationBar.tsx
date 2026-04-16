import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  REJECTION_REASONS,
  type RejectionReason,
} from "@/services/api/modules/sidequests";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface Props {
  onReject: (reason: RejectionReason) => Promise<void> | void;
  disabled?: boolean;
  accentHex?: string;
}

/**
 * Calibration feedback row: lets the user push back on a prescription with a
 * structured reason. Tapping a chip triggers recalibration — the backend
 * recordsthe rejection and enqueues a fresh prescription.
 */
export const CalibrationBar: React.FC<Props> = ({ onReject, disabled, accentHex = "#7dd3fc" }) => {
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors, accentHex), [colors, accentHex]);
  const [pendingReason, setPendingReason] = useState<RejectionReason | null>(null);

  const handlePress = useCallback(
    async (reason: RejectionReason) => {
      if (disabled || pendingReason) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPendingReason(reason);
      try {
        await onReject(reason);
      } finally {
        setPendingReason(null);
      }
    },
    [disabled, pendingReason, onReject],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>DOESN'T FIT? TELL ME WHY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {REJECTION_REASONS.map(({ value, label }) => {
          const isPending = pendingReason === value;
          const isDimmed = Boolean(pendingReason) && !isPending;
          return (
            <Pressable
              key={value}
              onPress={() => handlePress(value)}
              disabled={disabled || !!pendingReason}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
                isDimmed && styles.chipDimmed,
              ]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={accentHex} />
              ) : (
                <Text style={styles.chipText}>{label}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: Colors, accentHex: string) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    label: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
    },
    chipRow: {
      gap: spacing.xs,
      paddingVertical: spacing._6,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    chipPressed: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderColor: accentHex,
    },
    chipDimmed: {
      opacity: 0.4,
    },
    chipText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
    },
  });
