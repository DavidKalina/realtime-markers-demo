import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const RUNGS = [
  { key: "solo", label: "Solo", emoji: "\uD83E\uDDD1" },
  { key: "with_someone", label: "With someone", emoji: "\uD83D\uDC6B" },
  { key: "met_someone_new", label: "Met someone", emoji: "\uD83D\uDC4B" },
  { key: "group_activity", label: "Group", emoji: "\uD83D\uDC65" },
] as const;

interface SocialEntry {
  context: string;
  count: number;
}

interface SocialLadderProps {
  data: SocialEntry[];
}

function SocialLadder({ data }: SocialLadderProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of data) {
      map[entry.context] = entry.count;
    }
    return map;
  }, [data]);

  // Find highest reached rung
  let peakIndex = -1;
  for (let i = RUNGS.length - 1; i >= 0; i--) {
    if ((countMap[RUNGS[i].key] ?? 0) > 0) {
      peakIndex = i;
      break;
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>Social Ladder</Text>
      <View style={s.card}>
        {/* Labels */}
        <View style={s.labelsRow}>
          {RUNGS.map((rung, i) => {
            const reached = (countMap[rung.key] ?? 0) > 0;
            const isPeak = i === peakIndex;
            return (
              <View key={rung.key} style={s.labelCell}>
                <Text style={s.rungEmoji}>{rung.emoji}</Text>
                <Text
                  style={[
                    s.rungLabel,
                    reached && { color: colors.text.secondary },
                    isPeak && { color: colors.accent.primary },
                  ]}
                  numberOfLines={1}
                >
                  {rung.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Node chain */}
        <View style={s.chainRow}>
          {RUNGS.map((rung, i) => {
            const reached = (countMap[rung.key] ?? 0) > 0;
            const isPeak = i === peakIndex;
            const dotColor = isPeak ? colors.accent.primary : reached ? colors.text.secondary : "rgba(255, 255, 255, 0.25)";
            const isLast = i === RUNGS.length - 1;

            return (
              <React.Fragment key={rung.key}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
                {!isLast && (
                  <View
                    style={[
                      s.line,
                      { backgroundColor: reached && (countMap[RUNGS[i + 1].key] ?? 0) > 0
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(255, 255, 255, 0.08)"
                      },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Counts */}
        <View style={s.countsRow}>
          {RUNGS.map((rung) => {
            const count = countMap[rung.key] ?? 0;
            return (
              <View key={rung.key} style={s.countCell}>
                {count > 0 && (
                  <Text style={s.countText}>{count}x</Text>
                )}
              </View>
            );
          })}
        </View>
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
      gap: spacing.sm,
    },
    labelsRow: {
      flexDirection: "row",
    },
    labelCell: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    rungEmoji: {
      fontSize: 16,
    },
    rungLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      color: "rgba(255, 255, 255, 0.3)",
      fontWeight: fontWeight.medium,
      letterSpacing: 0.3,
      textAlign: "center",
    },
    chainRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
    },
    line: {
      flex: 1,
      height: 1.5,
    },
    countsRow: {
      flexDirection: "row",
    },
    countCell: {
      flex: 1,
      alignItems: "center",
    },
    countText: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.disabled,
    },
  });

export default React.memo(SocialLadder);
