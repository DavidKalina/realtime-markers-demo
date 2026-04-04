import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Check, X } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Canvas, Fill, Shader, Skia, vec } from "@shopify/react-native-skia";
import { useGyroTilt } from "@/hooks/useGyroTilt";
import HolographicFoil, {
  hashString,
} from "@/components/effects/HolographicFoil";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import {
  getCategoryColor,
  getFoilVariant,
} from "@/utils/categoryColors";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.88;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // ~5:7 trading card ratio
const CARD_GAP = 12;
const SNAP_WIDTH = CARD_WIDTH + CARD_GAP; // distance between card centers
const BOB_AMPLITUDE = 3;
const BOB_DURATION = 2400;

/** Only cards within ±ANIMATION_WINDOW of the active card run heavy effects. */
const ANIMATION_WINDOW = 1;

import {
  RARITY_LABELS,
  QUEST_ROLE_LABELS,
  type Rarity,
} from "@realtime-markers/shared";

const RARITY_DESCRIPTIONS: Record<string, string> = {
  common: "Every journey starts somewhere",
  uncommon: "You're starting to stretch",
  rare: "Something clicked here",
  epic: "Real change happened",
  legendary: "A moment you'll remember",
};

const TIER_LABEL_HEIGHT = 36;

// Per-rarity visual treatment for badges
const RARITY_BADGE_STYLE: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    glowRadius: number;
    glowOpacity: number;
    glowColor: string;
    borderWidth: number;
    shimmer: boolean;
  }
> = {
  common: {
    bg: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.12)",
    text: "rgba(255, 255, 255, 0.5)",
    glowRadius: 0,
    glowOpacity: 0,
    glowColor: "transparent",
    borderWidth: 1,
    shimmer: false,
  },
  uncommon: {
    bg: "rgba(74, 222, 128, 0.1)",
    border: "rgba(74, 222, 128, 0.25)",
    text: "rgba(74, 222, 128, 0.9)",
    glowRadius: 4,
    glowOpacity: 0.2,
    glowColor: "rgba(74, 222, 128, 1)",
    borderWidth: 1,
    shimmer: false,
  },
  rare: {
    bg: "rgba(96, 165, 250, 0.1)",
    border: "rgba(96, 165, 250, 0.25)",
    text: "rgba(96, 165, 250, 0.9)",
    glowRadius: 6,
    glowOpacity: 0.3,
    glowColor: "rgba(96, 165, 250, 1)",
    borderWidth: 1.5,
    shimmer: false,
  },
  epic: {
    bg: "rgba(168, 85, 247, 0.1)",
    border: "rgba(168, 85, 247, 0.3)",
    text: "rgba(168, 85, 247, 0.95)",
    glowRadius: 8,
    glowOpacity: 0.4,
    glowColor: "rgba(168, 85, 247, 1)",
    borderWidth: 1.5,
    shimmer: true,
  },
  legendary: {
    bg: "rgba(251, 191, 36, 0.12)",
    border: "rgba(251, 191, 36, 0.35)",
    text: "rgba(251, 191, 36, 0.95)",
    glowRadius: 12,
    glowOpacity: 0.5,
    glowColor: "rgba(251, 191, 36, 1)",
    borderWidth: 2,
    shimmer: true,
  },
};

/** Convert a hex color (#rrggbb) into bg / text / border rgba variants. */
function hexToCardColors(hex: string): {
  bg: string;
  text: string;
  border: string;
} {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text: `rgba(${r}, ${g}, ${b}, 0.9)`,
    border: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}

/** Pick a color source from the sidequest's categories, objectives, or activity types. */
function getCardColorKey(option: SidequestResponse): string {
  return (
    option.categories?.[0] ??
    option.objectives?.find((o) => o.venueCategory)?.venueCategory ??
    option.activityTypes?.[0] ??
    option.rarity ??
    "common"
  );
}

// Per-rarity holographic foil intensity for completed cards
const FOIL_INTENSITY: Record<string, number> = {
  common: 0.08,
  uncommon: 0.11,
  rare: 0.15,
  epic: 0.19,
  legendary: 0.24,
};

interface QuestCardDeckProps {
  options: SidequestResponse[];
  /** "select" = generation picker (default), "browse" = existing quest deck */
  mode?: "select" | "browse";
  onSelect?: (option: SidequestResponse) => void;
  isSelecting?: boolean;
  /** Browse mode: which sidequest is currently active (in-progress) */
  activeItineraryId?: string | null;
  /** Browse mode: tap a card */
  onPress?: (option: SidequestResponse) => void;
  /** Browse mode: long-press a card (show confirmation) */
  onDelete?: (option: SidequestResponse) => void;
  /** Browse mode: ID of card currently being discarded (triggers slide-down) */
  discardingId?: string | null;
  /** Browse mode: called after discard animation completes */
  onDiscardComplete?: (id: string) => void;
  /** Hide the built-in label + hint text (render them externally) */
  hideHeader?: boolean;
  /** Promotion: ID of card currently being promoted (tier upgrade animation) */
  promotingId?: string | null;
  /** Called at peak white-out so the caller can swap tier data */
  onPromotionMidpoint?: () => void;
  /** Called when the full promotion animation completes */
  onPromotionComplete?: () => void;
  /** Search filter: when set, cards NOT in this set animate out */
  filteredIds?: Set<string> | null;
  /** Batch-delete: set of IDs marked for deletion */
  markedForDeleteIds?: Set<string> | null;
  /** Batch-delete: called when user swipes down on a card to toggle mark */
  onToggleMarkForDelete?: (option: SidequestResponse) => void;
  /** Batch-delete: IDs currently animating their discard */
  batchDiscardingIds?: Set<string> | null;
  /** Called when the visible card changes (swipe snap) */
  onActiveIndexChange?: (index: number) => void;
}

// --- Diagonal card sheen sweep (Skia shader) ---

const SHEEN_SKSL = `
uniform float2 resolution;
uniform float progress;

half4 main(float2 xy) {
  vec2 uv = xy / resolution;

  // Project onto diagonal (bottom-left → top-right)
  float diag = uv.x + uv.y;

  // Sheen band center travels from -0.3 to 2.3 along the diagonal
  float center = mix(-0.3, 2.3, progress);
  float bandWidth = 0.22;

  // Smooth Gaussian-ish falloff
  float dist = abs(diag - center) / bandWidth;
  float band = exp(-dist * dist * 2.0);

  // Fade in/out at edges of travel
  float edgeFade = smoothstep(0.0, 0.08, progress) * smoothstep(1.0, 0.92, progress);

  float alpha = band * edgeFade * 0.55;
  vec3 color = vec3(1.0, 1.0, 1.0);
  return half4(color * alpha, alpha);
}
`;

const sheenShader = Skia.RuntimeEffect.Make(SHEEN_SKSL)!;

const SHEEN_MIN_IDLE_MS = 4000;
const SHEEN_MAX_IDLE_MS = 9000;

const CardSheen: React.FC<{
  sheenTrigger: SharedValue<number>;
  index: number;
}> = React.memo(({ sheenTrigger, index }) => {
  const sheenPos = useSharedValue(0);
  const lastTrigger = useSharedValue(-1);

  const fireSheen = useCallback(() => {
    sheenPos.value = 0;
    sheenPos.value = withTiming(1, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });
  }, []);

  // Random idle loop
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay =
        SHEEN_MIN_IDLE_MS +
        Math.random() * (SHEEN_MAX_IDLE_MS - SHEEN_MIN_IDLE_MS);
      timeout = setTimeout(() => {
        fireSheen();
        schedule();
      }, delay);
    };
    // Initial fire on mount (staggered), then start idle loop
    const mountDelay = 300 + index * 400;
    timeout = setTimeout(() => {
      fireSheen();
      schedule();
    }, mountDelay);
    return () => clearTimeout(timeout);
  }, [index, fireSheen]);

  // Swipe trigger — ~40% chance to fire
  useAnimatedReaction(
    () => sheenTrigger.value,
    (current) => {
      if (current !== lastTrigger.value) {
        lastTrigger.value = current;
        if (current > 0 && Math.random() < 0.4) {
          sheenPos.value = 0;
          sheenPos.value = withDelay(
            index * 150,
            withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          );
        }
      }
    },
  );

  const uniforms = useDerivedValue(() => ({
    resolution: [CARD_WIDTH, CARD_HEIGHT] as [number, number],
    progress: sheenPos.value,
  }));

  return (
    <Canvas
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        zIndex: 5,
      }}
      pointerEvents="none"
    >
      <Fill>
        <Shader source={sheenShader} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
});

CardSheen.displayName = "CardSheen";

// --- Rarity badge with per-rarity holographic treatment ---

const TierBadge: React.FC<{
  tier: string;
  label: string;
}> = React.memo(({ tier, label }) => {
  const s = RARITY_BADGE_STYLE[tier] ?? RARITY_BADGE_STYLE.common;

  // Shimmer animation for BEST tier
  const shimmerOpacity = useSharedValue(0.4);
  useEffect(() => {
    if (s.shimmer) {
      shimmerOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, {
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    }
  }, [s.shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: s.shimmer ? shimmerOpacity.value : 1,
  }));

  return (
    <Animated.View
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.sm,
          backgroundColor: s.bg,
          borderColor: s.border,
          borderWidth: s.borderWidth,
          shadowColor: s.glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: s.glowOpacity,
          shadowRadius: s.glowRadius,
          elevation: s.glowRadius > 0 ? 4 : 0,
        },
        shimmerStyle,
      ]}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: fontWeight.bold,
          fontFamily: fontFamily.mono,
          letterSpacing: 0.8,
          color: s.text,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
});

TierBadge.displayName = "TierBadge";

// --- Individual animated card (handles GENERATING + READY states) ---

const QuestCard: React.FC<{
  option: SidequestResponse;
  index: number;
  totalCards: number;
  scrollX: SharedValue<number>;
  activeIdx: SharedValue<number>;
  sheenTrigger: SharedValue<number>;
  onSelect?: (option: SidequestResponse) => void;
  onPress?: (option: SidequestResponse) => void;
  onDelete?: (option: SidequestResponse) => void;
  onInspect?: (option: SidequestResponse) => void;
  onDiscardComplete?: (id: string) => void;
  isDiscarding?: boolean;
  isFiltered?: boolean;
  isMarkedForDelete?: boolean;
  onToggleMarkForDelete?: (option: SidequestResponse) => void;
  mode: "select" | "browse";
  activeItineraryId?: string | null;
  colors: Colors;
  promotionProgress?: SharedValue<number>;
}> = React.memo(
  ({
    option,
    index,
    totalCards,
    scrollX,
    activeIdx,
    sheenTrigger,
    onSelect,
    onPress,
    onDelete,
    onInspect,
    onDiscardComplete,
    isDiscarding,
    isFiltered,
    isMarkedForDelete,
    onToggleMarkForDelete,
    mode,
    activeItineraryId,
    colors,
    promotionProgress,
  }) => {
    const s = useMemo(() => createCardStyles(colors), [colors]);
    if (!option) return null;
    const colorKey = getCardColorKey(option);
    const rarityKey = (option.rarity ?? "common").toLowerCase();
    const cardHex = getCategoryColor(colorKey);
    const tierMeta = {
      label: RARITY_LABELS[rarityKey as Rarity] ?? RARITY_LABELS.common,
      ...hexToCardColors(cardHex),
    };
    const isBrowse = mode === "browse";
    const isReady = isBrowse || option.status === "READY";

    // Browse-mode state
    const isActiveQuest = isBrowse && option.id === activeItineraryId;
    const isPromoted = isBrowse && !!option.promotedAt;
    const isCompleted = isBrowse && !!option.completedAt;
    const checkedInCount = isBrowse
      ? (option.objectives ?? []).filter((o) => o.checkedInAt).length
      : 0;

    // Discard animation (browse mode delete)
    const discardProgress = useSharedValue(0);
    const discardDone = useCallback(() => {
      onDiscardComplete?.(option.id);
    }, [option.id, onDiscardComplete]);
    useEffect(() => {
      if (isDiscarding) {
        discardProgress.value = withTiming(
          1,
          { duration: 350, easing: Easing.in(Easing.ease) },
          () => {
            scheduleOnRN(discardDone);
          },
        );
      }
    }, [isDiscarding]);

    // Search filter animation — reversible fade/shrink
    const filterProgress = useSharedValue(isFiltered ? 1 : 0);
    useEffect(() => {
      filterProgress.value = withTiming(isFiltered ? 1 : 0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    }, [isFiltered]);

    // Batch-delete mark animation — red tint + scale-down
    const markProgress = useSharedValue(isMarkedForDelete ? 1 : 0);
    useEffect(() => {
      markProgress.value = withTiming(isMarkedForDelete ? 1 : 0, {
        duration: 250,
        easing: Easing.inOut(Easing.ease),
      });
    }, [isMarkedForDelete]);

    const markOverlayStyle = useAnimatedStyle(() => ({
      opacity: interpolate(markProgress.value, [0, 1], [0, 0.35]),
    }));

    // Track when card transitions from generating to ready
    const wasGenerating = useRef(!isReady);
    const revealSheen = useSharedValue(0);
    const skeletonOpacity = useSharedValue(isReady ? 0 : 1);

    // Staggered content reveal — each section gets its own opacity + slide
    const heroReveal = useSharedValue(isReady ? 1 : 0);
    const dividerReveal = useSharedValue(isReady ? 1 : 0);
    const stopsReveal = useSharedValue(isReady ? 1 : 0);
    const tagsReveal = useSharedValue(isReady ? 1 : 0);
    const statsReveal = useSharedValue(isReady ? 1 : 0);

    useEffect(() => {
      if (isReady && wasGenerating.current) {
        wasGenerating.current = false;

        const fadeIn = (sv: typeof heroReveal, delay: number) => {
          sv.value = withDelay(
            delay,
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
          );
        };

        // 1. Fade out skeleton
        skeletonOpacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.in(Easing.cubic),
        });

        // 2. Stagger content in
        fadeIn(heroReveal, 200);
        fadeIn(dividerReveal, 350);
        fadeIn(stopsReveal, 450);
        fadeIn(tagsReveal, 600);
        fadeIn(statsReveal, 700);

        // 3. Reveal sheen
        revealSheen.value = 0;
        revealSheen.value = withDelay(
          500,
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        );
      }
    }, [isReady]);

    const makeRevealStyle = (sv: typeof heroReveal) =>
      useAnimatedStyle(() => ({
        opacity: sv.value,
        transform: [{ translateY: interpolate(sv.value, [0, 1], [12, 0]) }],
      }));

    const heroAnimStyle = makeRevealStyle(heroReveal);
    const dividerAnimStyle = makeRevealStyle(dividerReveal);
    const stopsAnimStyle = makeRevealStyle(stopsReveal);
    const tagsAnimStyle = makeRevealStyle(tagsReveal);
    const statsAnimStyle = makeRevealStyle(statsReveal);

    const skeletonAnimStyle = useAnimatedStyle(() => ({
      opacity: skeletonOpacity.value,
    }));

    // Track whether this card is within the animation window
    const [isNearby, setIsNearby] = React.useState(
      Math.abs(index) <= ANIMATION_WINDOW,
    );
    const setNearbyTrue = useCallback(() => setIsNearby(true), []);
    const setNearbyFalse = useCallback(() => setIsNearby(false), []);
    const isNearbyDerived = useDerivedValue(
      () => Math.abs(index - activeIdx.value) <= ANIMATION_WINDOW,
    );
    useAnimatedReaction(
      () => isNearbyDerived.value,
      (nearby, prev) => {
        if (nearby !== prev) {
          scheduleOnRN(nearby ? setNearbyTrue : setNearbyFalse);
        }
      },
    );

    // Bob animation — only runs when nearby
    const bobY = useSharedValue(0);
    useEffect(() => {
      if (isNearby) {
        bobY.value = withDelay(
          index * 300,
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
      } else {
        bobY.value = withTiming(0, { duration: 200 });
      }
    }, [index, isNearby]);

    const animatedStyle = useAnimatedStyle(() => {
      // Distance from this card's center to the viewport center
      const cardCenter = index * SNAP_WIDTH;
      const dist = cardCenter + scrollX.value; // scrollX is negative when scrolled right
      const absDist = Math.abs(dist);
      const scale = interpolate(absDist, [0, SNAP_WIDTH], [1, 0.9], "clamp");
      const opacity = interpolate(absDist, [0, SNAP_WIDTH], [1, 0.6], "clamp");

      // Discard: slide down + rotate + shrink + fade
      const d = discardProgress.value;
      const discardY = interpolate(d, [0, 1], [0, CARD_HEIGHT * 0.8]);
      const discardRotate = interpolate(d, [0, 1], [0, 15]);
      const discardScale = interpolate(d, [0, 1], [1, 0.7]);
      const discardOpacity = interpolate(d, [0, 0.6, 1], [1, 0.5, 0]);

      // Search filter: shrink + fade (reversible)
      const f = filterProgress.value;
      const filterScale = interpolate(f, [0, 1], [1, 0.75]);
      const filterOpacity = interpolate(f, [0, 1], [1, 0.15]);
      const filterY = interpolate(f, [0, 1], [0, CARD_HEIGHT * 0.15]);

      // Batch-delete mark: slight scale-down + nudge down
      const m = markProgress.value;
      const markScale = interpolate(m, [0, 1], [1, 0.92]);
      const markY = interpolate(m, [0, 1], [0, 8]);

      // Promotion scale bump
      const promoScale = promotionProgress
        ? interpolate(
            promotionProgress.value,
            [0, 0.35, 0.5, 0.65, 1],
            [1, 1.08, 1.1, 1.08, 1],
          )
        : 1;

      return {
        transform: [
          { translateY: bobY.value + discardY + filterY + markY },
          {
            scale: scale * discardScale * filterScale * markScale * promoScale,
          },
          { rotate: `${discardRotate}deg` },
        ],
        opacity: opacity * discardOpacity * filterOpacity,
      };
    });

    // Promotion white-out overlay style
    const promotionOverlayStyle = useAnimatedStyle(() => {
      if (!promotionProgress) return { opacity: 0 };
      // Ramp up to full white by 0.45, hold briefly, then fade out
      const whiteOpacity = interpolate(
        promotionProgress.value,
        [0, 0.35, 0.45, 0.55, 0.65, 1],
        [0, 0.9, 1, 1, 0.9, 0],
      );
      return { opacity: whiteOpacity };
    });

    // Promotion border style — shrink border away during the wash
    const promotionBorderStyle = useAnimatedStyle(() => {
      if (!promotionProgress) return {};
      const bw = interpolate(
        promotionProgress.value,
        [0, 0.15, 0.4, 0.6, 0.85, 1],
        [2.5, 0, 0, 0, 0, 2.5],
      );
      return { borderWidth: bw };
    });

    const objectives = (option.objectives ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const totalCost = objectives.reduce(
      (sum, o) => sum + (Number(o.estimatedCost) || 0),
      0,
    );
    const stopCount = objectives.length;

    // Collect tags for chips
    const cardTags = useMemo(() => {
      const tags = new Set<string>();
      for (const c of option.categories ?? []) tags.add(c.toUpperCase());
      for (const a of option.activityTypes ?? []) tags.add(a.toUpperCase());
      return [...tags].slice(0, 3);
    }, [option.categories, option.activityTypes]);

    // Swipe-up fling gesture for batch-delete marking
    const toggleMarkCb = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onToggleMarkForDelete?.(option);
    }, [option, onToggleMarkForDelete]);

    const swipeUpGesture = useMemo(
      () =>
        Gesture.Fling()
          .direction(Directions.UP | Directions.DOWN)
          .enabled(isBrowse && !!onToggleMarkForDelete)
          .onEnd(() => {
            scheduleOnRN(toggleMarkCb);
          }),
      [isBrowse, onToggleMarkForDelete, toggleMarkCb],
    );

    return (
      <Animated.View
        layout={LinearTransition.springify().damping(28).stiffness(180)}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT, overflow: "visible" }}
      >
      <Animated.View
        style={[
          { width: CARD_WIDTH, height: CARD_HEIGHT, overflow: "visible" },
          animatedStyle,
        ]}
      >
        {/* Promotion light rays — rendered behind the card */}
        {promotionProgress && <PromotionRays progress={promotionProgress} />}

        <GestureDetector gesture={swipeUpGesture}>
          <Animated.View
            style={[
              s.card,
              { borderColor: tierMeta.text },
              isReady ? undefined : s.cardGenerating,
              promotionProgress ? promotionBorderStyle : undefined,
            ]}
          >
            {/* Holographic foil overlay — only on promoted cards, nearby */}
            {isReady && isNearby && isPromoted && (
              <HolographicFoil
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                variant={getFoilVariant(option.rarity, colorKey, option.distanceFromHome)}
                seed={hashString(option.id)}
                intensity={
                  FOIL_INTENSITY[rarityKey] ?? FOIL_INTENSITY.common
                }
              />
            )}

            {/* Sheen sweep — only rendered for nearby cards */}
            {isNearby && (
              <CardSheen
                sheenTrigger={isReady ? sheenTrigger : revealSheen}
                index={index}
              />
            )}

            <Pressable
              style={s.cardInner}
              onPress={
                isBrowse
                  ? onPress
                    ? () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onPress(option);
                      }
                    : undefined
                  : isReady
                    ? () => onSelect?.(option)
                    : undefined
              }
              onLongPress={
                isBrowse
                  ? () => {
                      onInspect?.(option);
                    }
                  : undefined
              }
            >
              {/* ═══ HEADER ═══ */}
              <View style={s.headerBand}>
                {option.questRole ? (
                  <Text style={[
                    s.headerTier,
                    { color: option.questRole === "stretch" ? "#fbbf24" : option.pathwayPhase === "dfs" ? "#86efac" : "#93c5fd" },
                  ]}>
                    {option.questRole === "stretch"
                      ? `\u{1F525} ${QUEST_ROLE_LABELS[option.questRole as keyof typeof QUEST_ROLE_LABELS] ?? "STRETCH GOAL"}`
                      : option.pathwayPhase === "dfs" && option.pathwayLabel
                      ? `${objectives[0]?.emoji ?? "\u{1F3AF}"} ${option.pathwayLabel} \u00B7 ${QUEST_ROLE_LABELS[option.questRole as keyof typeof QUEST_ROLE_LABELS] ?? option.questRole.toUpperCase()}`
                      : `\u{1F50D} ${QUEST_ROLE_LABELS[option.questRole as keyof typeof QUEST_ROLE_LABELS] ?? option.questRole.toUpperCase()}`}
                  </Text>
                ) : option.rarity ? (
                  <Text style={[s.headerTier, { color: tierMeta.text }]}>
                    {"\u2605"} {tierMeta.label}
                  </Text>
                ) : (
                  <Text style={[s.headerTier, { color: "rgba(255,255,255,0.3)" }]}>
                    {"\u2726"} UNSEALED
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                {(() => {
                  const cats = (option.categories ?? []).slice(0, 2);
                  if (cats.length === 0) return null;
                  return (
                    <Text style={s.headerCats}>
                      {cats.map((c) => c.toUpperCase()).join(" \u00B7 ")}
                    </Text>
                  );
                })()}
              </View>

              {/* ═══ ART ZONE — top ~35% ═══ */}
              <Animated.View
                style={[s.artZone, { borderColor: tierMeta.border }]}
              >
                <View style={s.artOverlay} />
                <Text style={s.artEmoji}>
                  {objectives[0]?.emoji ?? "\u{1F3AF}"}
                </Text>
              </Animated.View>

              {/* ═══ TITLE PLATE ═══ */}
              <Animated.View style={[s.titlePlate, heroAnimStyle]}>
                <Text style={s.title} numberOfLines={2}>
                  {option.title ?? "Sidequest"}
                </Text>
                {/* subtitle removed — flavor text shows summary below */}
              </Animated.View>

              {/* ═══ GENERATING SKELETON ═══ */}
              {!isReady && (
                <Animated.View style={[s.skeletonBody, skeletonAnimStyle]}>
                  <View style={s.forgingRow}>
                    <Animated.Text
                      style={[s.forgingLabel, { color: tierMeta.text }]}
                    >
                      FORGING{"\u2026"}
                    </Animated.Text>
                  </View>
                  <View
                    style={[
                      s.skeletonBar,
                      s.skeletonBarWide,
                      { backgroundColor: tierMeta.border },
                    ]}
                  />
                  <View
                    style={[
                      s.skeletonBar,
                      s.skeletonBarMedium,
                      { backgroundColor: tierMeta.border },
                    ]}
                  />
                </Animated.View>
              )}

              {/* ═══ STOPS ═══ */}
              {isReady && (
                <Animated.View style={[s.stopsSection, stopsAnimStyle]}>
                  {(isBrowse ? objectives.slice(0, 3) : objectives).map(
                    (obj, i, arr) => (
                      <View key={obj.id ?? i} style={s.stopRow}>
                        <View
                          style={[
                            s.stopCircle,
                            {
                              borderColor: tierMeta.border,
                              backgroundColor:
                                isBrowse && obj.checkedInAt
                                  ? tierMeta.bg
                                  : "transparent",
                            },
                          ]}
                        >
                          <Text style={s.stopEmoji}>
                            {obj.emoji ?? "\u{1F4CD}"}
                          </Text>
                        </View>
                        <View style={s.stopText}>
                          <Text style={s.stopName} numberOfLines={1}>
                            {(obj.venueName || obj.title || "Stop")
                              .split("|")[0]
                              .trim()}
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                  {isBrowse && objectives.length > 3 && (
                    <Text style={s.moreStops}>
                      +{objectives.length - 3} more
                    </Text>
                  )}
                </Animated.View>
              )}

              {/* ═══ QUEST STATS ═══ */}
              {isReady && (() => {
                const diff = Math.min(Number(objectives[0]?.difficulty ?? 1), 5);
                const dist = option.distanceFromHome != null ? Number(option.distanceFromHome) : null;
                // Normalize distance to 0-1 (cap at 10mi)
                const distNorm = dist != null ? Math.min(dist / 10, 1) : 0;
                // Normalize cost to 0-1 (cap at $50)
                const costNorm = totalCost > 0 ? Math.min(totalCost / 50, 1) : 0;
                const diffBar = "\u2588".repeat(diff * 4) + "\u2591".repeat(20 - diff * 4);
                const distBar = "\u2588".repeat(Math.round(distNorm * 20)) + "\u2591".repeat(20 - Math.round(distNorm * 20));
                const costBar = "\u2588".repeat(Math.round(costNorm * 20)) + "\u2591".repeat(20 - Math.round(costNorm * 20));
                return (
                  <View style={s.statsBlock}>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>Difficulty</Text>
                      <Text style={[s.statBar, { color: tierMeta.text }]}>{diffBar}</Text>
                      <Text style={[s.statValue, { color: tierMeta.text }]}>{diff}/5</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>Distance</Text>
                      <Text style={[s.statBar, { color: tierMeta.text }]}>{distBar}</Text>
                      <Text style={[s.statValue, { color: tierMeta.text }]}>
                        {dist != null ? (dist < 0.1 ? "<0.1" : dist.toFixed(1)) : "?"} mi
                      </Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>Cost</Text>
                      <Text style={[s.statBar, { color: tierMeta.text }]}>{costBar}</Text>
                      <Text style={[s.statValue, { color: tierMeta.text }]}>
                        {totalCost > 0 ? `$${totalCost}` : "FREE"}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* ═══ FLAVOR TEXT ═══ */}
              {isReady && option.summary && objectives.length <= 3 ? (
                <Animated.View
                  style={[s.flavorBlock, { borderColor: tierMeta.border, flex: 1 }]}
                >
                  <Text style={s.flavorText}>
                    {"\u201C"}
                    {option.summary.split(/[.!]/)[0].trim()}.{"\u201D"}
                  </Text>
                  <Text style={s.flavorAttrib}>{"\u2014"} Quest lore</Text>
                </Animated.View>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {/* ═══ SERIAL FOOTER ═══ */}
              <View style={s.serialRow}>
                <Text style={s.serialNumber}>
                  SQ{"\u00B7"}
                  {(option.id ?? "").slice(0, 8).toUpperCase()}
                </Text>
                <Text style={s.serialStat}>
                  {"\u00B7"} {stopCount} STOP{stopCount !== 1 ? "S" : ""}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={s.serialStat}>
                  {option.city?.toUpperCase() ?? ""}
                </Text>
              </View>
            </Pressable>

            {/* Batch-delete mark overlay */}
            {onToggleMarkForDelete && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "rgba(239, 68, 68, 0.6)",
                    borderRadius: radius.xl,
                    zIndex: 6,
                  },
                  markOverlayStyle,
                ]}
                pointerEvents="none"
              />
            )}

            {/* Promotion white-out overlay */}
            {promotionProgress && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "#fff",
                    borderRadius: radius.xl,
                    zIndex: 10,
                  },
                  promotionOverlayStyle,
                ]}
                pointerEvents="none"
              />
            )}

            {/* Blur overlay for off-center cards — only rendered for nearby cards */}
            {isNearby && <BlurOverlay scrollX={scrollX} index={index} />}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
      </Animated.View>
    );
  },
);

QuestCard.displayName = "QuestCard";

// --- Promotion light rays (Skia shader) ---

// Canvas extends beyond the card on all sides to show rays
const RAY_OVERFLOW = CARD_HEIGHT * 0.6;
const RAY_CANVAS_W = CARD_WIDTH + RAY_OVERFLOW * 2;
const RAY_CANVAS_H = CARD_HEIGHT + RAY_OVERFLOW * 2;

const PROMOTION_RAYS_SKSL = `
uniform float progress;   // 0..1 animation timeline
uniform float2 resolution;
uniform float2 cardSize;  // card width, height

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

half4 main(float2 xy) {
  vec2 center = resolution * 0.5;
  vec2 d = xy - center;
  float dist = length(d / (cardSize * 0.5));  // normalized: 1.0 = card edge
  float angle = atan(d.y, d.x);

  // --- Ray pattern: 14 beams with staggered entrances ---
  float rayCount = 14.0;
  float rayAngle = angle + progress * 0.4;  // slow spin
  float ray = 0.0;

  // Which ray beam this pixel belongs to (0..rayCount-1)
  float rayId = floor(mod(rayAngle * rayCount / 6.283 + 0.5, rayCount));
  // Per-ray stagger: each ray has a unique entrance time based on a hash
  float rayHash = fract(sin(rayId * 127.1 + 311.7) * 43758.5453);
  // Rays appear between progress 0.03 and 0.35, each offset by its hash
  float rayDelay = rayHash * 0.25;
  float rayAppear = smoothstep(0.03 + rayDelay, 0.15 + rayDelay, progress);

  // Primary rays
  float r1 = cos(rayAngle * rayCount) * 0.5 + 0.5;
  r1 = pow(r1, 4.0);  // sharpen beams

  // Secondary thinner rays offset (also staggered)
  float ray2Id = floor(mod((rayAngle + 0.15) * rayCount * 2.0 / 6.283 + 0.5, rayCount * 2.0));
  float ray2Hash = fract(sin(ray2Id * 93.7 + 157.3) * 28461.7231);
  float ray2Delay = ray2Hash * 0.3;
  float ray2Appear = smoothstep(0.08 + ray2Delay, 0.25 + ray2Delay, progress);

  float r2 = cos((rayAngle + 0.15) * rayCount * 2.0) * 0.5 + 0.5;
  r2 = pow(r2, 8.0) * 0.5;

  ray = r1 * rayAppear + r2 * ray2Appear;

  // Noise break-up for organic feel
  float n = noise(vec2(angle * 3.0, dist * 4.0 + progress * 2.0));
  ray *= 0.7 + n * 0.3;

  // --- Radial envelope: fade from card edge outward ---
  // Rays grow outward over time
  float reach = smoothstep(0.05, 0.5, progress);  // how far rays extend
  float innerFade = smoothstep(0.6, 1.1, dist);
  float outerFade = smoothstep(1.0 + reach * 2.0, 1.0, dist);
  float radial = innerFade * outerFade;

  // --- Global fade-out at end ---
  float disappear = smoothstep(0.95, 0.7, progress);

  // --- Central glow halo just outside card ---
  float haloAppear = smoothstep(0.0, 0.2, progress);
  float halo = smoothstep(1.4, 0.8, dist) * smoothstep(0.5, 0.9, dist);
  halo *= haloAppear * disappear;

  // Combine
  float brightness = (ray * radial + halo * 0.6) * disappear;
  brightness = min(brightness, 1.0);

  // Warm white with slight golden tint
  vec3 color = vec3(1.0, 0.97, 0.92);

  return half4(color * brightness, brightness * 0.85);
}
`;

const PROMOTION_RAYS_SOURCE = Skia.RuntimeEffect.Make(PROMOTION_RAYS_SKSL);

const PromotionRays: React.FC<{
  progress: SharedValue<number>;
}> = React.memo(({ progress }) => {
  const uniforms = useDerivedValue(() => ({
    progress: progress.value,
    resolution: vec(RAY_CANVAS_W, RAY_CANVAS_H),
    cardSize: vec(CARD_WIDTH, CARD_HEIGHT),
  }));

  if (!PROMOTION_RAYS_SOURCE) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: -RAY_OVERFLOW,
        left: -RAY_OVERFLOW,
        width: RAY_CANVAS_W,
        height: RAY_CANVAS_H,
      }}
      pointerEvents="none"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={PROMOTION_RAYS_SOURCE} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
});

PromotionRays.displayName = "PromotionRays";

const BlurOverlay: React.FC<{
  scrollX: SharedValue<number>;
  index: number;
}> = React.memo(({ scrollX, index }) => {
  const blurStyle = useAnimatedStyle(() => {
    const cardCenter = index * SNAP_WIDTH;
    const dist = Math.abs(cardCenter + scrollX.value);
    const opacity = interpolate(
      dist,
      [0, SNAP_WIDTH * 0.4, SNAP_WIDTH],
      [0, 0, 1],
      "clamp",
    );
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius.sm, overflow: "hidden" },
        blurStyle,
      ]}
      pointerEvents="none"
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

// --- Inspect overlay — uses shared CardOverlay ---
import CardOverlay from "./CardOverlay";

// InspectOverlay is now the shared CardOverlay component (imported above)

// --- Deck component ---

const QuestCardDeck: React.FC<QuestCardDeckProps> = ({
  options,
  mode = "select",
  onSelect,
  isSelecting,
  activeItineraryId,
  onPress,
  onDelete,
  discardingId,
  onDiscardComplete,
  hideHeader,
  promotingId,
  onPromotionMidpoint,
  onPromotionComplete,
  filteredIds,
  markedForDeleteIds,
  onToggleMarkForDelete,
  batchDiscardingIds,
  onActiveIndexChange,
}) => {
  const colors = useColors();
  const s = useMemo(() => createDeckStyles(colors), [colors]);
  const totalCards = options.length;
  const isBrowse = mode === "browse";

  // scrollX tracks the offset of the carousel strip.
  // 0 = first card centered, -SNAP_WIDTH = second card centered, etc.
  const scrollX = useSharedValue(0);
  const activeIdx = useSharedValue(0);
  const sheenTrigger = useSharedValue(0);

  // Inspect overlay (long-press)
  const [inspectCard, setInspectCard] = useState<SidequestResponse | null>(
    null,
  );
  const handleInspect = useCallback((option: SidequestResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setInspectCard(option);
  }, []);
  const handleInspectDismiss = useCallback(() => {
    setInspectCard(null);
  }, []);

  // Promotion animation: 0 → 1 over ~3s
  const promotionProgress = useSharedValue(0);
  const midpointFired = useSharedValue(0);
  const promotionMidpointCb = useCallback(() => {
    onPromotionMidpoint?.();
  }, [onPromotionMidpoint]);
  const promotionCompleteCb = useCallback(() => {
    onPromotionComplete?.();
  }, [onPromotionComplete]);

  useEffect(() => {
    if (promotingId) {
      midpointFired.value = 0;
      promotionProgress.value = 0;
      promotionProgress.value = withTiming(
        1,
        { duration: 3000, easing: Easing.inOut(Easing.ease) },
        () => {
          scheduleOnRN(promotionCompleteCb);
        },
      );
    } else {
      promotionProgress.value = 0;
    }
  }, [promotingId]);

  // Fire midpoint callback at ~0.45 progress
  useAnimatedReaction(
    () => promotionProgress.value,
    (val) => {
      if (val >= 0.45 && midpointFired.value === 0) {
        midpointFired.value = 1;
        scheduleOnRN(promotionMidpointCb);
      }
    },
  );

  // Reset scroll to first card when a new set of options arrives
  const optionIds = options.map((o) => o.id).join(",");
  useEffect(() => {
    activeIdx.value = 0;
    scrollX.value = withSpring(0, { damping: 20, stiffness: 150 });
  }, [optionIds]);

  const handleSelect = useCallback(
    (option: SidequestResponse) => {
      if (isSelecting) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      activeIdx.value = 0;
      scrollX.value = withSpring(0, { damping: 20, stiffness: 150 });
      onSelect?.(option);
    },
    [isSelecting, onSelect],
  );

  const notifyActiveIndex = useCallback(
    (idx: number) => onActiveIndexChange?.(idx),
    [onActiveIndexChange],
  );

  const onSnapComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sheenTrigger.value = sheenTrigger.value + 1;
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .enabled(!isSelecting && totalCards > 1)
    .onUpdate((e) => {
      scrollX.value = -activeIdx.value * SNAP_WIDTH + e.translationX;
    })
    .onEnd((e) => {
      // Physics-based snapping: velocity determines how many cards to skip
      const vel = e.velocityX;
      const absVel = Math.abs(vel);

      // How many cards the velocity alone would carry you past
      // At ~500px/s skip 1, ~1200px/s skip 2, ~2000px/s skip 3, etc.
      const velocityCards = Math.floor(absVel / 600);

      // Position-based: which card is closest to where the finger released
      const positionIdx = Math.round(-scrollX.value / SNAP_WIDTH);

      // Combine: use position as base, then add velocity-driven card skips
      const direction = vel > 0 ? -1 : 1; // negative vel = swipe left = go forward
      let snapIdx: number;
      if (absVel > 300) {
        // Fast swipe: jump from current card by velocity amount
        snapIdx = activeIdx.value + direction * Math.max(1, velocityCards);
      } else {
        // Slow swipe: snap to nearest card based on position
        snapIdx = positionIdx;
      }
      snapIdx = Math.max(0, Math.min(totalCards - 1, snapIdx));

      const changed = snapIdx !== activeIdx.value;
      activeIdx.value = snapIdx;

      if (changed) {
        scheduleOnRN(notifyActiveIndex, snapIdx);
      }

      // Adaptive spring: harder swipes are faster but heavily damped (no bounce)
      const intensity = Math.min(absVel / 1500, 1); // 0..1
      const damping = interpolate(intensity, [0, 1], [40, 32]);
      const stiffness = interpolate(intensity, [0, 1], [150, 280]);

      scrollX.value = withSpring(
        -snapIdx * SNAP_WIDTH,
        {
          damping,
          stiffness,
          velocity: vel,
        },
        () => {
          if (changed) {
            scheduleOnRN(onSnapComplete);
          }
        },
      );
    });

  // Offset so the first card is centered in the viewport
  const centerOffset = (SCREEN_WIDTH - CARD_WIDTH) / 2;

  // Animated style for the carousel strip
  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value + centerOffset }],
  }));

  // Dot indicators
  const DotIndicators = useMemo(
    () => (
      <View style={s.dots}>
        {options.map((_, i) => (
          <DotIndicator
            key={options[i].id ?? i}
            index={i}
            scrollX={scrollX}
            colors={colors}
          />
        ))}
      </View>
    ),
    [options, totalCards, colors],
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(isBrowse ? 200 : 500)
        .duration(450)
        .easing(Easing.out(Easing.cubic))}
      style={s.container}
    >
      {!hideHeader && (
        <>
          <Text style={s.label}>
            {isBrowse ? "YOUR QUESTS" : "CHOOSE YOUR QUEST"}
          </Text>
          <Text style={s.hint}>
            {isBrowse
              ? "Swipe to browse \u00B7 Tap to open \u00B7 Swipe up to mark"
              : "Swipe to browse \u00B7 Tap to select"}
          </Text>
        </>
      )}

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            s.carouselClip,
            !isBrowse && { height: CARD_HEIGHT + 20 + TIER_LABEL_HEIGHT },
          ]}
        >
          <Animated.View style={[s.carouselStrip, stripStyle]}>
            {options.map((option, idx) => (
              <View key={option.id ?? idx} style={{ width: CARD_WIDTH }}>
                {!isBrowse && (
                  <View style={s.tierLabelRow}>
                    <Text
                      style={[
                        s.tierLabelText,
                        {
                          color: getCategoryColor(getCardColorKey(option)),
                        },
                      ]}
                    >
                      {RARITY_LABELS[(option.rarity ?? "common").toLowerCase() as Rarity] ?? RARITY_LABELS.common}
                    </Text>
                    <Text style={s.tierDescText}>
                      {RARITY_DESCRIPTIONS[(option.rarity ?? "common").toLowerCase()] ??
                        RARITY_DESCRIPTIONS.common}
                    </Text>
                  </View>
                )}
                <QuestCard
                  option={option}
                  index={idx}
                  totalCards={totalCards}
                  scrollX={scrollX}
                  activeIdx={activeIdx}
                  sheenTrigger={sheenTrigger}
                  onSelect={handleSelect}
                  onPress={onPress}
                  onDelete={onDelete}
                  onInspect={isBrowse ? handleInspect : undefined}
                  onDiscardComplete={onDiscardComplete}
                  isDiscarding={
                    discardingId === option.id ||
                    (batchDiscardingIds?.has(option.id) ?? false)
                  }
                  isFiltered={
                    filteredIds != null && !filteredIds.has(option.id)
                  }
                  isMarkedForDelete={
                    markedForDeleteIds?.has(option.id) ?? false
                  }
                  onToggleMarkForDelete={onToggleMarkForDelete}
                  mode={mode}
                  activeItineraryId={activeItineraryId}
                  colors={colors}
                  promotionProgress={
                    promotingId === option.id ? promotionProgress : undefined
                  }
                />
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {totalCards > 1 && DotIndicators}

      <CardOverlay
        card={inspectCard}
        visible={inspectCard !== null}
        onDismiss={handleInspectDismiss}
      />
    </Animated.View>
  );
};

// --- Dot indicator ---

const DotIndicator: React.FC<{
  index: number;
  scrollX: SharedValue<number>;
  colors: Colors;
}> = React.memo(({ index, scrollX, colors }) => {
  const animStyle = useAnimatedStyle(() => {
    const activePos = -scrollX.value / SNAP_WIDTH;
    const dist = Math.abs(index - activePos);
    const isActive = dist < 0.5;
    return {
      width: withSpring(isActive ? 16 : 6, { damping: 15, stiffness: 200 }),
      backgroundColor: isActive ? "#86efac" : colors.border.default,
      opacity: interpolate(dist, [0, 1], [1, 0.5], "clamp"),
    };
  });

  return <Animated.View style={[dotStyle.dot, animStyle]} />;
});

DotIndicator.displayName = "DotIndicator";

const dotStyle = StyleSheet.create({
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

export default QuestCardDeck;

// --- Styles ---

const createDeckStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    label: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      letterSpacing: 1.5,
      paddingHorizontal: spacing.lg,
    },
    hint: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    carouselClip: {
      height: CARD_HEIGHT + 20,
      width: SCREEN_WIDTH,
      alignSelf: "center",
    },
    carouselStrip: {
      flexDirection: "row",
      gap: CARD_GAP,
    },
    tierLabelRow: {
      height: TIER_LABEL_HEIGHT,
      paddingHorizontal: spacing.sm,
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    tierLabelText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      letterSpacing: 1.2,
      textAlign: "center",
    },
    tierDescText: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.4,
      textAlign: "center",
      opacity: 0.9,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginTop: spacing.sm,
    },
  });

const FRAME_INSET = 5;

const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    // ── Outer card ──
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.xl,
      borderWidth: 2.5,
      overflow: "hidden",
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 14,
    },
    cardGenerating: {
      borderStyle: "dashed",
    },
    cardInner: {
      flex: 1,
      margin: FRAME_INSET,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      borderColor: colors.border.default,
      overflow: "hidden",
    },
    // ── Header band ──
    headerBand: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    headerTier: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    headerCats: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.8,
    },
    // ── Art zone ──
    artZone: {
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: spacing.sm,
      height: 110,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    artOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.15)",
      borderRadius: radius.sm - 3,
    },
    artEmoji: {
      fontSize: 64,
      textShadowColor: "rgba(0, 0, 0, 0.6)",
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 12,
    },
    artCity: {
      position: "absolute",
      top: 6,
      right: 10,
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    // ── Title plate ──
    titlePlate: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: 18,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 24,
    },
    subtitle: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      marginTop: 2,
    },
    // ── Skeleton ──
    forgingLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    forgingRow: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    skeletonBody: {
      gap: spacing.md,
      padding: spacing.md,
    },
    skeletonBar: {
      height: 10,
      borderRadius: 5,
      opacity: 0.2,
    },
    skeletonBarWide: {
      width: "70%",
      height: 14,
      borderRadius: 7,
    },
    skeletonBarMedium: {
      width: "50%",
    },
    // ── Stops ──
    stopsSection: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      gap: spacing.sm,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    stopCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    stopEmoji: {
      fontSize: 14,
    },
    stopText: {
      flex: 1,
      paddingTop: 2,
      gap: 1,
    },
    stopHook: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
    },
    stopName: {
      fontSize: 13,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    stopHook: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    moreStops: {
      fontSize: 9,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      paddingLeft: 42,
    },
    // ── Stats block — 3 bordered cells ──
    statsBlock: {
      flexDirection: "row",
      marginHorizontal: spacing.sm,
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.xs,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      gap: 1,
    },
    statLabel: {
      fontSize: 7,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      letterSpacing: 0.8,
    },
    statValue: {
      fontSize: 13,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    // ── Tag chips ──
    // ── Flavor text quote ──
    flavorBlock: {
      marginHorizontal: spacing.md,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    flavorText: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      fontStyle: "italic",
      lineHeight: 22,
    },
    flavorAttrib: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: 6,
    },
    // ── Quest stats ──
    statsBlock: {
      marginHorizontal: spacing.sm,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
      width: 76,
    },
    statBar: {
      fontSize: 14,
      fontFamily: fontFamily.mono,
      letterSpacing: -0.5,
      flex: 1,
    },
    statValue: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      width: 50,
      textAlign: "right",
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.xs,
    },
    tagChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
    },
    tagText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.8,
    },
    // ── Serial footer ──
    serialRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingTop: 3,
      paddingBottom: 3,
      marginTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    serialNumber: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      opacity: 0.5,
    },
    serialStat: {
      fontSize: 8,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 1.2,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
