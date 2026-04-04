import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";
const INITIAL_RADIUS = 0.5; // DEFAULT_COMFORT_RADIUS_MILES
const BAR_WIDTH = 30;

interface ComfortExpansionProps {
  currentRadiusMiles: number | null;
}

function buildExpansionBar(initial: number, current: number): string {
  if (current <= initial) return "\u2588".repeat(BAR_WIDTH);
  // Scale: initial maps to ~20% of bar, current fills proportionally
  const ratio = Math.min(current / initial, 10); // cap at 10x
  const filledChars = Math.round(Math.min(ratio / 10, 1) * BAR_WIDTH);
  const midChars = Math.round(filledChars * 0.6);
  const highChars = filledChars - midChars;
  const emptyChars = BAR_WIDTH - filledChars;

  return "\u2591".repeat(3) + "\u2593".repeat(midChars) + "\u2588".repeat(highChars) + "\u2591".repeat(Math.max(0, emptyChars - 3));
}

function ComfortExpansion({ currentRadiusMiles }: ComfortExpansionProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const radius = Number(currentRadiusMiles);
  if (!radius || radius <= 0 || isNaN(radius)) return null;

  const pct = Math.round(((radius - INITIAL_RADIUS) / INITIAL_RADIUS) * 100);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>COMFORT ZONE</Text>
      <View style={s.card}>
        <View style={s.barRow}>
          <Text style={s.edgeLabel}>{INITIAL_RADIUS} mi</Text>
          <Text style={s.bar}>{buildExpansionBar(INITIAL_RADIUS, radius)}</Text>
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
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
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
      color: GREEN,
      fontWeight: fontWeight.bold,
    },
    bar: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: GREEN,
      letterSpacing: -0.5,
      flex: 1,
    },
    expansion: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      textAlign: "center",
    },
  });

export default React.memo(ComfortExpansion);
