import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";

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
  const barWidth = 20;
  const filled = Math.round(progress * barWidth);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);

  // Blinking cursor
  const cursorOpacity = useSharedValue(1);
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 1 }),
        withTiming(0, { duration: 600 }),
        withTiming(1, { duration: 1 }),
      ),
      -1,
    );
  }, [cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Typewriter effect for the status text
  const statusText = remaining > 0
    ? `${remaining} more quest${remaining === 1 ? "" : "s"} to unlock`
    : "Unlocking...";

  const [typed, setTyped] = useState("");
  const indexRef = useRef(0);
  useEffect(() => {
    setTyped("");
    indexRef.current = 0;
    const timer = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= statusText.length) {
        setTyped(statusText);
        clearInterval(timer);
      } else {
        setTyped(statusText.slice(0, indexRef.current));
      }
    }, 40);
    return () => clearInterval(timer);
  }, [statusText]);

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.label}>{label}</Text>
        <View style={s.statusRow}>
          <Animated.Text style={[s.cursor, cursorStyle]}>{"\u2588"}</Animated.Text>
          <Text style={s.calibrating}>CALIBRATING</Text>
        </View>
      </View>

      <Text style={s.description}>
        Learning your patterns...
      </Text>

      <View style={s.progressRow}>
        <Text style={s.progressBar}>[{bar}]</Text>
        <Text style={s.progressCount}>{questsCompleted}/{questsNeeded}</Text>
      </View>

      <Text style={s.hint}>{typed}</Text>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
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
      letterSpacing: 1.5,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    cursor: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      color: GREEN,
    },
    calibrating: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: GREEN,
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
    progressBar: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.15)",
      letterSpacing: -1,
      flex: 1,
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
