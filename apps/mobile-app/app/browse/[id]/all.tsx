import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import { apiClient } from "@/services/ApiClient";
import {
  useColors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import type { BrowseItineraryPreview } from "@/services/api/modules/districts";

type SortMode = "popular" | "recent" | "top_rated";

const SORT_TABS: { key: SortMode; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
  { key: "top_rated", label: "Top Rated" },
];

const PAGE_SIZE = 20;
const MAX_EMOJI_PREVIEW = 4;

/* ─── List item ─── */

const BrowseListItem: React.FC<{
  item: BrowseItineraryPreview;
  onPress: (id: string) => void;
}> = React.memo(({ item, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item.id);
  }, [item.id, onPress]);

  const firstEmoji = useMemo(() => {
    for (const i of item.items) {
      if (i.emoji) return i.emoji;
    }
    return "\u{1F5FA}\u{FE0F}";
  }, [item.items]);

  const emojiTrail = useMemo(() => {
    const emojis = item.items
      .slice(1, MAX_EMOJI_PREVIEW + 1)
      .map((i) => i.emoji || "\u{1F4CD}")
      .join(" ");
    const extra = item.itemCount - (MAX_EMOJI_PREVIEW + 1);
    return extra > 0 ? `${emojis} +${extra}` : emojis;
  }, [item.items, item.itemCount]);

  const meta = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${item.itemCount} stops`);
    parts.push(`${item.durationHours}h`);
    if (item.timesAdopted > 0) parts.push(`${item.timesAdopted} tried`);
    return parts.join(" \u00B7 ");
  }, [item]);

  const stars = item.rating
    ? "\u2605".repeat(item.rating) + "\u2606".repeat(5 - item.rating)
    : null;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{firstEmoji}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || "Untitled Adventure"}
          </Text>
          {stars && <Text style={styles.stars}>{stars}</Text>}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {item.creatorFirstName
            ? `by ${item.creatorFirstName}`
            : "by Explorer"}{" "}
          \u00B7 {meta}
        </Text>
        {emojiTrail.length > 0 && (
          <Text style={styles.emojiTrail} numberOfLines={1}>
            {emojiTrail}
          </Text>
        )}
      </View>
      <ChevronRight size={14} color={colors.text.disabled} />
    </Pressable>
  );
});

BrowseListItem.displayName = "BrowseListItem";

/* ─── Screen ─── */

const AllItinerariesScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [itineraries, setItineraries] = useState<BrowseItineraryPreview[]>([]);
  const [districtName, setDistrictName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      if (!id) return;
      try {
        const result = await apiClient.districts.getDetail(id, {
          sort: sortMode,
          limit: PAGE_SIZE,
          cursor,
        });
        if (!districtName && result.district?.name) {
          setDistrictName(result.district.name);
        }
        cursorRef.current = result.nextCursor;
        hasMoreRef.current = result.nextCursor !== null;
        return result.itineraries;
      } catch (err) {
        console.error("Error fetching itineraries:", err);
        return [];
      }
    },
    [id, sortMode, districtName],
  );

  // Initial load + sort change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      cursorRef.current = null;
      hasMoreRef.current = true;
      const items = await fetchPage();
      if (!cancelled) {
        setItineraries(items || []);
        setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMoreRef.current || !cursorRef.current) return;
    setIsLoadingMore(true);
    const items = await fetchPage(cursorRef.current);
    if (items && items.length > 0) {
      setItineraries((prev) => [...prev, ...items]);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, fetchPage]);

  const handlePress = useCallback(
    (itineraryId: string) => {
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: itineraryId },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: BrowseItineraryPreview }) => (
      <BrowseListItem item={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback(
    (item: BrowseItineraryPreview) => item.id,
    [],
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.sortBar}>
        {SORT_TABS.map((tab) => {
          const isActive = sortMode === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.sortButton, isActive && styles.sortButtonActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSortMode(tab.key);
              }}
            >
              <Text
                style={[styles.sortText, isActive && styles.sortTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [sortMode, styles],
  );

  const ListFooter = useMemo(() => {
    if (!isLoadingMore) return <View style={{ height: 120 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.text.secondary} />
      </View>
    );
  }, [isLoadingMore, styles, colors]);

  const ListEmpty = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No adventures in this district yet.</Text>
      </View>
    );
  }, [isLoading, styles]);

  return (
    <Screen
      isScrollable={false}
      bannerDescription={districtName || "All Adventures"}
      noAnimation
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(duration.normal)}
          style={styles.container}
        >
          <FlatList
            data={itineraries}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListEmpty}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </Screen>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    listContent: {
      flexGrow: 1,
    },

    /* Row item */
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
    stars: {
      fontSize: 10,
      color: "#fbbf24",
      letterSpacing: 1,
    },
    meta: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 16,
    },
    emojiTrail: {
      fontSize: 12,
      letterSpacing: 2,
      marginTop: 1,
    },

    /* Sort bar */
    sortBar: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    sortButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    sortButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    sortText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    sortTextActive: {
      color: colors.text.primary,
      fontWeight: fontWeight.semibold,
    },

    /* Footer / empty */
    footerLoader: {
      paddingVertical: spacing["2xl"],
      alignItems: "center",
    },
    emptyContainer: {
      paddingVertical: spacing["3xl"],
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.disabled,
      textAlign: "center",
    },
  });

export default AllItinerariesScreen;
