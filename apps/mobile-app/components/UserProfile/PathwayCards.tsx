import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
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

function emojiFor(theme: string): string {
  return CATEGORY_EMOJI[theme.toLowerCase()] ?? "\uD83D\uDCCD";
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

interface PathwayCardsProps {
  pathways: PathwayData[];
  globalPhase: string;
}

export function PathwayCards({ pathways, globalPhase }: PathwayCardsProps) {
  const colors = useColors();
  const s = baseStyles(colors);

  if (pathways.length === 0) {
    return (
      <View style={s.container}>
        <Text style={s.sectionLabel}>Your Pathways</Text>
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>
            Your pathways form as you complete quests. Each category you explore
            becomes a thread in your story.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Your Pathways</Text>
      {pathways.map((p, i) => (
        <Animated.View
          key={p.theme}
          entering={FadeInDown.delay(i * 80).duration(350)}
        >
          <PathwayCard pathway={p} colors={colors} />
        </Animated.View>
      ))}
    </View>
  );
}

function PathwayCard({ pathway, colors }: { pathway: PathwayData; colors: Colors }) {
  const accent = getCategoryColor(pathway.theme);
  const [ar, ag, ab] = useMemo(() => hexToRgb(accent), [accent]);
  const isDFS = pathway.phase === "dfs";

  return (
    <View
      style={[
        cardStyles(colors, accent, ar, ag, ab).card,
        isDFS && cardStyles(colors, accent, ar, ag, ab).cardDFS,
      ]}
    >
      <View style={cardStyles(colors, accent, ar, ag, ab).header}>
        <Text style={cardStyles(colors, accent, ar, ag, ab).emoji}>
          {emojiFor(pathway.theme)}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles(colors, accent, ar, ag, ab).themeLabel}>
            {pathway.themeLabel}
          </Text>
          <Text style={cardStyles(colors, accent, ar, ag, ab).questCount}>
            {pathway.questCount} quests
          </Text>
        </View>
        <View
          style={[
            cardStyles(colors, accent, ar, ag, ab).badge,
            isDFS && cardStyles(colors, accent, ar, ag, ab).badgeDFS,
          ]}
        >
          <Text
            style={[
              cardStyles(colors, accent, ar, ag, ab).badgeText,
              isDFS && cardStyles(colors, accent, ar, ag, ab).badgeTextDFS,
            ]}
          >
            {isDFS ? "Your Groove" : "Exploring"}
          </Text>
        </View>
      </View>

      {/* Resonance bar */}
      <View style={cardStyles(colors, accent, ar, ag, ab).barTrack}>
        <View
          style={[
            cardStyles(colors, accent, ar, ag, ab).barFill,
            { width: `${Math.min(100, pathway.avgResonance * 100)}%` },
          ]}
        />
      </View>
      <View style={cardStyles(colors, accent, ar, ag, ab).footer}>
        <Text style={cardStyles(colors, accent, ar, ag, ab).footerText}>
          Resonance {(pathway.avgResonance * 100).toFixed(0)}%
        </Text>
        <Text style={cardStyles(colors, accent, ar, ag, ab).footerText}>
          Difficulty {pathway.currentDifficulty}/5
        </Text>
      </View>
    </View>
  );
}

const baseStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.5,
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
  });

const cardStyles = (colors: Colors, accent: string, ar: number, ag: number, ab: number) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg.card,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardDFS: {
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.4)`,
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    emoji: {
      fontSize: 28,
    },
    themeLabel: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    questCount: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
      marginTop: 2,
    },
    badge: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.15)",
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeDFS: {
      backgroundColor: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
      borderColor: `rgba(${ar}, ${ag}, ${ab}, 0.3)`,
    },
    badgeText: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: "rgba(255, 255, 255, 0.8)",
      letterSpacing: 0.5,
    },
    badgeTextDFS: {
      color: accent,
    },
    barTrack: {
      height: 4,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      borderRadius: 2,
      overflow: "hidden",
    },
    barFill: {
      height: 4,
      backgroundColor: accent,
      borderRadius: 2,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerText: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
  });
