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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import Screen from "@/components/Layout/Screen";
import EmptyState from "@/components/Layout/EmptyState";
import QuestDialogBox from "@/components/Quest/QuestDialogBox";
import QuestCardDeck from "@/components/Itinerary/QuestCardDeck";
import { apiClient } from "@/services/ApiClient";
import type {
  ItineraryResponse,
  SidequestResponse,
} from "@/services/api/modules/sidequests";
import {
  useColors,
  fontFamily,
  fontWeight,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useJobProgressContext } from "@/contexts/JobProgressContext";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import type { SidequestJobCompletedEvent } from "@/services/EventBroker";

const PENDING_GENERATION_KEY = "pendingGenerationParentId";

// --- Options overlay (fan-out after generation) ---

const OPTIONS_TIMEOUT = 90_000; // 90 seconds before giving up on polling

const OptionsOverlay: React.FC<{
  parentId: string;
  visible: boolean;
  onSelected: (selected?: SidequestResponse) => void;
  colors: Colors;
  mockOptions?: SidequestResponse[];
}> = React.memo(({ parentId, visible, onSelected, colors, mockOptions }) => {
  const [options, setOptions] = useState<SidequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !parentId) return;

    // Reset state when overlay becomes visible
    setTimedOut(false);
    setIsLoading(true);
    setIsSelecting(false);
    setOptions([]);

    if (mockOptions) {
      setOptions(mockOptions);
      setIsLoading(false);
      return;
    }

    // Set a timeout so we don't poll forever
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setTimedOut(true);
      setIsLoading(false);
    }, OPTIONS_TIMEOUT);

    // Fetch options immediately, then poll until all are resolved
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const fetchOptions = async () => {
      try {
        // Check parent status — if it failed or was deleted (user already
        // selected), bail immediately instead of spinning for 90s.
        let parentGone = false;
        try {
          const parent = await apiClient.sidequests.getById(parentId);
          if (parent.status === "FAILED") {
            stopPolling();
            setTimedOut(true);
            setIsLoading(false);
            return;
          }
        } catch {
          // 404 = parent was soft-deleted (user already selected a card)
          parentGone = true;
        }

        const result = await apiClient.sidequests.getOptions(parentId);
        const opts = result.data ?? [];

        if (parentGone && opts.length === 0) {
          stopPolling();
          setIsLoading(false);
          onSelected();
          return;
        }

        if (opts.length > 0) {
          setOptions(opts);
          setIsLoading(false);
          // Stop polling when all options are resolved (READY or FAILED)
          const allResolved = opts.every(
            (o: SidequestResponse) =>
              o.status === "READY" || o.status === "FAILED",
          );
          if (allResolved) {
            stopPolling();
          }
        }
      } catch {
        // Keep polling on network errors
      }
    };

    fetchOptions();
    pollRef.current = setInterval(fetchOptions, 2500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, parentId, mockOptions]);

  const handleSelect = useCallback(
    async (option: SidequestResponse) => {
      if (isSelecting || option.status !== "READY") return;
      setIsSelecting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        if (!mockOptions) {
          await apiClient.sidequests.selectOption(option.id);
        }
        onSelected(option);
      } catch (err) {
        console.error("[OptionsOverlay] Failed to select:", err);
        setIsSelecting(false);
      }
    },
    [isSelecting, onSelected, mockOptions],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {visible && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={overlayStyles.container}
        >
          <BlurView
            tint="dark"
            intensity={60}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={overlayStyles.content}>
            {isLoading && !timedOut ? (
              <View style={overlayStyles.loading}>
                <ActivityIndicator color="#86efac" size="large" />
                <Text
                  style={[
                    overlayStyles.loadingText,
                    { color: colors.text.secondary },
                  ]}
                >
                  Revealing your options...
                </Text>
                <Pressable
                  style={[
                    overlayStyles.dismissBtn,
                    { borderColor: colors.border.default },
                  ]}
                  onPress={onSelected}
                >
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontFamily: fontFamily.mono,
                      fontSize: 12,
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            ) : timedOut ||
              options.length === 0 ||
              options.every((o) => o.status === "FAILED") ? (
              <View style={overlayStyles.loading}>
                <Text style={{ fontSize: 48 }}>{"\u{1F61E}"}</Text>
                <Text
                  style={[
                    overlayStyles.loadingText,
                    { color: colors.text.secondary },
                  ]}
                >
                  Generation failed. Try again!
                </Text>
                <Pressable
                  style={[
                    overlayStyles.dismissBtn,
                    { borderColor: colors.border.default },
                  ]}
                  onPress={onSelected}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontFamily: fontFamily.mono,
                    }}
                  >
                    Dismiss
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <QuestCardDeck
                  options={options}
                  onSelect={handleSelect}
                  isSelecting={isSelecting}
                />
                <Pressable
                  style={[
                    overlayStyles.dismissBtn,
                    {
                      borderColor: colors.border.default,
                      marginTop: spacing.lg,
                    },
                  ]}
                  onPress={onSelected}
                >
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontFamily: fontFamily.mono,
                      fontSize: 12,
                    }}
                  >
                    Dismiss
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      )}
    </Modal>
  );
});

OptionsOverlay.displayName = "OptionsOverlay";

const overlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  loading: {
    alignItems: "center",
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamily.mono,
  },
  dismissBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
});

// --- Screen ---

const ItinerariesListScreen = () => {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  const {
    isGenerating,
    activeItineraryId: activeJobItineraryId,
    hasReady,
    clearReady,
  } = useJobProgressContext();
  const activeItineraryId = useActiveItineraryStore(
    (s) => s.itinerary?.id ?? null,
  );

  // --- Options overlay state ---
  const [showOptions, setShowOptions] = useState(false);
  const optionsParentId = useRef<string | null>(null);

  const PAGE_SIZE = 20;
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const fetchItineraries = useCallback(async (cursor?: string) => {
    try {
      const result = await apiClient.sidequests.list(PAGE_SIZE, cursor);
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
    }
  }, []);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  // When a job completes (via push notification or SSE), open the fan-out
  // overlay so the user can pick one of the 3 generated options.
  // Skip if the user already selected a card (no remaining options).
  useEffect(() => {
    return eventBroker.on<SidequestJobCompletedEvent>(
      EventTypes.SIDEQUEST_JOB_COMPLETED,
      async (event) => {
        fetchItineraries();
        if (event.itineraryId) {
          try {
            const result = await apiClient.sidequests.getOptions(
              event.itineraryId,
            );
            const opts = result.data ?? [];
            if (opts.length === 0) return;
          } catch {
            return;
          }
          optionsParentId.current = event.itineraryId;
          setShowOptions(true);
        }
      },
    );
  }, [fetchItineraries]);

  // Show options overlay immediately when generation starts
  useEffect(() => {
    if (isGenerating && activeJobItineraryId) {
      optionsParentId.current = activeJobItineraryId;
      setShowOptions(true);
    }
  }, [isGenerating, activeJobItineraryId]);

  // Resume pending generation after app restart — check AsyncStorage for a
  // parentId saved when generation was triggered. If found, re-open the
  // overlay so it resumes polling until all options resolve.
  useEffect(() => {
    (async () => {
      try {
        const parentId = await AsyncStorage.getItem(PENDING_GENERATION_KEY);
        if (!parentId) return;
        const result = await apiClient.sidequests.getOptions(parentId);
        const opts = result.data ?? [];
        if (opts.length === 0) {
          await AsyncStorage.removeItem(PENDING_GENERATION_KEY);
          return;
        }
        optionsParentId.current = parentId;
        setShowOptions(true);
      } catch {
        AsyncStorage.removeItem(PENDING_GENERATION_KEY).catch(() => {});
      }
    })();
  }, []);

  const handleOptionSelected = useCallback(
    (selected?: SidequestResponse) => {
      setShowOptions(false);
      clearReady();
      // Optimistically prepend the selected card so it appears immediately
      // in browse mode without waiting for the backend round-trip.
      if (selected) {
        setItineraries((prev) => [selected, ...prev]);
      }
      // Still re-fetch in background to reconcile with the actual server state
      // (the backend promotes the child → parent, so IDs/fields may shift).
      setTimeout(() => fetchItineraries(), 800);
      AsyncStorage.removeItem(PENDING_GENERATION_KEY).catch(() => {});
    },
    [clearReady, fetchItineraries],
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

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  // --- DEV: Simulation mode ---
  const [simulating, setSimulating] = useState(false);
  const [simShowOptions, setSimShowOptions] = useState(false);

  // Ready versions of the mock options (with full content)
  const MOCK_READY = {
    quick: {
      id: "sim-quick",
      city: "San Francisco",
      budgetMax: 30,
      activityTypes: ["coffee", "walk"],
      categories: ["outdoor", "caffeine", "morning"],
      title: "Morning Buzz Walk",
      summary: "Quick caffeine hit and a stroll through the park",
      status: "READY" as const,
      tier: "QUICK" as const,
      children: [],
      createdAt: new Date().toISOString(),
      objectives: [
        {
          id: "q1",
          sortOrder: 0,
          title: "Coffee Stop",
          emoji: "\u2615",
          venueName: "Blue Bottle Coffee",
          venueAddress: "315 Linden St",
          venueCategory: "cafe",
          hook: "Best pour-over in Hayes Valley",
          estimatedCost: 6,
        },
        {
          id: "q2",
          sortOrder: 1,
          title: "Park Walk",
          emoji: "\u{1F33F}",
          venueName: "Golden Gate Park",
          venueAddress: "Golden Gate Park",
          venueCategory: "park",
          hook: "Morning fog through the eucalyptus grove",
          estimatedCost: 0,
        },
      ],
    },
    sweet: {
      id: "sim-sweet",
      city: "San Francisco",
      budgetMax: 50,
      activityTypes: ["food", "explore"],
      categories: ["culture", "neighborhood", "brunch"],
      title: "Mission District Drift",
      summary: "Pastries, murals, and a sunny park hang",
      status: "READY" as const,
      tier: "SWEET_SPOT" as const,
      children: [],
      createdAt: new Date().toISOString(),
      objectives: [
        {
          id: "s1",
          sortOrder: 0,
          title: "Pastry Run",
          emoji: "\u{1F950}",
          venueName: "Tartine Bakery",
          venueAddress: "600 Guerrero St",
          venueCategory: "bakery",
          hook: "The morning bun is legendary",
          estimatedCost: 12,
        },
        {
          id: "s2",
          sortOrder: 1,
          title: "Park Hang",
          emoji: "\u{1F3DE}\u{FE0F}",
          venueName: "Mission Dolores Park",
          venueAddress: "Dolores St & 19th",
          venueCategory: "park",
          hook: "Best city skyline view from the hilltop",
          estimatedCost: 0,
        },
      ],
    },
    best: {
      id: "sim-best",
      city: "San Francisco",
      budgetMax: 80,
      activityTypes: ["food", "drinks", "culture"],
      categories: ["nightlife", "waterfront", "premium"],
      title: "Full Send: Fort Mason to Mission",
      summary: "Cocktails, ice cream, and a waterfront sunset",
      status: "READY" as const,
      tier: "BEST" as const,
      children: [],
      createdAt: new Date().toISOString(),
      objectives: [
        {
          id: "b1",
          sortOrder: 0,
          title: "Cocktail Hour",
          emoji: "\u{1F378}",
          venueName: "The Interval",
          venueAddress: "Fort Mason Center",
          venueCategory: "cocktail bar",
          hook: "Craft cocktails inside a library of civilization",
          estimatedCost: 18,
        },
        {
          id: "b2",
          sortOrder: 1,
          title: "Sweet Finish",
          emoji: "\u{1F366}",
          venueName: "Bi-Rite Creamery",
          venueAddress: "3692 18th St",
          venueCategory: "ice cream",
          hook: "Salted caramel soft serve, need I say more",
          estimatedCost: 8,
        },
      ],
    },
  };

  // Start with 3 GENERATING skeleton cards, resolve them one by one
  const [MOCK_OPTIONS, setMockOptions] = useState<SidequestResponse[]>([
    {
      id: "sim-quick",
      status: "GENERATING" as const,
      tier: "QUICK" as const,
      city: "San Francisco",
      budgetMax: 30,
      activityTypes: [],
      objectives: [],
      children: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "sim-sweet",
      status: "GENERATING" as const,
      tier: "SWEET_SPOT" as const,
      city: "San Francisco",
      budgetMax: 50,
      activityTypes: [],
      objectives: [],
      children: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "sim-best",
      status: "GENERATING" as const,
      tier: "BEST" as const,
      city: "San Francisco",
      budgetMax: 80,
      activityTypes: [],
      objectives: [],
      children: [],
      createdAt: new Date().toISOString(),
    },
  ] as unknown as SidequestResponse[]);

  const startSimulation = useCallback(() => {
    // Reset to generating skeletons
    setMockOptions([
      {
        id: "sim-quick",
        status: "GENERATING",
        tier: "QUICK",
        city: "San Francisco",
        budgetMax: 30,
        activityTypes: [],
        objectives: [],
        children: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: "sim-sweet",
        status: "GENERATING",
        tier: "SWEET_SPOT",
        city: "San Francisco",
        budgetMax: 50,
        activityTypes: [],
        objectives: [],
        children: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: "sim-best",
        status: "GENERATING",
        tier: "BEST",
        city: "San Francisco",
        budgetMax: 80,
        activityTypes: [],
        objectives: [],
        children: [],
        createdAt: new Date().toISOString(),
      },
    ] as unknown as SidequestResponse[]);

    setSimulating(true);
    setSimShowOptions(true);

    // Resolve cards one by one with staggered delays
    setTimeout(() => {
      setMockOptions((prev) =>
        prev.map((o) =>
          o.id === "sim-quick"
            ? (MOCK_READY.quick as unknown as SidequestResponse)
            : o,
        ),
      );
    }, 4000);
    setTimeout(() => {
      setMockOptions((prev) =>
        prev.map((o) =>
          o.id === "sim-sweet"
            ? (MOCK_READY.sweet as unknown as SidequestResponse)
            : o,
        ),
      );
    }, 7000);
    setTimeout(() => {
      setMockOptions((prev) =>
        prev.map((o) =>
          o.id === "sim-best"
            ? (MOCK_READY.best as unknown as SidequestResponse)
            : o,
        ),
      );
    }, 10000);
  }, []);

  const handleSimOptionSelected = useCallback(
    (selected?: SidequestResponse) => {
      setSimShowOptions(false);
      setSimulating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (selected) {
        setItineraries((prev) => [selected, ...prev]);
      }
    },
    [],
  );

  const effectiveShowOptions = simulating ? simShowOptions : showOptions;

  // --- Render ---

  if (isLoading) {
    return (
      <Screen
        isScrollable={false}
        showBackButton
        onBack={handleBack}
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
        showBackButton
        onBack={handleBack}
        noAnimation
        bottomContent={<QuestDialogBox style={{ marginBottom: 0 }} />}
      >
        <EmptyState
          emoji={"\u{1F5FA}\u{FE0F}"}
          title="No quests yet"
          subtitle="Create your first sidequest below"
          style={{ justifyContent: "flex-start", paddingTop: spacing["3xl"] }}
        />
        {/* DEV: Simulate generation flow */}
        {__DEV__ && (
          <Pressable
            onPress={startSimulation}
            style={{
              position: "absolute",
              bottom: 80,
              alignSelf: "center",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: "rgba(134, 239, 172, 0.15)",
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: "rgba(134, 239, 172, 0.3)",
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.mono,
                fontSize: 11,
                color: "#86efac",
              }}
            >
              DEV: Simulate Generation
            </Text>
          </Pressable>
        )}
        {/* Options overlay (works from any screen state since it's a Modal) */}
        {simulating ? (
          <OptionsOverlay
            parentId="__sim__"
            visible={effectiveShowOptions}
            onSelected={handleSimOptionSelected}
            colors={colors}
            mockOptions={MOCK_OPTIONS}
          />
        ) : (
          <OptionsOverlay
            parentId={optionsParentId.current ?? ""}
            visible={effectiveShowOptions}
            onSelected={handleOptionSelected}
            colors={colors}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      isScrollable={false}
      showBackButton
      onBack={handleBack}
      noAnimation
      bottomContent={<QuestDialogBox style={{ marginBottom: 0 }} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>YOUR QUESTS</Text>
        <Text style={styles.headerHint}>
          Swipe to browse {"\u00B7"} Tap to open {"\u00B7"} Hold to delete
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
          onDiscardComplete={handleDiscardComplete}
        />

        {/* DEV: Simulate generation flow */}
        {__DEV__ && (
          <Pressable
            onPress={startSimulation}
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: "rgba(134, 239, 172, 0.15)",
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: "rgba(134, 239, 172, 0.3)",
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.mono,
                fontSize: 11,
                color: "#86efac",
              }}
            >
              DEV: Simulate Generation
            </Text>
          </Pressable>
        )}
      </View>

      {/* Options fan-out overlay */}
      {simulating ? (
        <OptionsOverlay
          parentId="__sim__"
          visible={effectiveShowOptions}
          onSelected={handleSimOptionSelected}
          colors={colors}
          mockOptions={MOCK_OPTIONS}
        />
      ) : (
        <OptionsOverlay
          parentId={optionsParentId.current ?? ""}
          visible={effectiveShowOptions}
          onSelected={handleOptionSelected}
          colors={colors}
        />
      )}
    </Screen>
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
      color: colors.text.primary,
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
      justifyContent: "center",
    },
  });
