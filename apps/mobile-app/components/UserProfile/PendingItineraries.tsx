import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { apiClient } from "@/services/ApiClient";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";

interface PendingItinerariesProps {
  onRefetchRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const PendingItineraries: React.FC<PendingItinerariesProps> = ({
  onRefetchRef,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const activeId = useActiveItineraryStore((s) => s.itinerary?.id);

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    try {
      const result = await apiClient.itineraries.list(20);
      const pending = result.data.filter(
        (it) => it.status === "READY" && !it.completedAt && it.id !== activeId,
      );
      setCount(pending.length);
    } catch (err) {
      console.error("[PendingItineraries] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (onRefetchRef) {
      onRefetchRef.current = fetchPending;
    }
  }, [onRefetchRef, fetchPending]);

  if (loading || count === 0) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/itineraries" as const);
  };

  return (
    <Pressable style={styles.row} onPress={handlePress}>
      <Text style={styles.label}>
        {count} {count === 1 ? "adventure" : "adventures"} ready to go
      </Text>
      <ChevronRight size={14} color={colors.text.secondary} />
    </Pressable>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    label: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
    },
  });

export default PendingItineraries;
