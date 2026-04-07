import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface CalibratingCardProps {
  questsCompleted: number;
  questsNeeded: number;
  label: string;
}

const ENCOURAGEMENTS = [
  "Every quest teaches us something new about you",
  "We're learning what makes you tick",
  "Building your personalized growth map",
  "Your journey is just beginning",
];

function CalibratingCard({ questsCompleted, questsNeeded, label }: CalibratingCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const remaining = Math.max(0, questsNeeded - questsCompleted);
  const progress = Math.min(questsCompleted / questsNeeded, 1);
  const pct = Math.round(progress * 100);
  const encouragement = ENCOURAGEMENTS[questsCompleted % ENCOURAGEMENTS.length];

  return (
    <View style={s.container}>
      <Text style={s.encouragement}>{encouragement}</Text>

      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View
            style={[
              s.progressFill,
              {
                width: `${pct}%`,
                backgroundColor: colors.accent.primary,
              },
            ]}
          />
        </View>
      </View>

      <Text style={s.statusText}>
        {remaining > 0
          ? `${remaining} more quest${remaining === 1 ? "" : "s"} to unlock`
          : "Unlocking..."}
      </Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: spacing._10,
    },
    encouragement: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      opacity: 0.8,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    progressTrack: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255,255,255,0.08)",
      overflow: "hidden",
      flex: 1,
    },
    progressFill: {
      height: 3,
      borderRadius: 1.5,
    },
    statusText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      opacity: 0.5,
    },
  });

export default React.memo(CalibratingCard);
