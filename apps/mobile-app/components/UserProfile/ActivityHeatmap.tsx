import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import type { ActivityDay } from "@/services/api/modules/profileInsights";

interface ActivityHeatmapProps {
  data: ActivityDay[];
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEKS = 16;
const DAYS = 7;
const DAY_LABELS = ["M", "", "W", "", "F", "", "S"];

function getIntensityColor(count: number, maxCount: number): string {
  if (count === 0) return "transparent";
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio > 0.75) return "#4ade80";
  if (ratio > 0.5) return "#86efac";
  if (ratio > 0.25) return "rgba(134, 239, 172, 0.5)";
  return "rgba(134, 239, 172, 0.25)";
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { grid, maxCount, totalCheckins, activeDays } = useMemo(() => {
    // Build a date->count map
    const dateMap = new Map<string, number>();
    let max = 0;
    let total = 0;
    for (const d of data) {
      dateMap.set(d.date, d.count);
      if (d.count > max) max = d.count;
      total += d.count;
    }

    // Generate grid: 16 weeks x 7 days, ending at today
    const today = new Date();
    const todayDay = today.getDay(); // 0=Sun
    // Adjust to Monday-based: Mon=0, Tue=1, ..., Sun=6
    const todayMondayIdx = todayDay === 0 ? 6 : todayDay - 1;

    // End of grid is today; start is 16 weeks back from the start of this week
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - todayMondayIdx - (WEEKS - 1) * 7);

    const cells: { date: string; count: number }[][] = [];
    let active = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < DAYS; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);

        // Don't show future dates
        if (cellDate > today) {
          week.push({ date: "", count: -1 });
          continue;
        }

        const dateStr = cellDate.toISOString().slice(0, 10);
        const count = dateMap.get(dateStr) || 0;
        if (count > 0) active++;
        week.push({ date: dateStr, count });
      }
      cells.push(week);
    }

    return {
      grid: cells,
      maxCount: max,
      totalCheckins: total,
      activeDays: active,
    };
  }, [data]);

  const isEmpty = data.length === 0 && totalCheckins === 0;

  return (
    <View>
      <Text style={styles.sectionLabel}>ACTIVITY</Text>
      <View style={styles.container}>
        <View style={styles.gridWrapper}>
          {/* Day labels */}
          <View style={styles.dayLabels}>
            {DAY_LABELS.map((label, i) => (
              <Text key={i} style={styles.dayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {grid.map((week, wi) => (
              <View key={wi} style={styles.column}>
                {week.map((cell, di) => (
                  <View
                    key={`${wi}-${di}`}
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          cell.count < 0
                            ? "transparent"
                            : cell.count === 0
                              ? colors.bg.cardAlt
                              : getIntensityColor(cell.count, maxCount),
                        borderColor:
                          cell.count < 0
                            ? "transparent"
                            : colors.border.default,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Summary row */}
        {isEmpty ? (
          <Text style={styles.emptyHint}>
            Check in to stops to fill your activity grid
          </Text>
        ) : (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalCheckins}</Text>
              <Text style={styles.summaryLabel}>check-ins</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeDays}</Text>
              <Text style={styles.summaryLabel}>active days</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={styles.legendLabel}>Less</Text>
              {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
                <View
                  key={i}
                  style={[
                    styles.legendCell,
                    {
                      backgroundColor:
                        intensity === 0
                          ? colors.bg.cardAlt
                          : getIntensityColor(
                              intensity * (maxCount || 1),
                              maxCount || 1,
                            ),
                    },
                  ]}
                />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    container: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: spacing.md,
    },
    gridWrapper: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    dayLabels: {
      justifyContent: "space-between",
      paddingVertical: 1,
    },
    dayLabel: {
      height: CELL_SIZE,
      lineHeight: CELL_SIZE,
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      textAlign: "right",
      width: 12,
    },
    grid: {
      flexDirection: "row",
      gap: CELL_GAP,
      flex: 1,
    },
    column: {
      gap: CELL_GAP,
      flex: 1,
    },
    cell: {
      height: CELL_SIZE,
      borderRadius: 3,
      borderWidth: StyleSheet.hairlineWidth,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryItem: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    summaryValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    summaryLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    legendLabel: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
    legendCell: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    emptyHint: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      textAlign: "center",
    },
  });

export default ActivityHeatmap;
