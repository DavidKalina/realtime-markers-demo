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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated";
import Screen from "@/components/Layout/Screen";
import EmptyState from "@/components/Layout/EmptyState";
import QuestCardDeck from "@/components/Itinerary/QuestCardDeck";
import BatchRevealOverlay from "@/components/Quest/BatchRevealOverlay";
import { apiClient } from "@/services/ApiClient";
import type {
  ItineraryResponse,
  SidequestResponse,
} from "@/services/api/modules/sidequests";
import {
  useColors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";

// --- Screen ---

const ItinerariesListScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  const activeItineraryId = useActiveItineraryStore(
    (s) => s.itinerary?.id ?? null,
  );

  const PAGE_SIZE = 20;
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [batchDiscardingIds, setBatchDiscardingIds] = useState<Set<string> | null>(null);
  const batchDiscardCount = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const fetchItineraries = useCallback(async (cursor?: string) => {
    try {
      const result = await apiClient.sidequests.list(PAGE_SIZE, cursor);
      const filtered = (result.data ?? []).filter(
        (it) => it.status !== "GENERATING" && !it.completedAt,
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
    }
  }, []);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  // Batch reveal state — shown when auto-prescribed quests arrive
  const [revealQuests, setRevealQuests] = useState<SidequestResponse[]>([]);

  const handleBatchRevealComplete = useCallback(
    (acceptedIds: string[]) => {
      setRevealQuests([]);
      fetchItineraries();
      // Navigate to the first accepted quest
      if (acceptedIds.length > 0) {
        router.push(`/itineraries/${acceptedIds[0]}`);
      }
    },
    [fetchItineraries, router],
  );

  const totalCards = itineraries.length;

  const handlePress = useCallback(
    (option: SidequestResponse) => {
      router.push({
        pathname: "/itineraries/[id]" as const,
        params: { id: option.id },
      });
    },
    [router],
  );

  const handleDelete = useCallback((option: SidequestResponse) => {
    const title = option.title || "this sidequest";

    Alert.alert("Delete sidequest", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDiscardingId(option.id);
        },
      },
    ]);
  }, []);

  const handleDiscardComplete = useCallback(
    async (id: string) => {
      setDiscardingId(null);
      setItineraries((prev) => prev.filter((it) => it.id !== id));
      try {
        await apiClient.sidequests.deleteById(id);
      } catch (err) {
        console.error("[Itineraries] Failed to delete:", err);
        fetchItineraries();
      }
    },
    [fetchItineraries],
  );

  const handleToggleMarkForDelete = useCallback(
    (option: SidequestResponse) => {
      setMarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(option.id)) {
          next.delete(option.id);
        } else {
          next.add(option.id);
        }
        return next;
      });
    },
    [],
  );

  const handleBatchDelete = useCallback(() => {
    const ids = Array.from(markedIds);
    if (ids.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    batchDiscardCount.current = 0;
    setBatchDiscardingIds(new Set(ids));
  }, [markedIds]);

  const handleBatchDiscardComplete = useCallback(
    (id: string) => {
      batchDiscardCount.current += 1;
      const totalExpected = batchDiscardingIds?.size ?? 0;
      if (batchDiscardCount.current >= totalExpected) {
        const ids = Array.from(batchDiscardingIds!);
        setBatchDiscardingIds(null);
        setMarkedIds(new Set());
        setItineraries((prev) => prev.filter((it) => !ids.includes(it.id)));
        apiClient.sidequests.batchDelete(ids).catch((err) => {
          console.error("[Itineraries] Batch delete failed:", err);
          fetchItineraries();
        });
      }
    },
    [batchDiscardingIds, fetchItineraries],
  );

  const handleClearMarked = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMarkedIds(new Set());
  }, []);

  // --- Render ---

  if (isLoading) {
    return (
      <Screen
        isScrollable={false}
        showBackButton={false}
        noAnimation
      >
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (totalCards === 0) {
    return (
      <Screen
        isScrollable={false}
        showBackButton={false}
        noAnimation
      >
        <EmptyState
          emoji={"\u{1F5FA}\u{FE0F}"}
          title="No quests yet"
          subtitle="Your next quests are on the way"
          style={{ justifyContent: "flex-start", paddingTop: spacing["3xl"] }}
        />
      </Screen>
    );
  }

  return (
    <>
    <Screen
      isScrollable={false}
      showBackButton={false}
      noAnimation
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>YOUR QUESTS</Text>
        <Text style={styles.headerHint}>
          {markedIds.size > 0
            ? `${markedIds.size} selected \u00B7 Swipe up to mark more`
            : `Swipe to browse \u00B7 Tap to open \u00B7 Swipe up to mark`}
        </Text>
      </View>
      <View style={styles.deckScreen}>
        <QuestCardDeck
          options={itineraries}
          mode="browse"
          hideHeader
          activeItineraryId={activeItineraryId}
          onPress={handlePress}
          onDelete={handleDelete}
          discardingId={discardingId}
          onDiscardComplete={
            batchDiscardingIds
              ? handleBatchDiscardComplete
              : handleDiscardComplete
          }
          markedForDeleteIds={markedIds.size > 0 ? markedIds : null}
          onToggleMarkForDelete={handleToggleMarkForDelete
          }
          batchDiscardingIds={batchDiscardingIds}
        />

      </View>

      {/* Batch-delete action bar */}
      {markedIds.size > 0 && !batchDiscardingIds && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          exiting={FadeOutUp.duration(150)}
          style={styles.deleteBar}
        >
          <Text style={styles.deleteBarText}>
            {markedIds.size} selected
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleClearMarked} style={styles.deleteBarClear}>
            <Text style={styles.deleteBarClearText}>Clear</Text>
          </Pressable>
          <Pressable onPress={handleBatchDelete} style={styles.deleteBarButton}>
            <Text style={styles.deleteBarButtonText}>Delete All</Text>
          </Pressable>
        </Animated.View>
      )}

    </Screen>

    <BatchRevealOverlay
      visible={revealQuests.length > 0}
      quests={revealQuests}
      onComplete={handleBatchRevealComplete}
    />

    </>
  );
};

export default ItinerariesListScreen;

// --- Screen styles ---

const createScreenStyles = (colors: Colors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
    },
    headerLabel: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#86efac",
      letterSpacing: 1.5,
    },
    headerHint: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    deckScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: spacing["2xl"],
    },
    deleteBar: {
      position: "absolute" as const,
      bottom: 20,
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: "rgba(30, 30, 30, 0.9)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
    deleteBarText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.primary,
      fontWeight: fontWeight.bold,
    },
    deleteBarClear: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    deleteBarClearText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      color: colors.text.secondary,
    },
    deleteBarButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: "rgba(239, 68, 68, 0.85)",
    },
    deleteBarButtonText: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: "#fff",
    },
  });
