import React, { useEffect, useMemo, useState } from "react";
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

const BLUE = "#93c5fd";

interface PhaseHeaderProps {
  globalPhase: "bfs" | "mixed" | "dfs";
  dfsCount: number;
  totalPathways: number;
  questCount: number;
  currentStreak: number;
}

const PHASE_CONFIG: Record<string, { label: string; accentKey: "accent" | "blue"; description: string }> = {
  bfs: { label: "EXPLORING", accentKey: "blue", description: "Casting a wide net across new territory" },
  mixed: { label: "ADAPTIVE", accentKey: "accent", description: "Deepening grooves while still exploring" },
  dfs: { label: "DEEPENING", accentKey: "accent", description: "Focused on what resonates most" },
};

function PhaseHeader({
  globalPhase,
  dfsCount,
  totalPathways,
  questCount,
  currentStreak,
}: PhaseHeaderProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const rawConfig = PHASE_CONFIG[globalPhase];
  const configColor = rawConfig.accentKey === "accent" ? colors.accent.primary : BLUE;

  const deepenPct = totalPathways > 0 ? Math.round((dfsCount / totalPathways) * 100) : 0;
  const explorePct = 100 - deepenPct;

  const fullLabel = `Phase: ${rawConfig.label}`;

  // Animate bar fill
  const barProgress = useSharedValue(0);
  useEffect(() => {
    barProgress.value = 0;
    barProgress.value = withDelay(
      300,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [barProgress, deepenPct]);

  const deepenBarStyle = useAnimatedStyle(() => ({
    width: `${deepenPct * barProgress.value}%`,
  }));
  const exploreBarStyle = useAnimatedStyle(() => ({
    width: `${explorePct * barProgress.value}%`,
  }));

  // Show stats after bar completes
  const [showStats, setShowStats] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Show ratio labels after bar
  const [showLabels, setShowLabels] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowLabels(true), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.container}>
      <View style={[s.box, { borderColor: `${configColor}40` }]}>
        <View style={s.boxContent}>
          {/* Phase label */}
          <Text style={[s.phaseLabel, { color: configColor }]}>
            {fullLabel}
          </Text>

          {/* Ratio bar — View-based */}
          <View style={s.ratioBarTrack}>
            <Animated.View style={[s.ratioBarFill, { backgroundColor: colors.accent.primary }, deepenBarStyle]} />
            <Animated.View style={[s.ratioBarFill, { backgroundColor: BLUE }, exploreBarStyle]} />
          </View>

          {/* Ratio labels */}
          <View style={[s.ratioLabels, { opacity: showLabels ? 1 : 0 }]}>
            <Text style={[s.ratioText, { color: colors.accent.primary }]}>
              {deepenPct}% Deepen
            </Text>
            <Text style={s.ratioDot}>{"\u00B7"}</Text>
            <Text style={[s.ratioText, { color: BLUE }]}>
              {explorePct}% Explore
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row — always rendered, fades in */}
      <View style={[s.statsRow, { opacity: showStats ? 1 : 0 }]}>
        <Text style={s.stat}>{questCount} reps</Text>
        <Text style={s.statDot}>{"\u00B7"}</Text>
        <Text style={s.stat}>{currentStreak}w rhythm</Text>
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
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      overflow: "hidden",
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
      letterSpacing: 0.5,
    },
    ratioBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
      flexDirection: "row",
    },
    ratioBarFill: {
      height: 4,
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
      letterSpacing: 0.5,
    },
    ratioDot: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.3)",
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
      color: "rgba(255, 255, 255, 0.3)",
    },
  });

export default React.memo(PhaseHeader);
