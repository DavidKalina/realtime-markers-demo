import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

// ── Phase config ───────────────────────────────────────────────

const PHASES = [
  { label: "Show Up", description: "Building the habit of getting out" },
  { label: "Become a Regular", description: "Finding your spots and rhythm" },
  { label: "Make Connections", description: "Turning strangers into acquaintances" },
  { label: "Build Your Circle", description: "Deepening into real friendships" },
] as const;

// ── Tips by stage ──────────────────────────────────────────────

const GENERATING_TIPS = [
  "We're building quests tailored to your comfort level and interests.",
  "Each quest is a small, concrete step — not a big commitment.",
  "You'll get a mix of easy wins, fun outings, and gentle stretches.",
];

const EARLY_TIPS = [
  "Most people overthink their first outing. Just showing up is 90% of it.",
  "There's no wrong way to do a quest. Even bailing early counts as progress.",
  "Rate your quests honestly — it helps us learn what works for you.",
  "The first few quests are about building the habit, not changing your life.",
];

const PROGRESSING_TIPS = [
  "You're past the hardest part — starting. Now it's about consistency.",
  "Pay attention to which quests you'd do again. That's your signal.",
  "The quests you resist most often teach you the most.",
  "Growth isn't linear. A bad outing is still a data point.",
];

function pickTip(tips: string[], seed: number): string {
  // Rotate through tips based on a seed (day of year + quest count)
  return tips[seed % tips.length];
}

// ── Component ──────────────────────────────────────────────────

interface JourneyCardProps {
  primaryGoal?: string;
  northStar?: string;
  phase: number;
  completedQuests: number;
  isGenerating: boolean;
  stepLabel?: string;
}

function JourneyCard({
  primaryGoal,
  northStar,
  phase,
  completedQuests,
  isGenerating,
  stepLabel,
}: JourneyCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const currentPhase = PHASES[phase] ?? PHASES[0];
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const seed = dayOfYear + completedQuests;

  // Pick contextual tip
  let tip: string;
  if (isGenerating && completedQuests === 0) {
    tip = pickTip(GENERATING_TIPS, seed);
  } else if (completedQuests < 3) {
    tip = pickTip(EARLY_TIPS, seed);
  } else {
    tip = pickTip(PROGRESSING_TIPS, seed);
  }

  return (
    <View style={s.container}>
      {/* Goal */}
      {primaryGoal && (
        <Text style={s.goalText}>{primaryGoal}</Text>
      )}

      {/* Phase indicator */}
      <View style={s.phaseRow}>
        {PHASES.map((p, i) => (
          <View
            key={p.label}
            style={[
              s.phaseDot,
              i <= phase
                ? { backgroundColor: colors.accent.primary }
                : { backgroundColor: "rgba(255, 255, 255, 0.15)" },
              i === phase && s.phaseDotActive,
            ]}
          />
        ))}
        <Text style={s.phaseLabel}>
          {currentPhase.label}
        </Text>
      </View>

      {/* Phase description */}
      <Text style={s.phaseDescription}>
        {currentPhase.description}
      </Text>

      {/* Generating state */}
      {isGenerating && completedQuests === 0 && (
        <View style={s.generatingRow}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
          <Text style={s.generatingText}>
            {stepLabel || "Crafting your quests..."}
          </Text>
        </View>
      )}

      {/* North star quote */}
      {northStar && (
        <Text style={s.northStarText}>
          {"\u201C"}{northStar}{"\u201D"}
        </Text>
      )}

      {/* Contextual tip */}
      <View style={s.tipRow}>
        <Text style={s.tipText}>{tip}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: `rgba(${colors.accent.rgb}, 0.06)`,
      borderRadius: radius.md,
      padding: spacing.lg,
      gap: spacing.md,
    },
    goalText: {
      fontFamily: fontFamily.mono,
      fontSize: 15,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 24,
    },
    phaseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing._6,
    },
    phaseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    phaseDotActive: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    phaseLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      color: colors.accent.primary,
      marginLeft: spacing.xs,
    },
    phaseDescription: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      opacity: 0.8,
    },
    generatingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    generatingText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      flex: 1,
    },
    northStarText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      fontStyle: "italic",
      opacity: 0.7,
    },
    tipRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255, 255, 255, 0.08)",
      paddingTop: spacing.md,
    },
    tipText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 20,
      opacity: 0.6,
    },
  });

export default React.memo(JourneyCard);
