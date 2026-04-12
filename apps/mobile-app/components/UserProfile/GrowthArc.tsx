/**
 * GrowthArc — visualizes the user's 4-phase fear-ladder progression
 * with a node chain, phase description, and key stats.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const BLUE = "#93c5fd";
const AMBER = "#fbbf24";

// ── Types ──────────────────────────────────────────────────────

export interface GrowthArcProps {
  /** Current phase 0-3 */
  phase: number;
  /** Human-readable reason for current phase */
  phaseReason: string;
  /** Completed quest count */
  completedQuests: number;
  /** Average rating (1-5) */
  avgRating: number;
  /** Average resonance (0-1) */
  avgResonance: number;
  /** Recent resonance (last 5, 0-1) */
  recentResonance: number;
  /** Whether growth signals detected in reflections */
  hasGrowthSignals: boolean;
}

// ── Phase config ───────────────────────────────────────────────

const PHASES = [
  { label: "Show Up", description: "Building the habit of getting out" },
  { label: "Become a Regular", description: "Finding your spots and your rhythm" },
  { label: "Make Connections", description: "Turning strangers into acquaintances" },
  { label: "Build Your Circle", description: "Deepening connections into real friendships" },
] as const;

function phaseColor(index: number, current: number, accent: string): string {
  if (index < current) return accent;
  if (index === current) return AMBER;
  return "rgba(255, 255, 255, 0.25)";
}

// ── Component ──────────────────────────────────────────────────

function GrowthArc({
  phase,
  phaseReason,
  completedQuests,
  avgRating,
  avgResonance,
  recentResonance,
  hasGrowthSignals,
}: GrowthArcProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const currentPhase = PHASES[phase] ?? PHASES[0];
  const resonanceDelta = recentResonance - avgResonance;
  const trending = resonanceDelta > 0.05 ? "up" : resonanceDelta < -0.05 ? "down" : "stable";

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Growth Arc</Text>

      <View style={s.card}>
        {/* Phase node chain */}
        <View style={s.chainRow}>
          {PHASES.map((p, i) => {
            const color = phaseColor(i, phase, colors.accent.primary);
            const isCurrent = i === phase;
            const isCompleted = i < phase;
            const isLast = i === PHASES.length - 1;

            return (
              <React.Fragment key={p.label}>
                <View style={s.nodeColumn}>
                  <Text style={[s.nodeLabel, isCurrent && { color: AMBER }, isCompleted && { color: colors.accent.primary }]}>
                    {p.label}
                  </Text>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: (isCompleted || isCurrent) ? color : "rgba(255,255,255,0.15)" }} />
                </View>
                {!isLast && (
                  <View
                    style={[
                      s.line,
                      {
                        backgroundColor:
                          i < phase
                            ? `rgba(${colors.accent.rgb}, 0.27)`
                            : "rgba(255, 255, 255, 0.06)",
                      },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Current phase info */}
        <View style={s.infoBlock}>
          <Text style={[s.phaseTitle, { color: AMBER }]}>
            Phase {phase}: {currentPhase.label}
          </Text>
          <Text style={s.phaseDesc}>{currentPhase.description}</Text>
          <Text style={s.phaseReason}>{phaseReason}</Text>
        </View>

        {/* Resonance trend */}
        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Text style={s.metricValue}>{completedQuests}</Text>
            <Text style={s.metricLabel}>Quests</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricValue}>{avgRating.toFixed(1)}</Text>
            <Text style={s.metricLabel}>Avg Rating</Text>
          </View>
          <View style={s.metric}>
            <Text style={[s.metricValue, { color: trending === "up" ? colors.accent.primary : trending === "down" ? BLUE : colors.text.primary }]}>
              {trending === "up" ? "\u2191" : trending === "down" ? "\u2193" : "\u2192"}{" "}
              {Math.round(recentResonance * 100)}%
            </Text>
            <Text style={s.metricLabel}>Resonance</Text>
          </View>
          {hasGrowthSignals && (
            <View style={s.metric}>
              <Text style={[s.metricValue, { color: colors.accent.primary }]}>{"\u2713"}</Text>
              <Text style={s.metricLabel}>Growing</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

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
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    chainRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    nodeColumn: {
      alignItems: "center",
      gap: 3,
    },
    nodeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.medium,
      color: "rgba(255, 255, 255, 0.3)",
      letterSpacing: 0.3,
    },
    line: {
      flex: 1,
      height: 1.5,
      marginBottom: -6, // align with dots
    },
    infoBlock: {
      gap: 3,
    },
    phaseTitle: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
    },
    phaseDesc: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    phaseReason: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
      fontStyle: "italic",
      marginTop: 2,
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: "rgba(255, 255, 255, 0.08)",
      paddingTop: spacing.sm,
    },
    metric: {
      alignItems: "center",
      gap: 2,
    },
    metricValue: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    metricLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
    },
  });

export default React.memo(GrowthArc);
