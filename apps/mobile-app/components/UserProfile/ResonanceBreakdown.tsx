import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";
const BAR_WIDTH = 20;
const CHAR_INTERVAL = 25;   // ms per character fill
const ROW_DELAY = 120;      // ms pause between rows
const SCORE_DELAY = 300;    // ms pause before score row

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

function buildBar(filledCount: number, total: number, isScore = false): string {
  const filled = Math.min(filledCount, total);
  const empty = total - filled;
  const fillChar = isScore ? "\u2593" : "\u2588";
  return fillChar.repeat(filled) + "\u2591".repeat(empty);
}

function valueColor(value: number): string {
  if (value >= 0.7) return GREEN;
  if (value <= 0.3) return "rgba(255, 255, 255, 0.3)";
  return "rgba(255, 255, 255, 0.55)";
}

// Each row animates its bar filling character by character
function AnimatedRow({
  label,
  targetValue,
  startDelay,
  isScore,
  labelStyle,
  barStyle,
  valueStyle,
  rowStyle,
}: {
  label: string;
  targetValue: number;
  startDelay: number;
  isScore?: boolean;
  labelStyle: any;
  barStyle: any;
  valueStyle: any;
  rowStyle: any;
}) {
  const targetFilled = Math.round(targetValue * BAR_WIDTH);
  const [currentFilled, setCurrentFilled] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setVisible(true);
      let count = 0;
      intervalRef.current = setInterval(() => {
        count++;
        if (count >= targetFilled) {
          setCurrentFilled(targetFilled);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          setCurrentFilled(count);
        }
      }, CHAR_INTERVAL);
    }, startDelay);

    return () => {
      clearTimeout(showTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startDelay, targetFilled]);

  const color = valueColor(targetValue);
  const displayValue = currentFilled >= targetFilled
    ? targetValue.toFixed(2)
    : (currentFilled / BAR_WIDTH).toFixed(2);

  // Always render full structure to reserve space — control visibility via opacity
  return (
    <View style={rowStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={[barStyle, { color: isScore ? GREEN : color, opacity: visible ? 1 : 0 }]}>
        {visible ? buildBar(currentFilled, BAR_WIDTH, isScore) : buildBar(0, BAR_WIDTH, isScore)}
      </Text>
      <Text style={[valueStyle, { color: isScore ? GREEN : color, opacity: visible ? 1 : 0 }]}>
        {visible ? displayValue : "0.00"}
      </Text>
    </View>
  );
}

function ResonanceBreakdown({ components, score }: ResonanceBreakdownProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  // Compute staggered start delays
  const rowDelays = useMemo(() => {
    const delays: number[] = [];
    let time = 200; // initial delay
    for (let i = 0; i < LABELS.length; i++) {
      delays.push(time);
      const targetFilled = Math.round(components[LABELS[i].key] * BAR_WIDTH);
      time += targetFilled * CHAR_INTERVAL + ROW_DELAY;
    }
    return delays;
  }, [components]);

  const scoreDelay = useMemo(() => {
    const lastRow = LABELS.length - 1;
    const lastFilled = Math.round(components[LABELS[lastRow].key] * BAR_WIDTH);
    return rowDelays[lastRow] + lastFilled * CHAR_INTERVAL + SCORE_DELAY;
  }, [rowDelays, components]);

  const [showSeparator, setShowSeparator] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowSeparator(true), scoreDelay - 100);
    return () => clearTimeout(timer);
  }, [scoreDelay]);

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>LAST QUEST RESONANCE</Text>
      <View style={s.card}>
        {LABELS.map(({ key, label }, i) => (
          <AnimatedRow
            key={key}
            label={label}
            targetValue={components[key]}
            startDelay={rowDelays[i]}
            labelStyle={s.rowLabel}
            barStyle={s.rowBar}
            valueStyle={s.rowValue}
            rowStyle={s.row}
          />
        ))}

        <Text style={[s.separator, { opacity: showSeparator ? 1 : 0 }]}>
          {"          "}{"\u2500".repeat(BAR_WIDTH)}
        </Text>

        <AnimatedRow
          label="SCORE"
          targetValue={score}
          startDelay={scoreDelay}
          isScore
          labelStyle={[s.rowLabel, s.scoreLabel]}
          barStyle={[s.rowBar, s.scoreBar]}
          valueStyle={[s.rowValue, s.scoreValue]}
          rowStyle={s.row}
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
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: 4,
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
    rowBar: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      letterSpacing: -1,
      flex: 1,
    },
    rowValue: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      width: 36,
      textAlign: "right",
      fontWeight: fontWeight.medium,
    },
    separator: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: "rgba(255, 255, 255, 0.1)",
      letterSpacing: -1,
      marginVertical: 2,
    },
    scoreLabel: {
      fontWeight: fontWeight.bold,
      color: GREEN,
    },
    scoreBar: {
      color: GREEN,
    },
    scoreValue: {
      fontWeight: fontWeight.bold,
      color: GREEN,
    },
  });

export default React.memo(ResonanceBreakdown);
