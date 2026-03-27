import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { apiClient } from "@/services/ApiClient";
import {
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  useColors,
  type Colors,
} from "@/theme";

const MAX_PER_DAY = 3;

interface DailyQuotaProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const DailyQuota: React.FC<DailyQuotaProps> = ({ onRefetchRef }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [usedToday, setUsedToday] = useState<number | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const result = await apiClient.sidequests.list(50);
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const count = result.data.filter(
        (it) => new Date(it.createdAt).getTime() >= since,
      ).length;
      setUsedToday(count);
    } catch {
      // Silently fail — quota display is informational
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchQuota;
    }
  }, [onRefetchRef, fetchQuota]);

  if (usedToday === null) return null;

  const remaining = Math.max(0, MAX_PER_DAY - usedToday);
  const pct = usedToday / MAX_PER_DAY;
  const barColor =
    pct >= 1
      ? colors.status.error.text
      : pct >= 0.67
        ? colors.status.warning.text
        : colors.accent.primary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>DAILY ITINERARIES</Text>
        <Text style={[styles.count, { color: barColor }]}>
          {remaining}/{MAX_PER_DAY} remaining
        </Text>
      </View>
      <View style={styles.trackOuter}>
        {Array.from({ length: MAX_PER_DAY }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.trackSegment,
              {
                backgroundColor:
                  i < usedToday ? barColor : colors.bg.cardAlt,
              },
              i === 0 && styles.trackFirst,
              i === MAX_PER_DAY - 1 && styles.trackLast,
            ]}
          />
        ))}
      </View>
      {remaining === 0 && (
        <Text style={styles.limitText}>
          Limit reached — resets in 24h from your oldest creation today
        </Text>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
    },
    count: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    trackOuter: {
      flexDirection: "row",
      gap: 3,
      height: 6,
    },
    trackSegment: {
      flex: 1,
      borderRadius: 1,
    },
    trackFirst: {
      borderTopLeftRadius: radius.sm,
      borderBottomLeftRadius: radius.sm,
    },
    trackLast: {
      borderTopRightRadius: radius.sm,
      borderBottomRightRadius: radius.sm,
    },
    limitText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: 2,
    },
  });

export default DailyQuota;
