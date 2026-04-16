import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  CAPACITY_TRACK_LABELS,
  type CapacityRepSummary,
  type CapacityTrack,
} from "@/services/api/modules/sidequests";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface Props {
  reps: CapacityRepSummary[];
}

// Canonical order (matches the enum definition). Tracks with zero completions
// still show up so the user can see the full capacity map — absence is
// informative too.
const TRACK_ORDER: CapacityTrack[] = [
  "ACTIVATION",
  "PUBLIC_PRESENCE",
  "NOVELTY_TOLERANCE",
  "STAYING_POWER",
  "RETURNABILITY",
  "MICRO_INTERACTION",
  "SOCIAL_EXTENSION",
  "RECOVERY",
  "IDENTITY_EVIDENCE",
];

/**
 * Slice follow-up — Reps Built Per Track.
 *
 * Evidence of capacity, not a score. Shows every track (including zeros)
 * so the user sees the shape of their growth: what they've built, what's
 * still untouched. Non-zero tracks sort to the top.
 */
function CapacityRepsSection({ reps }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const rows = useMemo(() => {
    const byTrack = new Map<CapacityTrack, CapacityRepSummary>();
    for (const r of reps) byTrack.set(r.track, r);

    const filled = TRACK_ORDER.map((track) => {
      const existing = byTrack.get(track);
      return existing ?? {
        track,
        count: 0,
        fullCount: 0,
        smallerCount: 0,
        tinyCount: 0,
        lastCompletedAt: null,
      };
    });

    // Non-zero first, sorted by count desc; zeros in canonical order after.
    return filled.sort((a, b) => {
      if ((a.count > 0) !== (b.count > 0)) return a.count > 0 ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      return TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track);
    });
  }, [reps]);

  const totalReps = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  if (totalReps === 0) {
    return (
      <View style={s.container}>
        <Text style={s.emptyText}>
          Your capacity map fills in as you complete reps. Nothing to prove yet — just start.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {rows.map((row) => {
        const isZero = row.count === 0;
        const gentlerCount = row.smallerCount + row.tinyCount;
        const barWidth = isZero ? 0 : Math.max(4, (row.count / maxCount) * 100);
        return (
          <View key={row.track} style={[s.row, isZero && s.rowZero]}>
            <Text style={[s.label, isZero && s.labelZero]} numberOfLines={1}>
              {CAPACITY_TRACK_LABELS[row.track]}
            </Text>
            <View style={s.barTrack}>
              <View
                style={[
                  s.barFill,
                  { width: `${barWidth}%` },
                  isZero && s.barFillZero,
                ]}
              />
            </View>
            <Text style={[s.count, isZero && s.countZero]}>
              {row.count}
              {gentlerCount > 0 && (
                <Text style={s.countGentler}>
                  {" "}({row.fullCount} full · {gentlerCount} gentler)
                </Text>
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default React.memo(CapacityRepsSection);

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    rowZero: {
      opacity: 0.35,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      width: 110,
    },
    labelZero: {
      color: colors.text.disabled,
    },
    barTrack: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      overflow: "hidden",
    },
    barFill: {
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.accent.primary,
      opacity: 0.7,
    },
    barFillZero: {
      backgroundColor: "transparent",
    },
    count: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      minWidth: 24,
      textAlign: "right" as const,
    },
    countGentler: {
      fontFamily: fontFamily.mono,
      fontSize: 10,
      fontWeight: fontWeight.regular,
      color: colors.text.disabled,
    },
    countZero: {
      color: colors.text.disabled,
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: 13,
      fontStyle: "italic" as const,
      color: colors.text.secondary,
      lineHeight: 19,
      padding: spacing.md,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderRadius: radius.md,
    },
  });
