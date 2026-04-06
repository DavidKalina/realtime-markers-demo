import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from "react-native-reanimated";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const ROW_STAGGER = 150;    // ms between rows

interface ResonanceComponents {
  ratingSignal: number;
  journalDepth: number;
  sentimentSignal: number;
  socialEscalation: number;
  speedSignal: number;
  difficultyAlignment: number;
}

interface ResonanceBreakdownProps {
  components: ResonanceComponents;
  score: number;
}

const LABELS: { key: keyof ResonanceComponents; label: string }[] = [
  { key: "ratingSignal", label: "Rating" },
  { key: "journalDepth", label: "Reflection" },
  { key: "sentimentSignal", label: "Sentiment" },
  { key: "socialEscalation", label: "Social" },
  { key: "speedSignal", label: "Speed" },
  { key: "difficultyAlignment", label: "Alignment" },
];

function valueColor(value: number, accent: string): string {
  if (value >= 0.7) return accent;
  if (value <= 0.3) return "rgba(255, 255, 255, 0.7)";
  return "rgba(255, 255, 255, 0.8)";
}

// Each row animates its bar width using reanimated
function AnimatedRow({
  label,
  targetValue,
  startDelay,
  isScore,
  accentColor,
  colors,
  s,
}: {
  label: string;
  targetValue: number;
  startDelay: number;
  isScore?: boolean;
  accentColor: string;
  colors: Colors;
  s: ReturnType<typeof createStyles>;
}) {
  const widthProgress = useSharedValue(0);

  useEffect(() => {
    widthProgress.value = withDelay(startDelay, withTiming(targetValue, { duration: 600 }));
  }, [startDelay, targetValue, widthProgress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthProgress.value * 100}%`,
    backgroundColor: isScore ? accentColor : valueColor(targetValue, accentColor),
  }));

  const color = isScore ? accentColor : valueColor(targetValue, accentColor);

  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, isScore && s.scoreLabel]}>{label}</Text>
      <View style={s.rowTrack}>
        <Animated.View style={[s.rowFill, fillStyle]} />
      </View>
      <Text style={[s.rowValue, { color }, isScore && s.scoreValue]}>
        {targetValue.toFixed(2)}
      </Text>
    </View>
  );
}

function ResonanceBreakdown({ components, score }: ResonanceBreakdownProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Last Quest Resonance</Text>
      <View style={s.card}>
        {LABELS.map(({ key, label }, i) => (
          <AnimatedRow
            key={key}
            label={label}
            targetValue={components[key]}
            startDelay={200 + i * ROW_STAGGER}
            accentColor={colors.accent.primary}
            colors={colors}
            s={s}
          />
        ))}

        <View style={s.separator} />

        <AnimatedRow
          label="Score"
          targetValue={score}
          startDelay={200 + LABELS.length * ROW_STAGGER + 200}
          isScore
          accentColor={colors.accent.primary}
          colors={colors}
          s={s}
        />
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
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    rowLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      width: 80,
    },
    rowTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    rowFill: {
      height: 4,
      borderRadius: 2,
    },
    rowValue: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      width: 36,
      textAlign: "right",
      fontWeight: fontWeight.medium,
    },
    separator: {
      height: 1,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      marginVertical: 2,
    },
    scoreLabel: {
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    scoreValue: {
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
  });

export default React.memo(ResonanceBreakdown);
