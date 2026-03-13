import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Check, Trash2 } from "lucide-react-native";
import { scheduleOnRN } from "react-native-worklets";
import Screen from "@/components/Layout/Screen";
import { usePullToAction } from "@/hooks/usePullToAction";
import EmptyState from "@/components/Layout/EmptyState";
import ItineraryDialogBox from "@/components/Itinerary/ItineraryDialogBox";
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
  if (item.completedAt) {
    const stars = item.rating ? " " + "★".repeat(item.rating) : "";
    return { text: `Completed${stars}`, color: colors.accent.primary };
  }
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
  onDelete: (id: string) => void;
}

const STAGGER_MS = 50;
const SPRING_CONFIG = { damping: 18, stiffness: 160, mass: 0.8 };

const DELETE_ACTION_WIDTH = 80;

const RenderDeleteAction = React.memo(
  ({ onDelete, colors }: { onDelete: () => void; colors: Colors }) => {
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
      <Pressable onPress={onDelete} style={styles.deleteAction}>
        <Trash2 size={20} color="#fff" strokeWidth={2} />
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    );
  },
);

RenderDeleteAction.displayName = "RenderDeleteAction";

const ItineraryListItem: React.FC<ItineraryListItemProps> = React.memo(
  ({ item, index, activeItineraryId, onPress, onDelete }) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const swipeableRef = useRef<any>(null);
    const scale = useSharedValue(1);
    const entrance = useSharedValue(0);
    const isActive = item.id === activeItineraryId;
    const isCompleted = !!item.completedAt;

    useEffect(() => {
      const delay = Math.min(index, 10) * STAGGER_MS;
      entrance.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
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

    const handleDelete = useCallback(() => {
      swipeableRef.current?.close();
      onDelete(item.id);
    }, [item.id, onDelete]);

    const renderRightActions = useCallback(
      () => <RenderDeleteAction onDelete={handleDelete} colors={colors} />,
      [handleDelete, colors],
    );

    const handleSwipeOpen = useCallback((direction: "left" | "right") => {
      if (direction === "right") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, []);

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
        <ReanimatedSwipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          rightThreshold={DELETE_ACTION_WIDTH}
          overshootRight={false}
          onSwipeableWillOpen={handleSwipeOpen}
        >
          <Pressable onPress={handlePress}>
            <Animated.View
              style={[
                styles.row,
                { backgroundColor: colors.bg.primary },
                pressStyle,
              ]}
            >
              <View style={styles.emojiWrap}>
                <Text style={styles.emoji}>{firstEmoji}</Text>
                {isCompleted && (
                  <View
                    style={[
                      styles.completedBadge,
                      { backgroundColor: colors.accent.primary },
                    ]}
                  >
                    <Check size={8} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </View>
              <View style={[styles.info, isCompleted && { opacity: 0.6 }]}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title || "Untitled Plan"}
                  </Text>
                  {isActive && <View style={styles.activeDot} />}
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
        </ReanimatedSwipeable>
      </Animated.View>
    );
  },
);

ItineraryListItem.displayName = "ItineraryListItem";

// --- Generating Row (decrypting / experimenting style) ---

const GEN_EMOJIS = [
  "🗺️",
  "🎯",
  "🎪",
  "🎭",
  "🎨",
  "🎵",
  "🍕",
  "☕",
  "🏛️",
  "🌮",
  "🎸",
  "🍜",
  "🎲",
  "🌿",
  "📸",
  "🛹",
  "🧗",
  "🎤",
  "🍦",
  "🚲",
];

const GEN_TITLES = [
  "Scanning local events…",
  "Geocoding the city…",
  "Searching verified venues…",
  "Scouting nearby trails…",
  "Pulling weather forecast…",
  "Checking what's open…",
  "Filtering by budget…",
  "Building the route…",
  "Verifying addresses…",
  "Cross-referencing stops…",
  "Estimating costs…",
  "Optimizing stop order…",
  "Checking hours of operation…",
  "Mapping coordinates…",
  "Finalizing your plan…",
];

const GEN_METAS = [
  "matching events to your date",
  "finding the best-rated spots",
  "checking trail conditions",
  "avoiding places you've been",
  "confirming venues are open",
  "balancing indoor and outdoor",
  "keeping it within budget",
  "picking the right neighborhoods",
  "verifying with Google Places",
  "routing between stops",
];

const REEL_ITEM_HEIGHT = 24;
const REEL_SPINS = 2;

const EmojiReel: React.FC = React.memo(() => {
  const styles = useMemo(() => {
    return {
      container: {
        height: REEL_ITEM_HEIGHT,
        overflow: "hidden" as const,
      },
      item: {
        height: REEL_ITEM_HEIGHT,
        lineHeight: REEL_ITEM_HEIGHT,
        fontSize: fontSize.lg,
      },
    };
  }, []);

  const translateY = useSharedValue(0);

  const reelEmojis = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < REEL_SPINS + 1; i++) {
      items.push(...GEN_EMOJIS);
    }
    return items;
  }, []);

  const spin = useCallback(() => {
    const landIdx =
      REEL_SPINS * GEN_EMOJIS.length +
      Math.floor(Math.random() * GEN_EMOJIS.length);
    translateY.value = 0;
    translateY.value = withTiming(-landIdx * REEL_ITEM_HEIGHT, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  useEffect(() => {
    spin();
    const timer = setInterval(spin, 2800);
    return () => clearInterval(timer);
  }, [spin]);

  const reelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={reelStyle}>
        {reelEmojis.map((emoji, i) => (
          <Text key={i} style={styles.item}>
            {emoji}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

EmojiReel.displayName = "EmojiReel";

const GeneratingRow: React.FC = React.memo(() => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [titleIdx, setTitleIdx] = useState(0);
  const [metaIdx, setMetaIdx] = useState(0);
  const contentOpacity = useSharedValue(1);

  useEffect(() => {
    const timer = setInterval(() => {
      contentOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 }),
      );
      setTimeout(() => {
        setTitleIdx((i) => (i + 1) % GEN_TITLES.length);
        setMetaIdx((i) => (i + 1) % GEN_METAS.length);
      }, 300);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View style={[styles.row, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.emojiWrap}>
          <EmojiReel />
        </View>
        <View style={styles.info}>
          <View style={[styles.titleRow, { alignItems: "center" }]}>
            <Animated.Text
              style={[styles.title, contentStyle]}
              numberOfLines={1}
            >
              {GEN_TITLES[titleIdx]}
            </Animated.Text>
            <Text
              style={[
                styles.statusBadge,
                { color: colors.status.success.text },
              ]}
            >
              generating
            </Text>
          </View>
          <Animated.Text style={[styles.meta, contentStyle]} numberOfLines={1}>
            {GEN_METAS[metaIdx]}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
});

GeneratingRow.displayName = "GeneratingRow";

// --- Screen ---

const ItinerariesListScreen = () => {
  const router = useRouter();
  const { expand } = useLocalSearchParams<{ expand?: string }>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isGenerating = useItineraryJobStore((s) => !!s.activeJobId);
  const hasReady = useItineraryJobStore((s) => s.hasReady);
  const clearReady = useItineraryJobStore((s) => s.clearReady);
  const activeItineraryId = useActiveItineraryStore(
    (s) => s.itinerary?.id ?? null,
  );

  const PAGE_SIZE = 20;
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const fetchItineraries = useCallback(async (cursor?: string) => {
    try {
      const result = await apiClient.itineraries.list(PAGE_SIZE, cursor);
      const filtered = (result.data ?? []).filter(
        (it) => it.status !== "GENERATING",
      );
      const nextCursor = result.nextCursor ?? null;
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

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/search" as const);
  }, [router]);

  const { pullIndicator, scrollProps } = usePullToAction({
    onSearch: handleSearch,
    onRefresh: handleRefresh,
    isRefreshing,
  });

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

  const handleDelete = useCallback(
    (id: string) => {
      const itinerary = itineraries.find((it) => it.id === id);
      const isActiveItem = id === activeItineraryId;
      const title = itinerary?.title || "this itinerary";

      Alert.alert(
        "Delete itinerary",
        `Are you sure you want to delete "${title}"?${isActiveItem ? " This is your active itinerary." : ""}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              setItineraries((prev) => prev.filter((it) => it.id !== id));
              try {
                await apiClient.itineraries.deleteById(id);
              } catch (err) {
                console.error("[Itineraries] Failed to delete:", err);
                fetchItineraries();
              }
            },
          },
        ],
      );
    },
    [itineraries, activeItineraryId, fetchItineraries],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ItineraryResponse; index: number }) => (
      <ItineraryListItem
        item={item}
        index={index}
        activeItineraryId={activeItineraryId}
        onPress={handlePress}
        onDelete={handleDelete}
      />
    ),
    [handlePress, handleDelete, activeItineraryId],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        emoji="🗺️"
        title="No plans yet"
        subtitle={'Visit a city and tap "Plan your adventure" to create one'}
        style={{ justifyContent: "flex-start", paddingTop: spacing["3xl"] }}
      />
    );
  }, [isLoading]);

  return (
    <Screen
      isScrollable={false}
      bannerDescription="Your itineraries"
      showBackButton
      onBack={handleBack}
      noAnimation
      bottomContent={
        <ItineraryDialogBox
          defaultExpanded={expand === "1"}
          style={{ marginBottom: 0 }}
        />
      }
    >
      <Animated.FlatList
        data={itineraries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {pullIndicator}
            {isGenerating ? <GeneratingRow /> : null}
          </>
        }
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
        {...scrollProps}
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
    emojiWrap: {
      position: "relative",
    },
    emoji: {
      fontSize: fontSize.lg,
    },
    completedBadge: {
      position: "absolute",
      bottom: -2,
      right: -4,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.bg.primary,
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
    deleteAction: {
      width: DELETE_ACTION_WIDTH,
      backgroundColor: colors.status.error.text,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deleteText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "#fff",
    },
  });
