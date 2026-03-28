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
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
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
  fontSize,
  spacing,
  radius,
  type Colors,
} from "@/theme";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useJobProgress } from "@/hooks/useJobProgress";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import type { SidequestJobCompletedEvent } from "@/services/EventBroker";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH * 0.82;
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const CARD_VERTICAL_OFFSET = 12;
const CARD_SCALE_STEP = 0.04;
const BOB_AMPLITUDE = 3;
const BOB_DURATION = 2600;

// --- Single sidequest card ---

const SidequestCard: React.FC<{
  item: ItineraryResponse;
  index: number;
  totalCards: number;
  activeIndex: SharedValue<number>;
  swipeX: SharedValue<number>;
  activeItineraryId: string | null;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
  colors: Colors;
}> = React.memo(
  ({
    item,
    index,
    totalCards,
    activeIndex,
    swipeX,
    activeItineraryId,
    onPress,
    onDelete,
    colors,
  }) => {
    const s = useMemo(() => createCardStyles(colors), [colors]);
    const isActive = item.id === activeItineraryId;
    const isCompleted = !!item.completedAt;

    // Use parent's objectives if available; otherwise preview from first child
    const hasOwnObjectives = (item.objectives ?? []).length > 0;
    const previewChild = !hasOwnObjectives
      ? (item.children ?? []).find((c) => (c.objectives ?? []).length > 0)
      : null;
    const objectives = hasOwnObjectives
      ? item.objectives
      : previewChild?.objectives ?? [];
    const childCount = (item.children ?? []).filter(
      (c) => c.status === "READY",
    ).length;
    const hasUnselectedOptions = !hasOwnObjectives && childCount > 0;

    const totalCost = objectives.reduce(
      (sum, o) => sum + (Number(o.estimatedCost) || 0),
      0,
    );
    const checkedInCount = objectives.filter((o) => o.checkedInAt).length;

    const firstEmoji = useMemo(() => {
      for (const o of objectives) {
        if (o.emoji) return o.emoji;
      }
      return "\u{1F5FA}\u{FE0F}";
    }, [objectives]);

    // Bob animation
    const bobY = useSharedValue(0);
    useEffect(() => {
      bobY.value = withDelay(
        index * 250,
        withRepeat(
          withSequence(
            withTiming(-BOB_AMPLITUDE, {
              duration: BOB_DURATION / 2,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(BOB_AMPLITUDE, {
              duration: BOB_DURATION / 2,
              easing: Easing.inOut(Easing.ease),
            }),
          ),
          -1,
          true,
        ),
      );
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => {
      const pos =
        ((index - activeIndex.value) % totalCards + totalCards) % totalCards;
      const isFront = pos === 0;
      const translateX = isFront ? swipeX.value : 0;
      const baseTranslateY = pos * CARD_VERTICAL_OFFSET;
      const scale = 1 - pos * CARD_SCALE_STEP;
      const rotate = isFront
        ? interpolate(
            swipeX.value,
            [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
            [-12, 0, 12],
          )
        : 0;
      const opacity = isFront
        ? interpolate(
            Math.abs(swipeX.value),
            [0, SCREEN_WIDTH * 0.5],
            [1, 0.6],
          )
        : interpolate(pos, [0, 1, 2, 3], [1, 0.9, 0.8, 0.7]);

      return {
        transform: [
          { translateX },
          { translateY: baseTranslateY + bobY.value },
          { scale },
          { rotate: `${rotate}deg` },
        ],
        opacity,
        zIndex: totalCards - pos,
      };
    });

    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(item.id);
    }, [item.id, onPress]);

    const handleLongPress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onDelete(item.id);
    }, [item.id, onDelete]);

    const statusColor = isCompleted
      ? "rgba(134, 239, 172, 0.9)"
      : isActive
        ? "rgba(251, 191, 36, 0.9)"
        : "rgba(147, 197, 253, 0.6)";

    const statusBg = isCompleted
      ? "rgba(134, 239, 172, 0.12)"
      : isActive
        ? "rgba(251, 191, 36, 0.12)"
        : "rgba(147, 197, 253, 0.08)";

    const sortedObjectives = [...objectives].sort((a, b) => a.sortOrder - b.sortOrder);
    const stopCount = sortedObjectives.length;

    return (
      <Animated.View style={[s.card, animatedStyle]}>
        {/* Status stripe */}
        <View style={[s.statusStripe, { backgroundColor: statusColor }]} />

        <Pressable
          style={s.cardInner}
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
          {/* Top: status badge + city */}
          <View style={s.topRow}>
            <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusColor }]}>
              {isCompleted && (
                <Check size={9} color={statusColor} strokeWidth={3} />
              )}
              {isActive && <View style={[s.activeDot, { backgroundColor: statusColor }]} />}
              <Text style={[s.statusText, { color: statusColor }]}>
                {isCompleted
                  ? `DONE${item.rating ? " " + "\u2605".repeat(item.rating) : ""}`
                  : isActive
                    ? `${checkedInCount}/${stopCount}`
                    : "READY"}
              </Text>
            </View>
            <Text style={s.cityText}>{item.city}</Text>
          </View>

          {/* Hero: emoji + title + summary */}
          <View style={s.heroBlock}>
            <Text style={s.emoji}>{firstEmoji}</Text>
            <Text style={s.title} numberOfLines={2}>
              {item.title || "Untitled Sidequest"}
            </Text>
            {item.summary && (
              <Text style={s.summary} numberOfLines={2}>
                {item.summary}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Timeline stops */}
          <View style={s.stops}>
            {sortedObjectives.slice(0, 4).map((obj, i) => (
              <View key={obj.id} style={s.timelineRow}>
                <View style={s.timelineTrack}>
                  <View style={[s.timelineCircle, obj.checkedInAt && s.timelineCircleChecked]}>
                    <Text style={s.timelineEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                  </View>
                  {i < Math.min(sortedObjectives.length, 4) - 1 && (
                    <View style={s.timelineLine} />
                  )}
                </View>
                <View style={s.timelineContent}>
                  <Text style={s.stopName} numberOfLines={1}>
                    {obj.venueName ?? obj.title}
                  </Text>
                </View>
              </View>
            ))}
            {sortedObjectives.length > 4 && (
              <Text style={s.moreStops}>+{sortedObjectives.length - 4} more</Text>
            )}
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Bottom stats bar */}
          <View style={s.statsBar}>
            <View style={s.statPill}>
              <Text style={s.statValue}>{stopCount}</Text>
              <Text style={s.statLabel}>STOPS</Text>
            </View>
            {totalCost > 0 && (
              <View style={s.statPill}>
                <Text style={s.statValue}>~${totalCost.toFixed(0)}</Text>
                <Text style={s.statLabel}>EST.</Text>
              </View>
            )}
            {isActive && stopCount > 0 && (
              <View style={s.statPill}>
                <Text style={s.statValue}>{Math.round((checkedInCount / stopCount) * 100)}%</Text>
                <Text style={s.statLabel}>DONE</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

SidequestCard.displayName = "SidequestCard";




// --- Dot indicator ---

const DotIndicator: React.FC<{
  index: number;
  activeIndex: SharedValue<number>;
  totalCards: number;
  colors: Colors;
}> = React.memo(({ index, activeIndex, totalCards, colors }) => {
  const animStyle = useAnimatedStyle(() => {
    const pos =
      ((index - activeIndex.value) % totalCards + totalCards) % totalCards;
    const isActive = pos === 0;
    return {
      width: withTiming(isActive ? 16 : 6, { duration: 200 }),
      backgroundColor: isActive ? "#86efac" : colors.border.default,
      opacity: withTiming(isActive ? 1 : 0.4, { duration: 200 }),
    };
  });

  return <Animated.View style={[dotStyles.dot, animStyle]} />;
});

DotIndicator.displayName = "DotIndicator";

const dotStyles = StyleSheet.create({
  dot: { height: 6, borderRadius: 3 },
});

// --- Counter badge ---

const CountBadge: React.FC<{
  activeIndex: SharedValue<number>;
  totalCards: number;
  colors: Colors;
}> = React.memo(({ activeIndex, totalCards, colors }) => {
  const [displayed, setDisplayed] = useState(1);

  useAnimatedStyle(() => {
    const pos = Math.round(activeIndex.value) % totalCards;
    const current = pos + 1;
    scheduleOnRN(setDisplayed, current);
    return {};
  });

  return (
    <Text
      style={{
        fontSize: 11,
        fontFamily: fontFamily.mono,
        fontWeight: fontWeight.semibold,
        color: colors.text.secondary,
      }}
    >
      {displayed} / {totalCards}
    </Text>
  );
});

CountBadge.displayName = "CountBadge";

// --- Options overlay (fan-out after generation) ---

const OptionsOverlay: React.FC<{
  parentId: string;
  visible: boolean;
  onSelected: () => void;
  colors: Colors;
  mockOptions?: SidequestResponse[];
}> = React.memo(({ parentId, visible, onSelected, colors, mockOptions }) => {
  const [options, setOptions] = useState<SidequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible || !parentId) return;

    if (mockOptions) {
      setOptions(mockOptions);
      setIsLoading(false);
      return;
    }

    // Fetch options immediately, then poll until all are resolved
    const fetchOptions = async () => {
      try {
        const result = await apiClient.sidequests.getOptions(parentId);
        const opts = result.data ?? [];
        if (opts.length > 0) {
          setOptions(opts);
          setIsLoading(false);
          // Stop polling when all options are resolved (READY or FAILED)
          const allResolved = opts.every(
            (o: SidequestResponse) => o.status === "READY" || o.status === "FAILED",
          );
          if (allResolved && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Keep polling
      }
    };

    fetchOptions();
    pollRef.current = setInterval(fetchOptions, 2500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
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
        onSelected();
      } catch (err) {
        console.error("[OptionsOverlay] Failed to select:", err);
        setIsSelecting(false);
      }
    },
    [isSelecting, onSelected, mockOptions],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={overlayStyles.container}
      >
        <BlurView
          tint="dark"
          intensity={60}
          style={StyleSheet.absoluteFill}
        />
        <View style={overlayStyles.content}>
          {isLoading ? (
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
            </View>
          ) : options.length === 0 ? (
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
                <Text style={{ color: colors.text.primary, fontFamily: fontFamily.mono }}>
                  Dismiss
                </Text>
              </Pressable>
            </View>
          ) : (
            <QuestCardDeck
              options={options}
              onSelect={handleSelect}
              isSelecting={isSelecting}
            />
          )}
        </View>
      </Animated.View>
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
  const activeJobId = useItineraryJobStore((s) => s.activeJobId);
  const isGenerating = !!activeJobId;
  const activeJobItineraryId = useItineraryJobStore(
    (s) => s.activeItineraryId,
  );
  const hasReady = useItineraryJobStore((s) => s.hasReady);
  const clearReady = useItineraryJobStore((s) => s.clearReady);
  const activeItineraryId = useActiveItineraryStore(
    (s) => s.itinerary?.id ?? null,
  );

  // --- SSE job progress ---
  const { activeJobs, trackJob } = useJobProgress();

  // Track the active job for SSE streaming
  useEffect(() => {
    if (activeJobId) {
      trackJob(activeJobId);
    }
  }, [activeJobId, trackJob]);

  // --- Options overlay state ---
  const [showOptions, setShowOptions] = useState(false);
  const optionsParentId = useRef<string | null>(null);

  const PAGE_SIZE = 20;
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const activeIndex = useSharedValue(0);
  const swipeX = useSharedValue(0);

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

  // Refetch when a push notification signals job completion (SSE fallback)
  useEffect(() => {
    return eventBroker.on<SidequestJobCompletedEvent>(
      EventTypes.SIDEQUEST_JOB_COMPLETED,
      () => {
        fetchItineraries();
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

  const handleOptionSelected = useCallback(() => {
    setShowOptions(false);
    clearReady();
    fetchItineraries();
  }, [clearReady, fetchItineraries]);

  // Build the deck (only real sidequests — generating card is shown separately)
  const deckItems = useMemo(() => {
    return itineraries.map((it) => ({ id: it.id, item: it }));
  }, [itineraries]);

  const totalCards = deckItems.length;

  const handlePress = useCallback(
    (id: string) => {
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
      const title = itinerary?.title || "this sidequest";

      Alert.alert("Delete sidequest", `Delete "${title}"?`, [
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
              await apiClient.sidequests.deleteById(id);
            } catch (err) {
              console.error("[Itineraries] Failed to delete:", err);
              fetchItineraries();
            }
          },
        },
      ]);
    },
    [itineraries, fetchItineraries],
  );

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  // Load more when approaching end of deck
  const checkLoadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    const currentPos = Math.round(activeIndex.value);
    if (currentPos >= totalCards - 3) {
      fetchItineraries(cursorRef.current ?? undefined);
    }
  }, [totalCards, fetchItineraries]);

  const onSwipeComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    checkLoadMore();
  }, [checkLoadMore]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .enabled(totalCards > 1)
    .onUpdate((e) => {
      swipeX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        swipeX.value = withTiming(
          direction * SCREEN_WIDTH,
          { duration: 200, easing: Easing.in(Easing.cubic) },
          () => {
            activeIndex.value = (activeIndex.value + 1) % totalCards;
            swipeX.value = 0;
            scheduleOnRN(onSwipeComplete);
          },
        );
      } else {
        swipeX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // --- DEV: Simulation mode ---
  const [simulating, setSimulating] = useState(false);
  const [simShowOptions, setSimShowOptions] = useState(false);

  // Ready versions of the mock options (with full content)
  const MOCK_READY = {
    quick: {
      id: "sim-quick", city: "San Francisco", budgetMax: 30,
      activityTypes: ["coffee", "walk"], categories: ["outdoor", "caffeine", "morning"],
      title: "Morning Buzz Walk", summary: "Quick caffeine hit and a stroll through the park",
      status: "READY" as const, tier: "QUICK" as const, children: [], createdAt: new Date().toISOString(),
      objectives: [
        { id: "q1", sortOrder: 0, title: "Coffee Stop", emoji: "\u2615", venueName: "Blue Bottle Coffee", venueAddress: "315 Linden St", venueCategory: "cafe", hook: "Best pour-over in Hayes Valley", estimatedCost: 6 },
        { id: "q2", sortOrder: 1, title: "Park Walk", emoji: "\u{1F33F}", venueName: "Golden Gate Park", venueAddress: "Golden Gate Park", venueCategory: "park", hook: "Morning fog through the eucalyptus grove", estimatedCost: 0 },
      ],
    },
    sweet: {
      id: "sim-sweet", city: "San Francisco", budgetMax: 50,
      activityTypes: ["food", "explore"], categories: ["culture", "neighborhood", "brunch"],
      title: "Mission District Drift", summary: "Pastries, murals, and a sunny park hang",
      status: "READY" as const, tier: "SWEET_SPOT" as const, children: [], createdAt: new Date().toISOString(),
      objectives: [
        { id: "s1", sortOrder: 0, title: "Pastry Run", emoji: "\u{1F950}", venueName: "Tartine Bakery", venueAddress: "600 Guerrero St", venueCategory: "bakery", hook: "The morning bun is legendary", estimatedCost: 12 },
        { id: "s2", sortOrder: 1, title: "Park Hang", emoji: "\u{1F3DE}\u{FE0F}", venueName: "Mission Dolores Park", venueAddress: "Dolores St & 19th", venueCategory: "park", hook: "Best city skyline view from the hilltop", estimatedCost: 0 },
      ],
    },
    best: {
      id: "sim-best", city: "San Francisco", budgetMax: 80,
      activityTypes: ["food", "drinks", "culture"], categories: ["nightlife", "waterfront", "premium"],
      title: "Full Send: Fort Mason to Mission", summary: "Cocktails, ice cream, and a waterfront sunset",
      status: "READY" as const, tier: "BEST" as const, children: [], createdAt: new Date().toISOString(),
      objectives: [
        { id: "b1", sortOrder: 0, title: "Cocktail Hour", emoji: "\u{1F378}", venueName: "The Interval", venueAddress: "Fort Mason Center", venueCategory: "cocktail bar", hook: "Craft cocktails inside a library of civilization", estimatedCost: 18 },
        { id: "b2", sortOrder: 1, title: "Sweet Finish", emoji: "\u{1F366}", venueName: "Bi-Rite Creamery", venueAddress: "3692 18th St", venueCategory: "ice cream", hook: "Salted caramel soft serve, need I say more", estimatedCost: 8 },
      ],
    },
  };

  // Start with 3 GENERATING skeleton cards, resolve them one by one
  const [MOCK_OPTIONS, setMockOptions] = useState<SidequestResponse[]>([
    { id: "sim-quick", status: "GENERATING" as const, tier: "QUICK" as const, city: "San Francisco", budgetMax: 30, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
    { id: "sim-sweet", status: "GENERATING" as const, tier: "SWEET_SPOT" as const, city: "San Francisco", budgetMax: 50, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
    { id: "sim-best", status: "GENERATING" as const, tier: "BEST" as const, city: "San Francisco", budgetMax: 80, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
  ] as unknown as SidequestResponse[]);

  const startSimulation = useCallback(() => {
    // Reset to generating skeletons
    setMockOptions([
      { id: "sim-quick", status: "GENERATING", tier: "QUICK", city: "San Francisco", budgetMax: 30, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
      { id: "sim-sweet", status: "GENERATING", tier: "SWEET_SPOT", city: "San Francisco", budgetMax: 50, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
      { id: "sim-best", status: "GENERATING", tier: "BEST", city: "San Francisco", budgetMax: 80, activityTypes: [], objectives: [], children: [], createdAt: new Date().toISOString() },
    ] as unknown as SidequestResponse[]);

    setSimulating(true);
    setSimShowOptions(true);

    // Resolve cards one by one with staggered delays
    setTimeout(() => {
      setMockOptions((prev) => prev.map((o) => o.id === "sim-quick" ? MOCK_READY.quick as unknown as SidequestResponse : o));
    }, 4000);
    setTimeout(() => {
      setMockOptions((prev) => prev.map((o) => o.id === "sim-sweet" ? MOCK_READY.sweet as unknown as SidequestResponse : o));
    }, 7000);
    setTimeout(() => {
      setMockOptions((prev) => prev.map((o) => o.id === "sim-best" ? MOCK_READY.best as unknown as SidequestResponse : o));
    }, 10000);
  }, []);

  const handleSimOptionSelected = useCallback(() => {
    setSimShowOptions(false);
    setSimulating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

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
            <Text style={{ fontFamily: fontFamily.mono, fontSize: 11, color: "#86efac" }}>
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
      <Animated.View
        entering={FadeIn.duration(400)}
        style={styles.deckScreen}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>YOUR QUESTS</Text>
          <CountBadge
            activeIndex={activeIndex}
            totalCards={totalCards}
            colors={colors}
          />
        </View>

        {/* Card deck */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.deckContainer}>
            {[...deckItems].reverse().map((deckItem, reversedIdx) => {
              const originalIdx = totalCards - 1 - reversedIdx;
              return (
                <SidequestCard
                  key={deckItem.id}
                  item={(deckItem as { item: ItineraryResponse }).item}
                  index={originalIdx}
                  totalCards={totalCards}
                  activeIndex={activeIndex}
                  swipeX={swipeX}
                  activeItineraryId={activeItineraryId}
                  onPress={handlePress}
                  onDelete={handleDelete}
                  colors={colors}
                />
              );
            })}
          </Animated.View>
        </GestureDetector>

        {/* Dots */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.dotsRow}
        >
          {deckItems.length <= 8 ? (
            deckItems.map((_, i) => (
              <DotIndicator
                key={deckItems[i].id}
                index={i}
                activeIndex={activeIndex}
                totalCards={totalCards}
                colors={colors}
              />
            ))
          ) : (
            <CountBadge
              activeIndex={activeIndex}
              totalCards={totalCards}
              colors={colors}
            />
          )}
        </Animated.View>

        <Text style={styles.hint}>Swipe to browse \u00B7 Tap to open \u00B7 Hold to delete</Text>

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
            <Text style={{ fontFamily: fontFamily.mono, fontSize: 11, color: "#86efac" }}>
              DEV: Simulate Generation
            </Text>
          </Pressable>
        )}
      </Animated.View>

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
    deckScreen: {
      flex: 1,
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.label,
      letterSpacing: 1.5,
    },
    deckContainer: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT + CARD_VERTICAL_OFFSET * 3 + 20,
      alignItems: "center",
    },
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
    },
    hint: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: spacing.sm,
    },
  });

// --- Card styles ---

const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      position: "absolute",
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      top: 0,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.default,
      overflow: "hidden",
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    cardInner: {
      flex: 1,
      padding: spacing.lg,
      paddingTop: spacing.lg + 2,
      gap: spacing.sm,
    },
    statusStripe: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      opacity: 0.8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    cityText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroBlock: {
      gap: 6,
    },
    emoji: {
      fontSize: 36,
    },
    title: {
      fontSize: 18,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 24,
    },
    summary: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: 2,
    },
    stops: {
      gap: 0,
    },
    timelineRow: {
      flexDirection: "row",
      minHeight: 40,
    },
    timelineTrack: {
      width: 32,
      alignItems: "center",
    },
    timelineCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    timelineCircleChecked: {
      borderColor: "rgba(134, 239, 172, 0.5)",
      backgroundColor: "rgba(134, 239, 172, 0.1)",
    },
    timelineEmoji: {
      fontSize: 13,
    },
    timelineLine: {
      width: 1.5,
      flex: 1,
      marginVertical: 2,
      backgroundColor: colors.border.default,
      opacity: 0.4,
    },
    timelineContent: {
      flex: 1,
      paddingLeft: 8,
      paddingTop: 5,
      paddingBottom: 6,
    },
    stopName: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    moreStops: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      paddingLeft: 40,
      paddingTop: 2,
    },
    statsBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    statPill: {
      alignItems: "center",
      gap: 1,
    },
    statValue: {
      fontSize: 14,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 8,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      letterSpacing: 1,
    },
  });
