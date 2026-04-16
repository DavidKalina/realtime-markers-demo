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

function PendingConceptsCard() {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/concept-picker");
  };

  return (
    <Pressable
      style={({ pressed }) => [s.container, pressed && s.pressed]}
      onPress={handlePress}
    >
      <Text style={s.emoji}>{"\uD83C\uDFAF"}</Text>
      <View style={s.textWrap}>
        <Text style={s.prompt}>Pick your next quest</Text>
        <Text style={s.hint}>
          We've got a few ideas — choose the one that excites you most
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
      backgroundColor: `rgba(${colors.accent.rgb}, 0.08)`,
      borderRadius: radius.md,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: `rgba(${colors.accent.rgb}, 0.15)`,
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
      fontWeight: fontWeight.semibold,
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

export default React.memo(PendingConceptsCard);
