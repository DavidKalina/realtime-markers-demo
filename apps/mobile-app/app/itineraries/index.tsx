import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
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
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";

const getStatusBadge = (
  item: ItineraryResponse,
  activeItineraryId: string | null,
  colors: Colors,
): { text: string; color: string } => {
  if (item.id === activeItineraryId) {
    const total = item.items.length;
    const checked = item.items.filter((i) => i.checkedInAt).length;
    if (checked === total && total > 0) {
      return { text: "Complete", color: colors.status.success.text };
    }
    return {
      text: `${checked}/${total} stops`,
      color: colors.status.success.text,
    };
  }
  return { text: item.city, color: colors.text.secondary };
};

// --- List Item ---

interface ItineraryListItemProps {
  item: ItineraryResponse;
  index: number;
  activeItineraryId: string | null;
  onPress: (id: string) => void;
}

const STAGGER_MS = 50;
const SPRING_CONFIG = { damping: 18, stiffness: 160, mass: 0.8 };

const ItineraryListItem: React.FC<ItineraryListItemProps> = React.memo(
  ({ item, index, activeItineraryId, onPress }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const scale = useSharedValue(1);
    const entrance = useSharedValue(0);
    const isActive = item.id === activeItineraryId;

    useEffect(() => {
      const delay = Math.min(index, 10) * STAGGER_MS;
      entrance.value = withDelay(
        delay,
        withSpring(1, SPRING_CONFIG),
      );
    }, []);

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

    const entranceStyle = useAnimatedStyle(() => ({
      opacity: interpolate(entrance.value, [0, 0.5, 1], [0, 0.6, 1]),
      transform: [
        { translateY: interpolate(entrance.value, [0, 1], [24, 0]) },
        { scale: interpolate(entrance.value, [0, 1], [0.97, 1]) },
      ],
    }));

    const pressStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const statusBadge = useMemo(
      () => getStatusBadge(item, activeItineraryId, colors),
      [item, activeItineraryId, colors],
    );

    const meta = useMemo(() => {
      const parts: string[] = [];
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

    return (
      <Animated.View style={entranceStyle}>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.row, pressStyle]}>
            <Text style={styles.emoji}>{firstEmoji}</Text>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title || "Untitled Plan"}
                </Text>
                {isActive && (
                  <View style={styles.activeDot} />
                )}
                <Text
                  style={[styles.statusBadge, { color: statusBadge.color }]}
                >
                  {statusBadge.text}
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
  const activeItineraryId = useActiveItineraryStore((s) => s.itinerary?.id ?? null);

  const PAGE_SIZE = 20;
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const fetchItineraries = useCallback(async (cursor?: string) => {
    try {
      const { data, nextCursor } = await apiClient.itineraries.list(
        PAGE_SIZE,
        cursor,
      );
      const filtered = data.filter((it) => it.status !== "GENERATING");
      cursorRef.current = nextCursor;
      hasMoreRef.current = nextCursor !== null;

      if (cursor) {
        setItineraries((prev) => [...prev, ...filtered]);
      } else {
        setItineraries(filtered);
      }
    } catch (err) {
      console.error("[Itineraries] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
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
    cursorRef.current = null;
    hasMoreRef.current = true;
    fetchItineraries();
  }, [fetchItineraries]);

  const handleLoadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    fetchItineraries(cursorRef.current ?? undefined);
  }, [fetchItineraries, isLoadingMore, isLoading]);

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
      <ItineraryListItem
        item={item}
        index={index}
        activeItineraryId={activeItineraryId}
        onPress={handlePress}
      />
    ),
    [handlePress, activeItineraryId],
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
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              style={{ paddingVertical: spacing.lg }}
              color={colors.text.secondary}
            />
          ) : null
        }
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
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
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.status.success.text,
    },
    statusBadge: {
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
