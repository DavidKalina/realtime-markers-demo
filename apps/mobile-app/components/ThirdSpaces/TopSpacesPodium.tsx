import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  useColors,
  type Colors,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from "@/theme";
import type { ThirdSpaceSummary } from "@/services/api/modules/leaderboard";

interface TopSpacesPodiumProps {
  cities: ThirdSpaceSummary[];
  onCityPress: (city: ThirdSpaceSummary) => void;
}

const MOMENTUM_ARROWS: Record<string, { arrow: string; color: string }> = {
  rising: { arrow: "\u2191", color: "#4ade80" },
  steady: { arrow: "\u2192", color: "#a3a3a3" },
  cooling: { arrow: "\u2193", color: "#7dd3fc" },
};

const RANK_COLORS = ["#fbbf24", "#a3a3a3", "#cd7f32"]; // gold, silver, bronze

function getScoreColor(score: number): string {
  const t = Math.min(Math.max(score / 100, 0), 1);
  const r = Math.round(180 - t * 140);
  const g = Math.round(230 - t * 60);
  const b = Math.round(180 - t * 120);
  return `rgb(${r}, ${g}, ${b})`;
}

interface PodiumItemProps {
  city: ThirdSpaceSummary;
  rank: number;
  onPress: (city: ThirdSpaceSummary) => void;
}

const PODIUM_CONFIG = {
  1: { circleSize: 88, strokeWidth: 6, scoreFontSize: 26, topOffset: 0 },
  2: { circleSize: 64, strokeWidth: 4, scoreFontSize: 18, topOffset: 32 },
  3: { circleSize: 64, strokeWidth: 4, scoreFontSize: 18, topOffset: 32 },
} as const;

const PodiumItem: React.FC<PodiumItemProps> = ({ city, rank, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const config = PODIUM_CONFIG[rank as keyof typeof PODIUM_CONFIG];
  const { circleSize, strokeWidth, scoreFontSize, topOffset } = config;
  const circleRadius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * circleRadius;
  const scoreColor = getScoreColor(city.score);
  const progress = city.score / 100;
  const cityLabel = city.city.includes(",")
    ? city.city.split(",")[0].trim()
    : city.city;
  const momentum = MOMENTUM_ARROWS[city.momentum];
  const rankColor = RANK_COLORS[rank - 1];
  const isCenter = rank === 1;

  return (
    <Pressable
      style={[
        styles.podiumItem,
        { marginTop: topOffset },
        isCenter && styles.podiumCenter,
      ]}
      onPress={() => onPress(city)}
    >
      {/* Medal badge */}
      <View
        style={[
          styles.rankBadge,
          { borderColor: rankColor, backgroundColor: rankColor + "18" },
        ]}
      >
        <Text style={[styles.rankText, { color: rankColor }]}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
        </Text>
      </View>

      {/* Score circle */}
      <View style={{ width: circleSize, height: circleSize, marginTop: 4 }}>
        <Svg width={circleSize} height={circleSize}>
          <Circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={circleRadius}
            stroke={colors.border.accent}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={circleRadius}
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.circleLabelWrap}>
            <Text
              style={[
                styles.podiumScore,
                { color: scoreColor, fontSize: scoreFontSize },
              ]}
            >
              {city.score}
            </Text>
          </View>
        </View>
      </View>

      {/* City name */}
      <Text
        style={[styles.podiumCity, isCenter && styles.podiumCityCenter]}
        numberOfLines={1}
      >
        {cityLabel}
      </Text>

      {/* Momentum + event count */}
      <Text style={[styles.podiumMeta, { color: momentum.color }]}>
        {momentum.arrow} {city.adventureCount} adventure
        {city.adventureCount !== 1 ? "s" : ""}
      </Text>
    </Pressable>
  );
};

const TopSpacesPodium: React.FC<TopSpacesPodiumProps> = ({
  cities,
  onCityPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (cities.length === 0) return null;

  // Arrange as [#2, #1, #3] for podium layout
  const ordered = [cities[1], cities[0], cities[2]].filter(Boolean);
  const ranks =
    cities.length >= 3 ? [2, 1, 3] : cities.length === 2 ? [2, 1] : [1];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>TOP THIRD SPACES</Text>
      <View style={styles.podiumRow}>
        {ordered.map((city, i) => (
          <PodiumItem
            key={city.city}
            city={city}
            rank={ranks[i]}
            onPress={onCityPress}
          />
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing["2xl"],
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    podiumRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    podiumItem: {
      flex: 1,
      alignItems: "center",
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.bg.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: 6,
    },
    podiumCenter: {
      paddingTop: spacing.lg,
      paddingBottom: spacing["2xl"],
      borderColor: colors.border.medium,
      backgroundColor: colors.bg.cardAlt,
    },
    rankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      justifyContent: "center",
      alignItems: "center",
    },
    rankText: {
      fontSize: 12,
    },
    circleLabelWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    podiumScore: {
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    podiumCity: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      textAlign: "center",
      marginTop: 2,
    },
    podiumCityCenter: {
      fontSize: fontSize.sm,
    },
    podiumMeta: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
    },
  });

export default TopSpacesPodium;
