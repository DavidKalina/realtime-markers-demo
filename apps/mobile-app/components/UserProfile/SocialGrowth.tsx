import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import type { SocialGrowthEntry } from "@/services/api/modules/profileInsights";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

// ── Social ladder ────────────────────────────────────────────

const SOCIAL_RUNGS = [
  { key: "solo", emoji: "\uD83E\uDDD1", label: "Solo", color: "rgba(255,255,255,0.25)" },
  { key: "with_someone", emoji: "\uD83D\uDC6B", label: "With someone", color: "#93c5fd" },
  { key: "met_someone_new", emoji: "\uD83D\uDC4B", label: "Met someone new", color: "#86efac" },
  { key: "group_activity", emoji: "\uD83D\uDC65", label: "Group", color: "#c4b5fd" },
] as const;

const RUNG_INDEX: Record<string, number> = {};
SOCIAL_RUNGS.forEach((r, i) => { RUNG_INDEX[r.key] = i; });

// ── Derive narrative ─────────────────────────────────────────

function deriveNarrative(timeline: number[]): string | null {
  if (timeline.length < 2) return null;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const peak = Math.max(...timeline);

  if (peak === 0 && last === 0) return "You've been going solo. Your social story is waiting.";
  if (last > first) return `You started at "${SOCIAL_RUNGS[first].label.toLowerCase()}" and grew to "${SOCIAL_RUNGS[last].label.toLowerCase()}."`;
  if (peak > last) return `You've reached "${SOCIAL_RUNGS[peak].label.toLowerCase()}" before. You'll get back there.`;
  return "A healthy mix of solo and social.";
}

// ── Chart constants ──────────────────────────────────────────

const CHART_HEIGHT = 120;
const CHART_PADDING_LEFT = 36;
const CHART_PADDING_RIGHT = 16;
const DOT_RADIUS = 4;
const LANE_COUNT = SOCIAL_RUNGS.length;

function laneY(rungIndex: number): number {
  const usable = CHART_HEIGHT - 24;
  const step = usable / (LANE_COUNT - 1);
  return 12 + (LANE_COUNT - 1 - rungIndex) * step;
}

// ── Component ────────────────────────────────────────────────

interface SocialGrowthProps {
  data: SocialGrowthEntry[];
  /** Ordered social contexts from completed quests (oldest first) */
  timeline?: string[];
}

export function SocialGrowth({ data, timeline: timelineProp }: SocialGrowthProps) {
  const colors = useColors();
  const s = styles(colors);

  // Build timeline from aggregate data if not provided
  // This is a rough approximation — ideally pass the real quest-by-quest timeline
  const timeline: number[] = React.useMemo(() => {
    if (timelineProp && timelineProp.length > 0) {
      return timelineProp.map((ctx) => RUNG_INDEX[ctx] ?? 0);
    }
    // Synthesize from counts: expand in order solo → with_someone → met → group
    const expanded: number[] = [];
    for (const rung of SOCIAL_RUNGS) {
      const entry = data.find((d) => d.context === rung.key);
      if (entry) {
        for (let i = 0; i < entry.count; i++) expanded.push(RUNG_INDEX[rung.key]);
      }
    }
    return expanded;
  }, [data, timelineProp]);

  if (!data || data.length === 0 || timeline.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>SOCIAL GROWTH</Text>
        <Text style={s.emptyText}>Complete quests to see your social arc.</Text>
      </View>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const narrative = deriveNarrative(timeline);
  const chartWidth = 320;

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>SOCIAL GROWTH</Text>

      <View style={s.chartContainer}>
        {/* Lane labels */}
        <View style={s.laneLabels}>
          {[...SOCIAL_RUNGS].reverse().map((rung) => (
            <Text key={rung.key} style={[s.laneLabel, { color: rung.color }]}>
              {rung.emoji}
            </Text>
          ))}
        </View>

        {/* SVG river chart */}
        <View style={s.chartSvg}>
          <Svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {/* Lane lines */}
            {SOCIAL_RUNGS.map((rung, i) => {
              const y = laneY(i);
              return (
                <Line
                  key={`lane-${i}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.04)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Connection lines between dots */}
            {timeline.map((rung, i) => {
              if (i === 0) return null;
              const prevRung = timeline[i - 1];
              const step = chartWidth / Math.max(timeline.length - 1, 1);
              const x1 = (i - 1) * step;
              const y1 = laneY(prevRung);
              const x2 = i * step;
              const y2 = laneY(rung);
              const color = SOCIAL_RUNGS[rung]?.color ?? "rgba(255,255,255,0.2)";
              return (
                <Line
                  key={`line-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                />
              );
            })}

            {/* Dots */}
            {timeline.map((rung, i) => {
              const step = chartWidth / Math.max(timeline.length - 1, 1);
              const x = i * step;
              const y = laneY(rung);
              const color = SOCIAL_RUNGS[rung]?.color ?? "rgba(255,255,255,0.2)";
              return (
                <Circle
                  key={`dot-${i}`}
                  cx={x}
                  cy={y}
                  r={DOT_RADIUS}
                  fill={color}
                />
              );
            })}
          </Svg>
        </View>
      </View>

      {/* Narrative */}
      {narrative && <Text style={s.narrative}>{narrative}</Text>}

      {/* Compact counts */}
      <View style={s.countsRow}>
        {SOCIAL_RUNGS.map((rung) => {
          const count = data.find((d) => d.context === rung.key)?.count ?? 0;
          if (count === 0) return null;
          return (
            <View key={rung.key} style={s.countChip}>
              <View style={[s.countDot, { backgroundColor: rung.color }]} />
              <Text style={s.countText}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 1.5,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },

    chartContainer: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    laneLabels: {
      justifyContent: "space-between",
      paddingVertical: 4,
      width: 24,
    },
    laneLabel: {
      fontSize: 14,
      textAlign: "center",
    },
    chartSvg: {
      flex: 1,
      height: CHART_HEIGHT,
    },

    narrative: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      lineHeight: 20,
      fontStyle: "italic",
    },

    countsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    countChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    countDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    countText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
  });
