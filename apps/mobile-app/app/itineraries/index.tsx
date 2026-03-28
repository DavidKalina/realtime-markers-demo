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
import {
  useJobProgress,
  type AgentCandidate,
} from "@/hooks/useJobProgress";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH * 0.82;
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const CARD_VERTICAL_OFFSET = 12;
const CARD_SCALE_STEP = 0.04;
const BOB_AMPLITUDE = 3;
const BOB_DURATION = 2600;

// --- Generating card tier flip labels ---

const TIER_FACES = [
  { label: "QUICK & EASY", color: "rgba(134, 239, 172, 0.9)", glow: "rgba(134, 239, 172, 0.15)" },
  { label: "SWEET SPOT", color: "rgba(251, 191, 36, 0.9)", glow: "rgba(251, 191, 36, 0.15)" },
  { label: "BEST PACKAGE", color: "rgba(168, 85, 247, 0.9)", glow: "rgba(168, 85, 247, 0.15)" },
];

const FALLBACK_STEPS = [
  "Scanning local venues\u2026",
  "Scouting nearby trails\u2026",
  "Building the route\u2026",
  "Finalizing your plan\u2026",
];

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

    return (
      <Animated.View style={[s.card, animatedStyle]}>
        <Pressable
          style={s.cardInner}
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
          {/* Status stripe */}
          <View
            style={[
              s.statusStripe,
              {
                backgroundColor: isCompleted
                  ? "rgba(134, 239, 172, 0.8)"
                  : isActive
                    ? "rgba(251, 191, 36, 0.8)"
                    : hasUnselectedOptions
                      ? "rgba(168, 85, 247, 0.6)"
                      : "rgba(147, 197, 253, 0.4)",
              },
            ]}
          />

          {/* Top row: status + city */}
          <View style={s.topRow}>
            <View style={s.statusRow}>
              {isCompleted && (
                <View style={s.completedBadge}>
                  <Check size={10} color="#fff" strokeWidth={3} />
                </View>
              )}
              {isActive && <View style={s.activeDot} />}
              <Text style={s.statusText}>
                {isCompleted
                  ? `COMPLETED${item.rating ? " " + "\u2605".repeat(item.rating) : ""}`
                  : isActive
                    ? `${checkedInCount}/${objectives.length} STOPS`
                    : hasUnselectedOptions
                      ? `${childCount} OPTIONS`
                      : "READY"}
              </Text>
            </View>
            <Text style={s.cityText}>{item.city}</Text>
          </View>

          {/* Big emoji */}
          <View style={s.emojiBlock}>
            <Text style={s.bigEmoji}>{firstEmoji}</Text>
          </View>

          {/* Title */}
          <Text style={s.title} numberOfLines={2}>
            {item.title || "Untitled Sidequest"}
          </Text>

          {/* Summary */}
          {item.summary && (
            <Text style={s.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          )}

          {/* Divider */}
          <View style={s.divider} />

          {/* Stops list */}
          <View style={s.stops}>
            {objectives
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .slice(0, 5)
              .map((obj) => (
                <View key={obj.id} style={s.stopRow}>
                  <Text style={s.stopEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                  <Text style={s.stopName} numberOfLines={1}>
                    {obj.venueName ?? obj.title}
                  </Text>
                  {obj.checkedInAt && (
                    <View style={s.checkedDot} />
                  )}
                </View>
              ))}
            {objectives.length > 5 && (
              <Text style={s.moreStops}>
                +{objectives.length - 5} more
              </Text>
            )}
          </View>

          {/* Unselected options hint */}
          {hasUnselectedOptions && (
            <View style={s.optionsHint}>
              <Text style={s.optionsHintText}>
                {childCount} options to choose from
              </Text>
            </View>
          )}

          {/* Bottom stats */}
          <View style={s.bottomRow}>
            <Text style={s.stat}>{objectives.length} stops</Text>
            {totalCost > 0 && (
              <Text style={s.stat}>~${totalCost.toFixed(0)}</Text>
            )}
            {(item.activityTypes ?? []).length > 0 && (
              <Text style={s.stat} numberOfLines={1}>
                {item.activityTypes.slice(0, 2).join(" \u00B7 ")}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

SidequestCard.displayName = "SidequestCard";

// --- Individual tier card in the generating stack ---

const TUG_FORCE = 18;
const TUG_INTERVAL = 2200;
const SHUFFLE_INTERVAL = 3200;
const GEN_STACK_OFFSET = 6;
const GEN_SCALE_STEP = 0.03;
const GEN_STACK_ROTATE = 1.5; // degrees fan per stack position

const GeneratingTierCard: React.FC<{
  tierIndex: number;
  frontIdx: SharedValue<number>;
  onPress: () => void;
  colors: Colors;
}> = React.memo(({ tierIndex, frontIdx, onPress, colors }) => {
  const s = useMemo(() => createCardStyles(colors), [colors]);
  const tier = TIER_FACES[tierIndex];

  // Each card gets its own tug
  const tugX = useSharedValue(0);
  const tugY = useSharedValue(0);
  const tugRotate = useSharedValue(0);

  useEffect(() => {
    const tug = () => {
      const angle = Math.random() * Math.PI * 2;
      const force = TUG_FORCE * (0.6 + Math.random() * 0.4);
      const targetX = Math.cos(angle) * force;
      const targetY = Math.sin(angle) * force;
      const targetRotate = (Math.random() - 0.5) * 6;

      tugX.value = withSequence(
        withTiming(targetX, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 }),
      );
      tugY.value = withSequence(
        withTiming(targetY, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 }),
      );
      tugRotate.value = withSequence(
        withTiming(targetRotate, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 10, stiffness: 150 }),
      );
    };

    const timeout = setTimeout(tug, 400 + tierIndex * 600);
    const interval = setInterval(tug, TUG_INTERVAL + tierIndex * 200);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [tierIndex]);

  // Shuffle lift: driven by parent when this card leaves the front
  const liftY = useSharedValue(0);
  const liftX = useSharedValue(0);
  const liftRotate = useSharedValue(0);
  const prevPos = useSharedValue(-1);

  const animatedStyle = useAnimatedStyle(() => {
    const rawPos = ((tierIndex - frontIdx.value) % 3 + 3) % 3;
    const pos = Math.round(rawPos);

    // Detect when this card just left the front (pos went 0 -> 2)
    if (prevPos.value === 0 && pos === 2) {
      // Lift up and to the side, then settle behind
      liftY.value = withSequence(
        withTiming(-60, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 350, easing: Easing.inOut(Easing.cubic) }),
      );
      liftX.value = withSequence(
        withTiming(30, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 350, easing: Easing.inOut(Easing.cubic) }),
      );
      liftRotate.value = withSequence(
        withTiming(8, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 350, easing: Easing.inOut(Easing.cubic) }),
      );
    }
    prevPos.value = pos;

    const stackY = pos * GEN_STACK_OFFSET;
    const stackRotate = (pos - 1) * GEN_STACK_ROTATE; // fan: -1.5, 0, +1.5
    const scale = 1 - pos * GEN_SCALE_STEP;
    const opacity = interpolate(pos, [0, 1, 2], [1, 0.88, 0.75]);

    return {
      transform: [
        { translateX: tugX.value + liftX.value },
        { translateY: stackY + tugY.value + liftY.value },
        { scale },
        { rotate: `${tugRotate.value + stackRotate + liftRotate.value}deg` },
      ],
      opacity,
      zIndex: 3 - pos,
    };
  });

  return (
    <Animated.View
      style={[s.card, s.generatingCard, s.generatingCardCentered, animatedStyle]}
    >
      <Pressable style={s.cardInner} onPress={onPress}>
        {/* Tier-colored stripe */}
        <View
          style={[s.statusStripe, { backgroundColor: tier.color }]}
        />

        <View style={s.topRow}>
          <Text style={[s.statusText, { color: tier.color }]}>
            FORGING
          </Text>
        </View>

        <View style={s.genCenter}>
          <View style={[s.genTierBadge, { backgroundColor: tier.glow }]}>
            <Text style={[s.genTierText, { color: tier.color }]}>
              {tier.label}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

GeneratingTierCard.displayName = "GeneratingTierCard";

// --- Generating card stack (3 shuffling tier cards + SSE content overlay) ---

const GeneratingCard: React.FC<{
  onPress: () => void;
  stepLabel: string;
  candidates: AgentCandidate[];
  colors: Colors;
}> = React.memo(
  ({ onPress, stepLabel, candidates, colors }) => {
    const s = useMemo(() => createCardStyles(colors), [colors]);

    // --- Shuffle: cycle which card is on top ---
    const frontIdx = useSharedValue(0);

    useEffect(() => {
      const shuffle = setInterval(() => {
        frontIdx.value = (Math.round(frontIdx.value) + 1) % 3;
      }, SHUFFLE_INTERVAL);
      return () => clearInterval(shuffle);
    }, []);

    // --- Drip-feed queue for step labels ---
    const STEP_DRIP_MS = 1800;
    const [displayStep, setDisplayStep] = useState(FALLBACK_STEPS[0]);
    const textOpacity = useSharedValue(1);
    const stepQueueRef = useRef<string[]>([]);
    const stepDripTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const fallbackIdx = useRef(0);
    const lastStepRef = useRef<string>("");

    useEffect(() => {
      if (stepLabel && stepLabel !== lastStepRef.current) {
        lastStepRef.current = stepLabel;
        stepQueueRef.current.push(stepLabel);
      }
    }, [stepLabel]);

    useEffect(() => {
      const drip = () => {
        if (stepQueueRef.current.length > 0) {
          const next = stepQueueRef.current.shift()!;
          textOpacity.value = withSequence(
            withTiming(0, { duration: 200 }),
            withTiming(1, { duration: 200 }),
          );
          setTimeout(() => setDisplayStep(next), 200);
        } else {
          fallbackIdx.current = (fallbackIdx.current + 1) % FALLBACK_STEPS.length;
          textOpacity.value = withSequence(
            withTiming(0, { duration: 200 }),
            withTiming(1, { duration: 200 }),
          );
          setTimeout(() => setDisplayStep(FALLBACK_STEPS[fallbackIdx.current]), 200);
        }
      };

      stepDripTimer.current = setInterval(drip, STEP_DRIP_MS);
      return () => {
        if (stepDripTimer.current) clearInterval(stepDripTimer.current);
      };
    }, []);

    // --- Drip-feed queue for candidates ---
    const CANDIDATE_DRIP_MS = 2200;
    const [displayCandidate, setDisplayCandidate] = useState<AgentCandidate | null>(null);
    const candidateOpacity = useSharedValue(0);
    const candidateQueueRef = useRef<AgentCandidate[]>([]);
    const candidateSeenRef = useRef(0);

    useEffect(() => {
      if (candidates.length > candidateSeenRef.current) {
        const newOnes = candidates.slice(candidateSeenRef.current);
        candidateSeenRef.current = candidates.length;
        candidateQueueRef.current.push(...newOnes);
      }
    }, [candidates.length]);

    useEffect(() => {
      const drip = () => {
        if (candidateQueueRef.current.length === 0) return;
        const next = candidateQueueRef.current.shift()!;
        candidateOpacity.value = withSequence(
          withTiming(0, { duration: 150 }),
          withTiming(1, { duration: 250 }),
        );
        setTimeout(() => setDisplayCandidate(next), 150);
      };

      const kickoff = setTimeout(drip, 400);
      const timer = setInterval(drip, CANDIDATE_DRIP_MS);
      return () => {
        clearTimeout(kickoff);
        clearInterval(timer);
      };
    }, []);

    const candidateAnimStyle = useAnimatedStyle(() => ({
      opacity: candidateOpacity.value,
    }));

    const textAnimStyle = useAnimatedStyle(() => ({
      opacity: textOpacity.value,
    }));

    return (
      <View style={s.genStackWrapper}>
        {/* 3 shuffling tier cards */}
        {TIER_FACES.map((_, i) => (
          <GeneratingTierCard
            key={i}
            tierIndex={i}
            frontIdx={frontIdx}
            onPress={onPress}
            colors={colors}
          />
        ))}

        {/* SSE content overlay (sits above the cards, passes touches through) */}
        <View style={s.genOverlay} pointerEvents="none">
          <Animated.Text style={[s.genTitle, textAnimStyle]}>
            {displayStep}
          </Animated.Text>

          {displayCandidate && (
            <Animated.View style={[s.genCandidateRow, candidateAnimStyle]}>
              <Text style={s.genCandidateIcon}>
                {displayCandidate.type === "trail" ? "\u{1F6B6}" : "\u{1F4CD}"}
              </Text>
              <Text style={s.genCandidateName} numberOfLines={1}>
                {displayCandidate.name}
              </Text>
              {displayCandidate.rating && (
                <Text style={s.genCandidateRating}>
                  {"\u2605"}{displayCandidate.rating.toFixed(1)}
                </Text>
              )}
            </Animated.View>
          )}

          {candidates.length > 0 && (
            <Text style={s.genSub}>
              {candidates.length} venue{candidates.length !== 1 ? "s" : ""} discovered
            </Text>
          )}
          {candidates.length === 0 && (
            <Text style={s.genSub}>Crafting your adventure</Text>
          )}
        </View>
      </View>
    );
  },
);

GeneratingCard.displayName = "GeneratingCard";

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

  useEffect(() => {
    if (!visible || !parentId) return;

    // Use mock options if provided (simulation mode)
    if (mockOptions) {
      setOptions(mockOptions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiClient.sidequests
      .getOptions(parentId)
      .then((result) => {
        const ready = (result.data ?? []).filter(
          (o: SidequestResponse) => o.status === "READY",
        );
        setOptions(ready);
      })
      .catch((err) => {
        console.error("[OptionsOverlay] Failed to fetch options:", err);
      })
      .finally(() => setIsLoading(false));
  }, [visible, parentId, mockOptions]);

  const handleSelect = useCallback(
    async (option: SidequestResponse) => {
      if (isSelecting) return;
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

  const trackedJob = activeJobId
    ? activeJobs.find((j) => j.jobId === activeJobId)
    : undefined;
  const sseStepLabel = trackedJob?.stepLabel ?? "";
  const sseCandidates = trackedJob?.candidates ?? [];

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

  // Show options overlay when generation completes
  useEffect(() => {
    if (hasReady && activeJobItineraryId) {
      optionsParentId.current = activeJobItineraryId;
      setShowOptions(true);
    }
  }, [hasReady, activeJobItineraryId]);

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

  const handleGeneratingPress = useCallback(() => {
    if (!activeJobItineraryId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/itineraries/[id]" as const,
      params: { id: activeJobItineraryId },
    });
  }, [activeJobItineraryId, router]);

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
  const [simStep, setSimStep] = useState("");
  const [simCandidates, setSimCandidates] = useState<AgentCandidate[]>([]);
  const [simShowOptions, setSimShowOptions] = useState(false);

  const MOCK_STEPS = [
    "Searching verified venues\u2026",
    "Scanning local events\u2026",
    "Scouting nearby trails\u2026",
    "Checking what\u2019s open\u2026",
    "Building the route\u2026",
    "Optimizing stop order\u2026",
    "Finalizing your plan\u2026",
  ];

  const MOCK_CANDIDATES: AgentCandidate[] = [
    { name: "Blue Bottle Coffee", coordinates: [-122.41, 37.78], type: "venue", rating: 4.5, distanceMiles: 0.3, query: "coffee" },
    { name: "Golden Gate Park", coordinates: [-122.48, 37.77], type: "trail", rating: 4.8, distanceMiles: 1.2, query: "park" },
    { name: "Tartine Bakery", coordinates: [-122.42, 37.76], type: "venue", rating: 4.6, distanceMiles: 0.5, query: "bakery" },
    { name: "Mission Dolores Park", coordinates: [-122.43, 37.76], type: "trail", rating: 4.7, distanceMiles: 0.8, query: "park" },
    { name: "Bi-Rite Creamery", coordinates: [-122.43, 37.76], type: "venue", rating: 4.4, distanceMiles: 0.6, query: "ice cream" },
    { name: "The Interval", coordinates: [-122.42, 37.80], type: "venue", rating: 4.3, distanceMiles: 1.0, query: "bar" },
  ];

  const MOCK_OPTIONS: SidequestResponse[] = [
    {
      id: "sim-quick",
      city: "San Francisco",
      budgetMax: 30,
      activityTypes: ["coffee", "walk"],
      title: "Morning Buzz Walk",
      summary: "Quick caffeine hit and a stroll through the park",
      status: "READY" as const,
      tier: "QUICK" as const,
      objectives: [
        { id: "q1", sortOrder: 0, title: "Coffee Stop", emoji: "\u2615", venueName: "Blue Bottle Coffee", venueAddress: "315 Linden St", hook: "Best pour-over in Hayes Valley", estimatedCost: 6 },
        { id: "q2", sortOrder: 1, title: "Park Walk", emoji: "\u{1F33F}", venueName: "Golden Gate Park", venueAddress: "Golden Gate Park", hook: "Morning fog through the eucalyptus grove", estimatedCost: 0 },
      ],
      children: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "sim-sweet",
      city: "San Francisco",
      budgetMax: 50,
      activityTypes: ["food", "explore"],
      title: "Mission District Drift",
      summary: "Pastries, murals, and a sunny park hang",
      status: "READY" as const,
      tier: "SWEET_SPOT" as const,
      objectives: [
        { id: "s1", sortOrder: 0, title: "Pastry Run", emoji: "\u{1F950}", venueName: "Tartine Bakery", venueAddress: "600 Guerrero St", hook: "The morning bun is legendary", estimatedCost: 12 },
        { id: "s2", sortOrder: 1, title: "Park Hang", emoji: "\u{1F3DE}\u{FE0F}", venueName: "Mission Dolores Park", venueAddress: "Dolores St & 19th", hook: "Best city skyline view from the hilltop", estimatedCost: 0 },
      ],
      children: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "sim-best",
      city: "San Francisco",
      budgetMax: 80,
      activityTypes: ["food", "drinks", "culture"],
      title: "Full Send: Fort Mason to Mission",
      summary: "Cocktails, ice cream, and a waterfront sunset",
      status: "READY" as const,
      tier: "BEST" as const,
      objectives: [
        { id: "b1", sortOrder: 0, title: "Cocktail Hour", emoji: "\u{1F378}", venueName: "The Interval", venueAddress: "Fort Mason Center", hook: "Craft cocktails inside a library of civilization", estimatedCost: 18 },
        { id: "b2", sortOrder: 1, title: "Sweet Finish", emoji: "\u{1F366}", venueName: "Bi-Rite Creamery", venueAddress: "3692 18th St", hook: "Salted caramel soft serve, need I say more", estimatedCost: 8 },
      ],
      children: [],
      createdAt: new Date().toISOString(),
    },
  ] as unknown as SidequestResponse[];

  const startSimulation = useCallback(() => {
    setSimulating(true);
    setSimStep("");
    setSimCandidates([]);
    setSimShowOptions(false);

    // Drip mock steps
    MOCK_STEPS.forEach((step, i) => {
      setTimeout(() => setSimStep(step), (i + 1) * 1200);
    });

    // Drip mock candidates
    MOCK_CANDIDATES.forEach((c, i) => {
      setTimeout(() => {
        setSimCandidates((prev) => [...prev, c]);
      }, 2000 + i * 1500);
    });

    // Show options overlay after "generation" completes
    setTimeout(() => {
      setSimShowOptions(true);
    }, MOCK_STEPS.length * 1200 + 2000);
  }, []);

  const handleSimOptionSelected = useCallback(() => {
    setSimShowOptions(false);
    setSimulating(false);
    setSimStep("");
    setSimCandidates([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Use sim data when simulating
  const effectiveIsGenerating = isGenerating || simulating;
  const effectiveStepLabel = simulating ? simStep : sseStepLabel;
  const effectiveCandidates = simulating ? simCandidates : sseCandidates;
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

  // When generating (real or simulated), show only the generating card
  if (effectiveIsGenerating) {
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
          <View style={styles.header}>
            <Text style={styles.headerTitle}>FORGING QUEST</Text>
          </View>

          <View style={styles.deckContainer}>
            <GeneratingCard
              onPress={handleGeneratingPress}
              stepLabel={effectiveStepLabel}
              candidates={effectiveCandidates}
              colors={colors}
            />
          </View>
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
          emoji="\u{1F5FA}\u{FE0F}"
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
      <OptionsOverlay
        parentId={optionsParentId.current ?? ""}
        visible={showOptions}
        onSelected={handleOptionSelected}
        colors={colors}
      />
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
    generatingCard: {
      borderColor: "rgba(134, 239, 172, 0.25)",
      borderStyle: "dashed",
    },
    generatingCardCentered: {
      top: 0,
      left: 0,
    },
    cardInner: {
      flex: 1,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    statusStripe: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusText: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
    cityText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    completedBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#86efac",
      alignItems: "center",
      justifyContent: "center",
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#fbbf24",
    },
    emojiBlock: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    bigEmoji: {
      fontSize: 48,
    },
    title: {
      fontSize: 18,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 24,
      textAlign: "center",
    },
    summary: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 18,
      textAlign: "center",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.xs,
    },
    stops: {
      flex: 1,
      gap: 6,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stopEmoji: {
      fontSize: 14,
      width: 20,
      textAlign: "center",
    },
    stopName: {
      flex: 1,
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    checkedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#86efac",
    },
    moreStops: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      paddingLeft: 28,
    },
    optionsHint: {
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(168, 85, 247, 0.25)",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignSelf: "center",
    },
    optionsHintText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "rgba(168, 85, 247, 0.9)",
      letterSpacing: 0.5,
    },
    bottomRow: {
      flexDirection: "row",
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    stat: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
    },

    // Generating card
    genStackWrapper: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      alignSelf: "center",
    },
    genOverlay: {
      position: "absolute",
      bottom: spacing.xl,
      left: spacing.lg,
      right: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
      zIndex: 10,
    },
    genCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    genTierBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    genTierText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    genTitle: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      textAlign: "center",
    },
    genCandidateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: "rgba(134, 239, 172, 0.06)",
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: "rgba(134, 239, 172, 0.12)",
      maxWidth: "90%",
    },
    genCandidateIcon: {
      fontSize: 14,
    },
    genCandidateName: {
      flex: 1,
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    genCandidateRating: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: "rgba(251, 191, 36, 0.9)",
    },
    genSub: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });
