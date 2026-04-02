import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import type { PathwayData } from "@/services/api/modules/pathways";
import { getCategoryColor } from "@/utils/categoryColors";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "\u2615",
  coffee: "\u2615",
  restaurant: "\uD83C\uDF7D\uFE0F",
  food: "\uD83C\uDF7D\uFE0F",
  bar: "\uD83C\uDF78",
  trail: "\uD83E\uDD7E",
  hiking: "\uD83E\uDD7E",
  park: "\uD83C\uDF33",
  museum: "\uD83C\uDFDB\uFE0F",
  gallery: "\uD83C\uDFA8",
  market: "\uD83D\uDED2",
  venue: "\uD83C\uDFAA",
  attraction: "\uD83C\uDF1F",
  fitness: "\uD83D\uDCAA",
  wellness: "\uD83E\uDDD8",
  bookstore: "\uD83D\uDCDA",
  other: "\uD83D\uDCCD",
};

// ── Geometry helpers ─────────────────────────────────────────

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 38;
const LABEL_RADIUS = MAX_RADIUS + 14;
const RING_COUNT = 3;

function polarToXY(angle: number, r: number): [number, number] {
  // Start from top (-90deg), go clockwise
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

function pointsString(values: number[], count: number): string {
  return values
    .map((v, i) => {
      const angle = (360 / count) * i;
      const r = v * MAX_RADIUS;
      const [x, y] = polarToXY(angle, r);
      return `${x},${y}`;
    })
    .join(" ");
}

// ── Component ────────────────────────────────────────────────

interface PathwayRadarProps {
  pathways: PathwayData[];
  globalPhase: string;
}

export function PathwayRadar({ pathways, globalPhase }: PathwayRadarProps) {
  const colors = useColors();
  const s = baseStyles(colors);

  if (pathways.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>YOUR PATHWAYS</Text>
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>
            Your pathways form as you complete quests. Each category you explore
            becomes a thread in your story.
          </Text>
        </View>
      </View>
    );
  }

  // Need at least 3 axes for a proper radar
  const sorted = [...pathways].sort((a, b) => b.avgResonance - a.avgResonance);
  const axes = sorted.length >= 3 ? sorted : padToThree(sorted);
  const count = axes.length;

  // Normalize so the max value fills ~90% of the chart, and min is at least 15%
  const rawValues = axes.map((p) => p.avgResonance);
  const maxVal = Math.max(...rawValues, 0.01);
  const values = rawValues.map((v) => Math.max(0.15, (v / maxVal) * 0.9));
  const dfsPathways = sorted.filter((p) => p.phase === "dfs");

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>YOUR PATHWAYS</Text>

      <View style={s.chartWrapper}>
        <View style={{ width: SIZE, height: SIZE }}>
          {/* Static grid + axes + labels */}
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: "absolute", top: 0, left: 0 }}>
            {/* Grid rings */}
            {Array.from({ length: RING_COUNT }).map((_, i) => {
              const r = ((i + 1) / RING_COUNT) * MAX_RADIUS;
              return (
                <Circle
                  key={`ring-${i}`}
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Axis lines */}
            {axes.map((_, i) => {
              const angle = (360 / count) * i;
              const [x, y] = polarToXY(angle, MAX_RADIUS);
              return (
                <Line
                  key={`axis-${i}`}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Axis labels (emoji) */}
            {axes.map((p, i) => {
              const angle = (360 / count) * i;
              const [x, y] = polarToXY(angle, LABEL_RADIUS);
              const emoji = CATEGORY_EMOJI[p.theme.toLowerCase()] ?? "\uD83D\uDCCD";
              return (
                <SvgText
                  key={`label-${i}`}
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize={18}
                >
                  {emoji}
                </SvgText>
              );
            })}
          </Svg>

          {/* Animated colored segments overlay */}
          <RadarFill values={values} count={count} axes={axes} />
        </View>
      </View>

      {/* Legend — only DFS grooves get callouts */}
      {dfsPathways.length > 0 && (
        <View style={s.legend}>
          {dfsPathways.map((p) => {
            const color = getCategoryColor(p.theme);
            const emoji = CATEGORY_EMOJI[p.theme.toLowerCase()] ?? "\uD83D\uDCCD";
            return (
              <Animated.View
                key={p.theme}
                entering={FadeIn.delay(200).duration(300)}
                style={s.legendItem}
              >
                <Text style={s.legendEmoji}>{emoji}</Text>
                <Text style={[s.legendLabel, { color }]}>
                  {p.themeLabel}
                </Text>
                <Text style={s.legendMeta}>
                  {p.questCount} quests
                </Text>
                <View style={[s.grooveBadge, { borderColor: color }]}>
                  <Text style={[s.grooveBadgeText, { color }]}>YOUR GROOVE</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Summary line */}
      <Text style={s.summaryLine}>
        {sorted.length} pathway{sorted.length !== 1 ? "s" : ""} · {sorted.reduce((s, p) => s + p.questCount, 0)} quests · {dfsPathways.length > 0 ? `${dfsPathways.length} groove${dfsPathways.length !== 1 ? "s" : ""} found` : "still exploring"}
      </Text>
    </View>
  );
}

// ── Animated colored radar fill ──────────────────────────────

function RadarFill({
  values,
  count,
  axes,
}: {
  values: number[];
  count: number;
  axes: PathwayData[];
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [values.join(",")]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: CENTER * (1 - progress.value) },
      { translateY: CENTER * (1 - progress.value) },
      { scaleX: progress.value },
      { scaleY: progress.value },
    ],
    opacity: progress.value,
  }));

  // Build per-segment triangles: center → pointA → pointB
  const segments: { points: string; color: string; isDFS: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const angleA = (360 / count) * i;
    const angleB = (360 / count) * next;
    const [ax, ay] = polarToXY(angleA, values[i] * MAX_RADIUS);
    const [bx, by] = polarToXY(angleB, values[next] * MAX_RADIUS);
    const color = getCategoryColor(axes[i].theme);
    segments.push({
      points: `${CENTER},${CENTER} ${ax},${ay} ${bx},${by}`,
      color,
      isDFS: axes[i].phase === "dfs",
    });
  }

  const outlinePts = pointsString(values, count);

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, animatedStyle]}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Colored segment fills */}
        {segments.map((seg, i) => (
          <Polygon
            key={`seg-${i}`}
            points={seg.points}
            fill={`${seg.color}${seg.isDFS ? "35" : "20"}`}
            stroke="none"
          />
        ))}
        {/* Outline polygon */}
        <Polygon
          points={outlinePts}
          fill="none"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Per-axis colored dots at vertices */}
        {values.map((v, i) => {
          const angle = (360 / count) * i;
          const [x, y] = polarToXY(angle, v * MAX_RADIUS);
          const color = getCategoryColor(axes[i].theme);
          const isDFS = axes[i].phase === "dfs";
          return (
            <React.Fragment key={`dot-${i}`}>
              {isDFS && <Circle cx={x} cy={y} r={7} fill={`${color}30`} />}
              <Circle cx={x} cy={y} r={isDFS ? 4 : 3} fill={color} />
            </React.Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

// ── Pad to 3 axes minimum ────────────────────────────────────

function padToThree(pathways: PathwayData[]): PathwayData[] {
  const padded = [...pathways];
  const placeholders = ["exploring", "discovering", "growing"];
  while (padded.length < 3) {
    padded.push({
      theme: placeholders[padded.length] ?? "other",
      themeLabel: "...",
      phase: "bfs" as const,
      avgResonance: 0,
      questCount: 0,
      currentDifficulty: 0,
    });
  }
  return padded;
}

// ── Styles ───────────────────────────────────────────────────

const baseStyles = (colors: Colors) =>
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
    emptyCard: {
      backgroundColor: colors.bg.card,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      borderRadius: radius.lg,
      padding: spacing.xl,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 20,
      textAlign: "center",
    },
    chartWrapper: {
      alignItems: "center",
      marginVertical: spacing.sm,
    },
    legend: {
      gap: spacing.sm,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    legendEmoji: {
      fontSize: 16,
    },
    legendLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontWeight: fontWeight.bold,
      flex: 1,
    },
    legendMeta: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    grooveBadge: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    grooveBadgeText: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    summaryLine: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.disabled,
      textAlign: "center",
    },
  });
