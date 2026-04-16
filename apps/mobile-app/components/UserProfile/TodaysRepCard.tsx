import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Easing } from "react-native-reanimated";

import {
  CAPACITY_TRACK_LABELS,
  type SidequestResponse,
} from "@/services/api/modules/sidequests";
import { getCategoryColor } from "@/utils/categoryColors";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface Props {
  quest: SidequestResponse;
}

/**
 * Slice D — "Today's Rep" card.
 *
 * The home screen leads with THIS, not analytics. It surfaces the first
 * undone prescription with its capacity attribution, the full rep, the
 * minimum viable win, and two actions: Start (primary) and Make it
 * gentler (secondary, deep-links to the detail screen with the smaller
 * variant pre-selected).
 */
const TodaysRepCard: React.FC<Props> = ({ quest }) => {
  const colors = useColors();
  const router = useRouter();

  const accentHex = useMemo(() => {
    const key =
      quest.categories?.[0] ??
      quest.objectives?.find((o) => o.venueCategory)?.venueCategory ??
      quest.activityTypes?.[0] ??
      "common";
    return getCategoryColor(key);
  }, [quest]);

  const s = useMemo(() => createStyles(colors, accentHex), [colors, accentHex]);

  const objective = quest.objectives?.[0];
  const hasGentler = !!(objective?.smallerRep || objective?.tinyRep);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/itineraries/${quest.id}` as const);
  };

  const handleGentler = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const version = objective?.smallerRep ? "smaller" : "tiny";
    router.push({
      pathname: "/itineraries/[id]",
      params: { id: quest.id, version },
    } as never);
  };

  return (
    <Animated.View entering={FadeIn.duration(450).easing(Easing.out(Easing.cubic))} style={s.container}>
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.labelRow}>
        <View style={s.dot} />
        <Text style={s.label}>TODAY'S REP</Text>
      </Animated.View>

      {quest.capacityTrack && (
        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <Text style={s.capacityLabel}>
            BUILDING · {CAPACITY_TRACK_LABELS[quest.capacityTrack]}
          </Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text style={s.title}>{quest.title ?? "Your next rep"}</Text>
        {quest.repIntent && <Text style={s.intent}>{quest.repIntent}</Text>}
      </Animated.View>

      {objective?.description && (
        <Animated.View entering={FadeInDown.delay(260).duration(400)}>
          <Text style={s.description}>{objective.description}</Text>
        </Animated.View>
      )}

      {(objective?.minViableWin || objective?.exitRamp) && (
        <Animated.View entering={FadeInDown.delay(320).duration(400)} style={s.winBlock}>
          {objective?.minViableWin && (
            <>
              <Text style={s.winLabel}>COUNTS AS DONE</Text>
              <Text style={s.winText}>{objective.minViableWin}</Text>
            </>
          )}
          {objective?.exitRamp && (
            <View style={objective?.minViableWin ? s.exitRow : undefined}>
              <Text style={s.winLabel}>EXIT RAMP</Text>
              <Text style={s.winText}>{objective.exitRamp}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(380).duration(400)} style={s.buttonRow}>
        <Pressable
          style={({ pressed }) => [s.startButton, pressed && s.startButtonPressed]}
          onPress={handleStart}
        >
          <Text style={s.startButtonText}>Start</Text>
        </Pressable>
        {hasGentler && (
          <Pressable
            style={({ pressed }) => [s.gentlerButton, pressed && s.gentlerButtonPressed]}
            onPress={handleGentler}
          >
            <Text style={s.gentlerButtonText}>Make it gentler</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
};

export default TodaysRepCard;

const createStyles = (colors: Colors, accentHex: string) => {
  const r = parseInt(accentHex.slice(1, 3), 16);
  const g = parseInt(accentHex.slice(3, 5), 16);
  const b = parseInt(accentHex.slice(5, 7), 16);

  return StyleSheet.create({
    container: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.06)`,
      borderWidth: 1,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
      marginVertical: spacing.sm,
    },
    labelRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: accentHex,
    },
    label: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: accentHex,
      letterSpacing: 2,
    },
    capacityLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 1.2,
    },
    title: {
      fontSize: 22,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 28,
      marginTop: 6,
    },
    intent: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      fontStyle: "italic" as const,
      color: colors.text.secondary,
      lineHeight: 20,
      marginTop: 6,
    },
    description: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.primary,
      lineHeight: 22,
    },
    winBlock: {
      gap: 2,
      paddingTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
    },
    winLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
    },
    winText: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 19,
    },
    exitRow: {
      marginTop: spacing.xs,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    startButton: {
      flex: 1,
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
      paddingVertical: 14,
      alignItems: "center" as const,
      borderRadius: radius.md,
    },
    startButtonPressed: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.32)`,
    },
    startButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: accentHex,
      fontWeight: fontWeight.bold,
      textTransform: "uppercase" as const,
      letterSpacing: 1.5,
    },
    gentlerButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingVertical: 14,
      alignItems: "center" as const,
      borderRadius: radius.md,
    },
    gentlerButtonPressed: {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    gentlerButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.5,
    },
  });
};
