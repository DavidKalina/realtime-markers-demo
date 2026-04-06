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
import { Bell } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import EmptyState from "@/components/Layout/EmptyState";
import QuestCardDeck from "@/components/Itinerary/QuestCardDeck";
import BatchRevealOverlay from "@/components/Quest/BatchRevealOverlay";
import { GoalCheckInModal } from "@/components/GoalCheckIn/GoalCheckInModal";
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

  // ── Goal check-in state ──
  const [goalCheckIn, setGoalCheckIn] = useState<{
    milestone: "early_momentum" | "midpoint" | "approaching" | "final_stretch" | "target_reached";
    journalPrompt: string;
  } | null>(null);
  const [goalPacing, setGoalPacing] = useState<{
    percentElapsed?: number;
    remainingDays?: number;
    completedQuestCount?: number;
    goalTitle?: string;
  } | null>(null);
  const [showGoalCheckIn, setShowGoalCheckIn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [checkIn, pacing] = await Promise.all([
          apiClient.sidequests.getGoalCheckIn(),
          apiClient.sidequests.getGoalPacing(),
        ]);
        if (checkIn.isDue && checkIn.milestone && checkIn.journalPrompt) {
          setGoalCheckIn({
            milestone: checkIn.milestone,
            journalPrompt: checkIn.journalPrompt,
          });
          if (pacing.hasTimeline) {
            setGoalPacing({
              percentElapsed: pacing.percentElapsed,
              remainingDays: pacing.remainingDays,
              completedQuestCount: pacing.completedQuestCount,
            });
          }
        }
      } catch {
        // Non-critical — silently fail
      }
    })();
  }, []);

  const handleGoalCheckInComplete = useCallback(async (journalEntry: string) => {
    setShowGoalCheckIn(false);
    const checkIn = goalCheckIn;
    const pacing = goalPacing;
    setGoalCheckIn(null);

    try {
      await apiClient.sidequests.saveGoalReflection({
        milestone: checkIn?.milestone ?? "unknown",
        journalEntry,
        journalPrompt: checkIn?.journalPrompt,
        percentElapsed: pacing?.percentElapsed,
        remainingDays: pacing?.remainingDays,
        completedQuestCount: pacing?.completedQuestCount,
      });
    } catch (err) {
      console.error("[GoalCheckIn] Failed to save reflection:", err);
    }
  }, [goalCheckIn, goalPacing]);

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
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>YOUR QUESTS</Text>
            <Text style={styles.headerHint}>
              {markedIds.size > 0
                ? `${markedIds.size} selected \u00B7 Swipe up to mark more`
                : `Swipe to browse \u00B7 Tap to open \u00B7 Swipe up to mark`}
            </Text>
          </View>
          <Pressable
            style={styles.bellButton}
            hitSlop={12}
            onPress={() => {
              if (goalCheckIn) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowGoalCheckIn(true);
              }
            }}
          >
            <Bell size={18} color={goalCheckIn ? "#86efac" : colors.text.disabled} />
            {goalCheckIn && <View style={styles.bellDot} />}
          </Pressable>
        </View>
        {__DEV__ && !goalCheckIn && (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            {(["early_momentum", "midpoint", "approaching", "final_stretch", "target_reached"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setGoalCheckIn({
                    milestone: m,
                    journalPrompt: `[DEV] How are you feeling about your goal? (${m})`,
                  });
                  setGoalPacing({
                    percentElapsed: m === "early_momentum" ? 15 : m === "midpoint" ? 50 : m === "approaching" ? 80 : m === "final_stretch" ? 95 : 100,
                    remainingDays: m === "early_momentum" ? 150 : m === "midpoint" ? 90 : m === "approaching" ? 35 : m === "final_stretch" ? 7 : 0,
                    completedQuestCount: 12,
                    goalTitle: "Move to Denver and feel ready to live independently",
                  });
                }}
                style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}
              >
                <Text style={{ fontFamily: fontFamily.mono, fontSize: 8, color: "rgba(59, 130, 246, 0.8)" }}>
                  {m.split("_")[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
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

    {goalCheckIn && (
      <GoalCheckInModal
        visible={showGoalCheckIn}
        milestone={goalCheckIn.milestone}
        journalPrompt={goalCheckIn.journalPrompt}
        goalTitle={goalPacing?.goalTitle}
        percentElapsed={goalPacing?.percentElapsed}
        remainingDays={goalPacing?.remainingDays}
        completedQuestCount={goalPacing?.completedQuestCount}
        onDismiss={() => setShowGoalCheckIn(false)}
        onComplete={handleGoalCheckInComplete}
      />
    )}

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
    headerTop: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: spacing.md,
    },
    bellButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: -2,
    },
    bellDot: {
      position: "absolute" as const,
      top: 6,
      right: 7,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#86efac",
      borderWidth: 1.5,
      borderColor: colors.bg.primary,
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
