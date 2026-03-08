import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Settings } from "lucide-react-native";
import { scheduleOnRN } from "react-native-worklets";
import Screen from "@/components/Layout/Screen";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import {
  useColors,
  fontFamily,
  fontWeight,
  fontSize,
  spacing,
  type Colors,
} from "@/theme";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";

const getDateBadge = (
  plannedDate: string,
  colors: Colors,
): { text: string; color: { text: string; bg: string } } => {
  const now = new Date();
  const date = new Date(plannedDate + "T00:00:00");
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const badgeColors = {
    live: { text: colors.status.success.text, bg: colors.status.success.border },
    soon: { text: colors.status.warning.text, bg: colors.status.warning.border },
    today: { text: colors.status.info.text, bg: colors.status.info.border },
    upcoming: { text: colors.text.secondary, bg: colors.border.subtle },
    past: { text: colors.text.disabled, bg: colors.border.subtle },
  };

  if (diffDays < 0) return { text: "Past", color: badgeColors.past };
  if (diffDays === 0) return { text: "Today", color: badgeColors.live };
  if (diffDays === 1) return { text: "Tomorrow", color: badgeColors.soon };
  if (diffDays <= 7) return { text: `In ${diffDays}d`, color: badgeColors.today };
  return {
    text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    color: badgeColors.upcoming,
  };
};

// --- List Item ---

interface ItineraryListItemProps {
  item: ItineraryResponse;
  index: number;
  onPress: (id: string) => void;
}

const ItineraryListItem: React.FC<ItineraryListItemProps> = React.memo(
  ({ item, index, onPress }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const scale = useSharedValue(1);

    const navigate = useCallback(() => {
      onPress(item.id);
    }, [item.id, onPress]);

    const handlePress = useCallback(() => {
      scale.value = withSequence(
        withTiming(0.97, { duration: 80 }),
        withTiming(1, { duration: 100 }, () => {
          scheduleOnRN(navigate);
        }),
      );
    }, [navigate, scale]);

    const animatedScaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const dateBadge = useMemo(
      () => getDateBadge(item.plannedDate, colors),
      [item.plannedDate, colors],
    );

    const meta = useMemo(() => {
      const parts: string[] = [];
      parts.push(item.city);
      parts.push(`${item.durationHours}h`);
      const stops = (item.items ?? []).length;
      if (stops > 0) parts.push(`${stops} stops`);
      const totalCost = (item.items ?? []).reduce(
        (sum, i) => sum + (Number(i.estimatedCost) || 0),
        0,
      );
      if (totalCost > 0) parts.push(`~$${totalCost.toFixed(0)}`);
      return parts.join(" · ");
    }, [item]);

    const firstEmoji = useMemo(() => {
      const items = item.items ?? [];
      for (const i of items) {
        if (i.emoji) return i.emoji;
      }
      return "🗺️";
    }, [item.items]);

    const cappedDelay = Math.min(index, 8) * 30;

    return (
      <Animated.View entering={FadeIn.duration(200).delay(cappedDelay)}>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.row, animatedScaleStyle]}>
            <Text style={styles.emoji}>{firstEmoji}</Text>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title || "Untitled Plan"}
                </Text>
                <Text
                  style={[styles.dateBadge, { color: dateBadge.color.text }]}
                >
                  {dateBadge.text}
                </Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  },
);

ItineraryListItem.displayName = "ItineraryListItem";

// --- Generating Row (mirrors AreaScanBottomSheet JobRow style) ---

const GeneratingRow: React.FC = React.memo(() => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const stepLabel = useItineraryJobStore((s) => s.stepLabel);
  const rotation = useSharedValue(0);
  const barPos = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
    );
    barPos.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: "40%",
    marginLeft: `${barPos.value * 60}%`,
  }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.genRow}>
      <View style={styles.genLeft}>
        <Animated.View style={spinStyle}>
          <Settings size={18} color={colors.accent.primary} strokeWidth={2.5} />
        </Animated.View>
      </View>
      <View style={styles.genCenter}>
        <Text style={styles.genTitle} numberOfLines={1}>
          {stepLabel || "Generating..."}
        </Text>
        <View style={styles.genTrack}>
          <Animated.View style={[styles.genBar, barStyle, { backgroundColor: colors.accent.primary }]} />
        </View>
      </View>
    </Animated.View>
  );
});

GeneratingRow.displayName = "GeneratingRow";

// --- Screen ---

const ItinerariesListScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isGenerating = useItineraryJobStore((s) => !!s.activeJobId);
  const hasReady = useItineraryJobStore((s) => s.hasReady);
  const clearReady = useItineraryJobStore((s) => s.clearReady);

  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchItineraries = useCallback(async () => {
    try {
      const data = await apiClient.itineraries.list(50);
      setItineraries(data.filter((it) => it.status !== "GENERATING"));
    } catch (err) {
      console.error("[Itineraries] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  useEffect(() => {
    if (hasReady) {
      clearReady();
      fetchItineraries();
    }
  }, [hasReady, clearReady, fetchItineraries]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchItineraries();
  }, [fetchItineraries]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePress = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ItineraryResponse; index: number }) => (
      <ItineraryListItem item={item} index={index} onPress={handlePress} />
    ),
    [handlePress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>No plans yet</Text>
        <Text style={styles.emptySubtitle}>
          Visit a city and tap "Plan your day" to create one
        </Text>
      </View>
    );
  }, [isLoading, styles]);

  return (
    <Screen
      isScrollable={false}
      bannerTitle="Plans"
      bannerDescription="Your itineraries"
      showBackButton
      onBack={handleBack}
      noAnimation
    >
      <FlatList
        data={itineraries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={isGenerating ? <GeneratingRow /> : null}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.secondary}
          />
        }
      />
    </Screen>
  );
};

export default ItinerariesListScreen;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    list: {
      flexGrow: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing._10,
      paddingHorizontal: spacing.lg,
      gap: spacing._10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    emoji: {
      fontSize: fontSize.lg,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 18,
    },
    dateBadge: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.2,
    },
    meta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 16,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    emptySubtitle: {
      fontFamily: fontFamily.regular,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
      lineHeight: 20,
    },
    genRow: {
      flexDirection: "row",
      alignItems: "center",
      height: 56,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    genLeft: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing._10,
    },
    genCenter: {
      flex: 1,
      justifyContent: "center",
    },
    genTitle: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },
    genTrack: {
      height: 3,
      backgroundColor: colors.border.subtle,
      borderRadius: 1.5,
      marginTop: 4,
      overflow: "hidden",
    },
    genBar: {
      height: 3,
      borderRadius: 1.5,
    },
  });
