import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface CalibratingCardProps {
  questsCompleted: number;
  questsNeeded: number;
  label: string;
}

function CalibratingCard({ questsCompleted, questsNeeded, label }: CalibratingCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const remaining = Math.max(0, questsNeeded - questsCompleted);
  const progress = Math.min(questsCompleted / questsNeeded, 1);
  const pct = Math.round(progress * 100);

  const statusText = remaining > 0
    ? `${remaining} more quest${remaining === 1 ? "" : "s"} to unlock`
    : "Unlocking...";

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.label}>{label}</Text>
        <View style={s.statusRow}>
          <Text style={s.calibrating}>Calibrating</Text>
        </View>
      </View>

      <Text style={s.description}>
        Learning your patterns...
      </Text>

      <View style={s.progressRow}>
        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: `${pct}%`, backgroundColor: colors.accent.primary }]} />
        </View>
        <Text style={s.progressCount}>{questsCompleted}/{questsNeeded}</Text>
      </View>

      <Text style={s.hint}>{statusText}</Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    calibrating: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
      letterSpacing: 1,
    },
    description: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      fontStyle: "italic",
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    progressBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
      flex: 1,
    },
    progressBarFill: {
      height: 4,
      borderRadius: 2,
    },
    progressCount: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
    },
    hint: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
    },
  });

export default React.memo(CalibratingCard);
