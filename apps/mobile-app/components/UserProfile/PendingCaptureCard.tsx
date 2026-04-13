import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import type { SidequestResponse } from "@/services/api/modules/sidequests";

interface PendingCaptureCardProps {
  quest: SidequestResponse;
}

function PendingCaptureCard({ quest }: PendingCaptureCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const firstObjective = quest.objectives?.[0];
  const venueName = firstObjective?.venueName;
  const emoji = firstObjective?.emoji || "\uD83D\uDCDD";

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${quest.id}`);
  };

  return (
    <Pressable
      style={({ pressed }) => [s.container, pressed && s.pressed]}
      onPress={handlePress}
    >
      <Text style={s.emoji}>{emoji}</Text>
      <View style={s.textWrap}>
        <Text style={s.prompt} numberOfLines={2}>
          You visited {venueName || "a new spot"} — tell us how it went
        </Text>
        <Text style={s.hint}>
          Your reflection helps us find better quests for you
        </Text>
      </View>
      <Text style={s.arrow}>{"\u203A"}</Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "rgba(52, 211, 153, 0.08)",
      borderRadius: radius.md,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: "rgba(52, 211, 153, 0.15)",
    },
    pressed: {
      opacity: 0.7,
    },
    emoji: {
      fontSize: 22,
    },
    textWrap: {
      flex: 1,
      gap: spacing.xs,
    },
    prompt: {
      fontFamily: fontFamily.mono,
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    hint: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      opacity: 0.6,
    },
    arrow: {
      fontSize: 22,
      color: colors.text.secondary,
      opacity: 0.4,
    },
  });

export default React.memo(PendingCaptureCard);
