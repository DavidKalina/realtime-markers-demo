import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";
const BLUE = "#93c5fd";
const BAR_WIDTH = 24;
const TYPE_SPEED = 40; // ms per character

interface PhaseHeaderProps {
  globalPhase: "bfs" | "mixed" | "dfs";
  dfsCount: number;
  totalPathways: number;
  questCount: number;
  currentStreak: number;
  totalXp: number;
}

const PHASE_CONFIG = {
  bfs: { label: "EXPLORING", color: BLUE, description: "Casting a wide net across new territory" },
  mixed: { label: "ADAPTIVE", color: GREEN, description: "Deepening grooves while still exploring" },
  dfs: { label: "DEEPENING", color: GREEN, description: "Focused on what resonates most" },
} as const;

// Typewriter hook
function useTypewriter(text: string, speed: number, delay = 0): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current++;
        if (indexRef.current >= text.length) {
          setDisplayed(text);
          clearInterval(interval);
        } else {
          setDisplayed(text.slice(0, indexRef.current));
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [text, speed, delay]);

  return displayed;
}

function PhaseHeader({
  globalPhase,
  dfsCount,
  totalPathways,
  questCount,
  currentStreak,
  totalXp,
}: PhaseHeaderProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const config = PHASE_CONFIG[globalPhase];

  const deepenPct = totalPathways > 0 ? Math.round((dfsCount / totalPathways) * 100) : 0;
  const explorePct = 100 - deepenPct;

  // Typewriter for phase label
  const fullLabel = `PHASE: ${config.label}`;
  const typedLabel = useTypewriter(fullLabel, TYPE_SPEED, 200);
  const showCursor = typedLabel.length < fullLabel.length;

  // Animate border lines drawing in
  const borderWidth = useSharedValue(0);
  useEffect(() => {
    borderWidth.value = withDelay(
      100,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
    );
  }, [borderWidth]);

  const topBorderStyle = useAnimatedStyle(() => ({
    flex: borderWidth.value,
  }));
  const bottomBorderStyle = useAnimatedStyle(() => ({
    flex: borderWidth.value,
  }));

  // Build ratio bar
  const phaseBarDelay = fullLabel.length * TYPE_SPEED + 300;
  const [barFilled, setBarFilled] = useState(0);
  const targetDeepen = Math.round((deepenPct / 100) * BAR_WIDTH);
  const targetExplore = BAR_WIDTH - targetDeepen;

  useEffect(() => {
    const timer = setTimeout(() => {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        if (count >= BAR_WIDTH) {
          setBarFilled(BAR_WIDTH);
          clearInterval(interval);
        } else {
          setBarFilled(count);
        }
      }, 20);
      return () => clearInterval(interval);
    }, phaseBarDelay);
    return () => clearTimeout(timer);
  }, [phaseBarDelay]);

  // Build the ratio bar string
  const deepenFilled = Math.min(barFilled, targetDeepen);
  const exploreFilled = Math.max(0, barFilled - targetDeepen);
  const remaining = BAR_WIDTH - barFilled;

  // Show stats after bar completes
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), phaseBarDelay + BAR_WIDTH * 20 + 200);
    return () => clearTimeout(timer);
  }, [phaseBarDelay]);

  return (
    <View style={s.container}>
      <View style={[s.box, { borderColor: `${config.color}22` }]}>
        {/* Top border */}
        <View style={s.borderRow}>
          <Text style={[s.cornerChar, { color: `${config.color}30` }]}>{"\u2554"}</Text>
          <Animated.View style={[s.borderLine, { backgroundColor: `${config.color}18` }, topBorderStyle]} />
          <Text style={[s.cornerChar, { color: `${config.color}30` }]}>{"\u2557"}</Text>
        </View>

        <View style={s.boxContent}>
          {/* Typewriter label */}
          <Text style={[s.phaseLabel, { color: config.color }]}>
            {typedLabel}
            {showCursor && <Text style={s.cursor}>{"\u2588"}</Text>}
          </Text>

          {/* Ratio bar — space always reserved */}
          <View style={s.ratioRow}>
            <Text style={[s.ratioBar, { color: GREEN }]}>
              {"\u2588".repeat(deepenFilled)}
            </Text>
            <Text style={[s.ratioBar, { color: BLUE }]}>
              {"\u2588".repeat(exploreFilled)}
            </Text>
            <Text style={[s.ratioBar, { color: "rgba(255,255,255,0.08)" }]}>
              {"\u2591".repeat(Math.max(0, remaining))}
            </Text>
          </View>

          {/* Ratio labels — space always reserved */}
          <View style={s.ratioLabels}>
            <Text style={[s.ratioText, { color: GREEN, opacity: barFilled >= BAR_WIDTH ? 1 : 0 }]}>
              {deepenPct}% DEEPEN
            </Text>
            <Text style={[s.ratioDot, { opacity: barFilled >= BAR_WIDTH ? 1 : 0 }]}>{"\u00B7"}</Text>
            <Text style={[s.ratioText, { color: BLUE, opacity: barFilled >= BAR_WIDTH ? 1 : 0 }]}>
              {explorePct}% EXPLORE
            </Text>
          </View>
        </View>

        {/* Bottom border */}
        <View style={s.borderRow}>
          <Text style={[s.cornerChar, { color: `${config.color}30` }]}>{"\u255A"}</Text>
          <Animated.View style={[s.borderLine, { backgroundColor: `${config.color}18` }, bottomBorderStyle]} />
          <Text style={[s.cornerChar, { color: `${config.color}30` }]}>{"\u255D"}</Text>
        </View>
      </View>

      {/* Stats row — always rendered, fades in */}
      <View style={[s.statsRow, { opacity: showStats ? 1 : 0 }]}>
        <Text style={s.stat}>{questCount} quests</Text>
        <Text style={s.statDot}>{"\u00B7"}</Text>
        <Text style={s.stat}>{currentStreak}w streak</Text>
        <Text style={s.statDot}>{"\u00B7"}</Text>
        <Text style={s.stat}>{totalXp.toLocaleString()} XP</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    box: {
      borderWidth: 1,
      borderRadius: 4,
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      overflow: "hidden",
    },
    borderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xs,
    },
    cornerChar: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      lineHeight: 14,
    },
    borderLine: {
      height: 1,
    },
    boxContent: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    phaseLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 20,
      fontWeight: fontWeight.bold,
      letterSpacing: 2,
    },
    cursor: {
      fontSize: 18,
      opacity: 0.6,
    },
    ratioRow: {
      flexDirection: "row",
    },
    ratioBar: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      letterSpacing: -1,
    },
    ratioLabels: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    ratioText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    ratioDot: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.2)",
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    stat: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: fontWeight.medium,
    },
    statDot: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: "rgba(255, 255, 255, 0.2)",
    },
  });

export default React.memo(PhaseHeader);
