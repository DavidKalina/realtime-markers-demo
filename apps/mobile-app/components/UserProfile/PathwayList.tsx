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

interface PathwayItem {
  theme: string;
  themeLabel: string;
  phase: "bfs" | "dfs";
  avgResonance: number;
  questCount: number;
  currentDifficulty: number;
  difficultyTrend: number;
}

interface PathwayListProps {
  pathways: PathwayItem[];
}

function DifficultyDots({ d, accent }: { d: number; accent: string }) {
  const clamped = Math.min(Math.max(Math.round(d), 0), 5);
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < clamped ? accent : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </View>
  );
}

function trendArrow(trend: number): string {
  if (trend > 0.1) return "\u2191";
  if (trend < -0.1) return "\u2193";
  return "\u2192";
}

function trendLabel(trend: number): string {
  if (trend > 0.1) return "trending up";
  if (trend < -0.1) return "easing off";
  return "steady";
}

function PathwayList({ pathways }: PathwayListProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(() => {
    const dfs = pathways.filter((p) => p.phase === "dfs").sort((a, b) => b.avgResonance - a.avgResonance);
    const bfs = pathways.filter((p) => p.phase === "bfs").sort((a, b) => b.avgResonance - a.avgResonance);
    return [...dfs, ...bfs];
  }, [pathways]);

  if (sorted.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>Pathways</Text>
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>Complete quests to reveal your pathways</Text>
          <Text style={s.emptySubtext}>The algorithm learns what resonates with you</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Active Pathways</Text>
      {sorted.map((p) => {
        const isDfs = p.phase === "dfs";
        const accent = isDfs ? colors.accent.primary : BLUE;
        const emoji = CATEGORY_EMOJI[p.theme] ?? CATEGORY_EMOJI.other;

        return (
          <View key={p.theme} style={s.pathwayRow}>
            <View style={s.mainRow}>
              <Text style={s.emoji}>{emoji}</Text>
              <Text style={[s.label, { color: accent }]} numberOfLines={1}>
                {p.themeLabel}
              </Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.round(p.avgResonance * 100)}%`, backgroundColor: accent }]} />
              </View>
              <View style={[s.badge, { borderColor: `${accent}44` }]}>
                <Text style={[s.badgeText, { color: accent }]}>
                  {isDfs ? "Your Groove" : "Exploring"}
                </Text>
              </View>
            </View>
            <View style={s.subRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.subText}>Quest {p.questCount}</Text>
                <Text style={s.subText}>{"\u00B7"}</Text>
                <DifficultyDots d={p.currentDifficulty} accent={accent} />
                <Text style={s.subText}>{"\u00B7"} {trendArrow(p.difficultyTrend)} {trendLabel(p.difficultyTrend)}</Text>
              </View>
            </View>
          </View>
        );
      })}
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
    pathwayRow: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 4,
    },
    mainRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 14,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
      flex: 1,
    },
    barTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      overflow: "hidden",
    },
    barFill: {
      height: 4,
      borderRadius: 2,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    badgeText: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    subRow: {
      paddingLeft: 26,
    },
    subText: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
      letterSpacing: 0.3,
    },
    emptyCard: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.xs,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: fontWeight.medium,
    },
    emptySubtext: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.disabled,
    },
  });

export default React.memo(PathwayList);
