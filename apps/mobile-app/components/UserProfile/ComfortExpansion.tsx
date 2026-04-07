import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const INITIAL_RADIUS = 0.5; // DEFAULT_COMFORT_RADIUS_MILES

interface ComfortExpansionProps {
  currentRadiusMiles: number | null;
}

function ComfortExpansion({ currentRadiusMiles }: ComfortExpansionProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const radius = Number(currentRadiusMiles);
  if (!radius || radius <= 0 || isNaN(radius)) return null;

  const pct = Math.round(((radius - INITIAL_RADIUS) / INITIAL_RADIUS) * 100);
  const ratio = Math.min(radius / INITIAL_RADIUS, 10); // cap at 10x
  const fillPercent = Math.min(ratio / 10, 1) * 100;

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Comfort Zone</Text>
      <View style={s.card}>
        <View style={s.barRow}>
          <Text style={s.edgeLabel}>{INITIAL_RADIUS} mi</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${fillPercent}%`, backgroundColor: colors.accent.primary }]} />
          </View>
          <Text style={[s.edgeLabel, s.currentLabel]}>{radius.toFixed(1)} mi</Text>
        </View>
        <Text style={s.expansion}>
          {pct > 0 ? `+${pct}% expansion` : "Just getting started"}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    edgeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
    },
    currentLabel: {
      color: colors.accent.primary,
      fontWeight: fontWeight.bold,
    },
    barTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    barFill: {
      height: 4,
      borderRadius: 2,
    },
    expansion: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      textAlign: "center",
    },
  });

export default React.memo(ComfortExpansion);
