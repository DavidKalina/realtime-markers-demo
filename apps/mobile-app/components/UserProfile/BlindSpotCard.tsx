/**
 * BlindSpotCard — gently surfaces detected recurring blockers and
 * avoidance patterns. Framed positively — not "you failed at X"
 * but "here's an area you're building toward".
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

const AMBER = "#fbbf24";
const GREEN = "#86efac";

// ── Types ──────────────────────────────────────────────────────

export interface BlindSpot {
  /** What the user tends to avoid (e.g., "starting conversations") */
  pattern: string;
  /** How many times the pattern has been observed */
  occurrences: number;
  /** Positive reframe of the blocker */
  reframe: string;
  /** Whether the system is actively working around this */
  activelyManaged: boolean;
}

export interface BlindSpotCardProps {
  blindSpots: BlindSpot[];
}

// ── Component ──────────────────────────────────────────────────

function BlindSpotCard({ blindSpots }: BlindSpotCardProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  if (blindSpots.length === 0) return null;

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>BUILDING TOWARD</Text>

      <View style={s.card}>
        <Text style={s.intro}>
          Based on your quest history, here{"'"}s where we{"'"}re helping you grow:
        </Text>

        {blindSpots.map((spot, i) => (
          <View key={i} style={s.spotRow}>
            <View style={s.spotHeader}>
              <Text style={s.spotEmoji}>
                {spot.activelyManaged ? "\uD83D\uDEE1\uFE0F" : "\uD83C\uDF31"}
              </Text>
              <View style={s.spotInfo}>
                <Text style={[s.spotPattern, { color: spot.activelyManaged ? AMBER : GREEN }]}>
                  {spot.pattern}
                </Text>
                <Text style={s.spotReframe}>{spot.reframe}</Text>
              </View>
            </View>
            {spot.activelyManaged && (
              <View style={s.managedBadge}>
                <Text style={s.managedText}>
                  {"\u25CF"} Adapting quests around this
                </Text>
              </View>
            )}
          </View>
        ))}
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
      gap: spacing.md,
    },
    intro: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      color: colors.text.secondary,
      lineHeight: 15,
    },
    spotRow: {
      gap: spacing.xs,
    },
    spotHeader: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    spotEmoji: {
      fontSize: 16,
      marginTop: 1,
    },
    spotInfo: {
      flex: 1,
      gap: 2,
    },
    spotPattern: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.3,
    },
    spotReframe: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.secondary,
      lineHeight: 14,
    },
    managedBadge: {
      marginLeft: 28, // align with text after emoji
      backgroundColor: `${AMBER}10`,
      borderRadius: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    managedText: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      color: AMBER,
      letterSpacing: 0.5,
    },
  });

export default React.memo(BlindSpotCard);
