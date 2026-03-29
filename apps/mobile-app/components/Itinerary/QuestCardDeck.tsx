import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import HolographicFoil, { hashString } from "@/components/effects/HolographicFoil";
import type { SidequestResponse } from "@/services/api/modules/sidequests";
import { getCategoryColor, getCategoryFoilVariant } from "@/utils/categoryColors";
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
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // ~5:7 trading card ratio
const CARD_GAP = 12;
const SNAP_WIDTH = CARD_WIDTH + CARD_GAP; // distance between card centers
const BOB_AMPLITUDE = 3;
const BOB_DURATION = 2400;

/** Only cards within ±ANIMATION_WINDOW of the active card run heavy effects. */
const ANIMATION_WINDOW = 1;

const TIER_LABELS: Record<string, string> = {
  QUICK: "QUICK & EASY",
  SWEET_SPOT: "SWEET SPOT",
  BEST: "BEST PACKAGE",
};

// Per-tier visual treatment for badges — neutral palette, different text colors
const TIER_BADGE_STYLE: Record<
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
  QUICK: {
    bg: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.12)",
    text: "rgba(255, 255, 255, 0.5)",
    glowRadius: 0,
    glowOpacity: 0,
    glowColor: "transparent",
    borderWidth: 1,
    shimmer: false,
  },
  SWEET_SPOT: {
    bg: "rgba(251, 191, 36, 0.1)",
    border: "rgba(251, 191, 36, 0.25)",
    text: "rgba(251, 191, 36, 0.9)",
    glowRadius: 6,
    glowOpacity: 0.3,
    glowColor: "rgba(251, 191, 36, 1)",
    borderWidth: 1.5,
    shimmer: false,
  },
  BEST: {
    bg: "rgba(168, 85, 247, 0.1)",
    border: "rgba(168, 85, 247, 0.3)",
    text: "rgba(168, 85, 247, 0.95)",
    glowRadius: 10,
    glowOpacity: 0.5,
    glowColor: "rgba(168, 85, 247, 1)",
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

/** Pick a color source from the sidequest's categories or activity types. */
function getCardColorKey(option: SidequestResponse): string {
  return (
    option.categories?.[0] ?? option.activityTypes?.[0] ?? option.tier ?? "QUICK"
  );
}

// Per-tier holographic foil intensity
const TIER_FOIL_INTENSITY: Record<string, number> = {
  QUICK: 0.05,
  SWEET_SPOT: 0.10,
  BEST: 0.18,
};

// Tier-only fallback colors (green / amber / purple)
const TIER_FALLBACK_COLORS: Record<string, string> = {
  QUICK: "#86efac",
  SWEET_SPOT: "#fbbf24",
  BEST: "#a855f7",
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
}

// --- Diagonal card sheen sweep ---

const SHEEN_BAND = 100;
// Total travel: card diagonal + band width
const SHEEN_TRAVEL = Math.sqrt(CARD_WIDTH ** 2 + CARD_HEIGHT ** 2) + SHEEN_BAND;
const SHEEN_ANGLE = Math.atan2(CARD_HEIGHT, CARD_WIDTH); // ~59° for 5:7 ratio

const CardSheen: React.FC<{
  tierColor: string;
  sheenTrigger: SharedValue<number>;
  index: number;
}> = React.memo(({ tierColor, sheenTrigger, index }) => {
  const sheenPos = useSharedValue(0);
  const lastTrigger = useSharedValue(-1);

  // Fire on mount (staggered) and on each trigger change
  useEffect(() => {
    sheenPos.value = withDelay(
      300 + index * 400,
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
    );
  }, [index]);

  const sheenStyle = useAnimatedStyle(() => {
    // Detect new trigger (swipe happened)
    if (sheenTrigger.value !== lastTrigger.value) {
      lastTrigger.value = sheenTrigger.value;
      if (sheenTrigger.value > 0) {
        sheenPos.value = 0;
        sheenPos.value = withDelay(
          index * 150,
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        );
      }
    }

    // Translate along the diagonal
    const progress = sheenPos.value;
    const travel = interpolate(progress, [0, 1], [-SHEEN_BAND, SHEEN_TRAVEL]);
    const tx = Math.cos(SHEEN_ANGLE) * travel;
    const ty = Math.sin(SHEEN_ANGLE) * travel;
    const opacity = interpolate(
      progress,
      [0, 0.05, 0.5, 0.95, 1],
      [0, 0.8, 1, 0.8, 0],
    );

    return {
      opacity,
      transform: [
        { translateX: tx - SHEEN_BAND / 2 },
        { translateY: ty - CARD_HEIGHT },
        { rotate: `${SHEEN_ANGLE}rad` },
      ],
    };
  });

  // Unique gradient ID per card to avoid SVG conflicts
  const gradId = `sheen${index}`;

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, zIndex: 5 }, sheenStyle]}
      pointerEvents="none"
    >
      <Svg width={SHEEN_BAND} height={SHEEN_TRAVEL}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tierColor} stopOpacity="0" />
            <Stop offset="0.5" stopColor={tierColor} stopOpacity="0.18" />
            <Stop offset="1" stopColor={tierColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect
          width={SHEEN_BAND}
          height={SHEEN_TRAVEL}
          fill={`url(#${gradId})`}
        />
      </Svg>
    </Animated.View>
  );
});

CardSheen.displayName = "CardSheen";

// --- Tier badge with per-tier holographic treatment ---

const TierBadge: React.FC<{
  tier: string;
  label: string;
}> = React.memo(({ tier, label }) => {
  const s = TIER_BADGE_STYLE[tier] ?? TIER_BADGE_STYLE.QUICK;

  // Shimmer animation for BEST tier
  const shimmerOpacity = useSharedValue(0.4);
  useEffect(() => {
    if (s.shimmer) {
      shimmerOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
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

// --- Tug animation constants ---
const TUG_FORCE = 14;
const TUG_INTERVAL = 2200;

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
  onDiscardComplete?: (id: string) => void;
  isDiscarding?: boolean;
  mode: "select" | "browse";
  activeItineraryId?: string | null;
  colors: Colors;
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
    onDiscardComplete,
    isDiscarding,
    mode,
    activeItineraryId,
    colors,
  }) => {
    const s = useMemo(() => createCardStyles(colors), [colors]);
    if (!option) return null;
    const colorKey = getCardColorKey(option);
    const cardHex =
      getCategoryColor(colorKey) ??
      TIER_FALLBACK_COLORS[option.tier ?? "QUICK"] ??
      TIER_FALLBACK_COLORS.QUICK;
    const tierMeta = {
      label: TIER_LABELS[option.tier ?? "QUICK"] ?? TIER_LABELS.QUICK,
      ...hexToCardColors(cardHex),
    };
    const isBrowse = mode === "browse";
    const isReady = isBrowse || option.status === "READY";

    // Browse-mode state
    const isActiveQuest = isBrowse && option.id === activeItineraryId;
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

    // Tug animation (only while generating)
    const tugX = useSharedValue(0);
    const tugY = useSharedValue(0);
    const tugRotate = useSharedValue(0);

    useEffect(() => {
      if (isReady || !isNearby) return;
      const tug = () => {
        const angle = Math.random() * Math.PI * 2;
        const force = TUG_FORCE * (0.6 + Math.random() * 0.4);
        tugX.value = withSequence(
          withTiming(Math.cos(angle) * force, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
          }),
          withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 }),
        );
        tugY.value = withSequence(
          withTiming(Math.sin(angle) * force, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
          }),
          withSpring(0, { damping: 8, stiffness: 120, mass: 0.8 }),
        );
        tugRotate.value = withSequence(
          withTiming((Math.random() - 0.5) * 5, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
          }),
          withSpring(0, { damping: 10, stiffness: 150 }),
        );
      };
      const timeout = setTimeout(tug, 400 + index * 500);
      const interval = setInterval(tug, TUG_INTERVAL + index * 150);
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }, [isReady, isNearby, index]);

    // Stop tug when ready
    useEffect(() => {
      if (isReady) {
        tugX.value = withSpring(0, { damping: 12, stiffness: 100 });
        tugY.value = withSpring(0, { damping: 12, stiffness: 100 });
        tugRotate.value = withSpring(0, { damping: 12, stiffness: 100 });
      }
    }, [isReady]);

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

      return {
        transform: [
          { translateX: tugX.value },
          { translateY: bobY.value + tugY.value + discardY },
          { scale: scale * discardScale },
          { rotate: `${tugRotate.value + discardRotate}deg` },
        ],
        opacity: opacity * discardOpacity,
      };
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

    return (
      <Animated.View
        layout={LinearTransition.springify().damping(28).stiffness(180)}
        style={[
          s.card,
          { borderColor: tierMeta.text },
          isReady ? undefined : s.cardGenerating,
          animatedStyle,
        ]}
      >
        {/* Holographic foil overlay — only rendered for nearby cards */}
        {isReady && isNearby && (
          <HolographicFoil
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            variant={getCategoryFoilVariant(colorKey)}
            seed={hashString(option.id)}
            intensity={
              TIER_FOIL_INTENSITY[option.tier ?? "QUICK"] ??
              TIER_FOIL_INTENSITY.QUICK
            }
          />
        )}

        {/* Sheen sweep — only rendered for nearby cards */}
        {isNearby && (
          <CardSheen
            tierColor={tierMeta.text}
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
            isBrowse && onDelete
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onDelete(option);
                }
              : undefined
          }
        >
          {/* ═══ HEADER ═══ */}
          <View style={s.headerBand}>
            <Text style={[s.headerTier, { color: tierMeta.text }]}>
              {"\u2605"} {tierMeta.label}
            </Text>
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
            {option.city && (
              <Text style={s.artCity}>{option.city}</Text>
            )}
          </Animated.View>

          {/* ═══ TITLE PLATE ═══ */}
          <Animated.View style={[s.titlePlate, heroAnimStyle]}>
            <Text style={s.title} numberOfLines={2}>
              {option.title ?? "Sidequest"}
            </Text>
            {option.summary && (
              <Text style={s.subtitle} numberOfLines={1}>
                {option.summary.toUpperCase().split(/[.,:!]/, 1)[0].slice(0, 28)}
              </Text>
            )}
          </Animated.View>

          {/* ═══ GENERATING SKELETON ═══ */}
          {!isReady && (
            <Animated.View style={[s.skeletonBody, skeletonAnimStyle]}>
              <View style={s.forgingRow}>
                <Animated.Text style={[s.forgingLabel, { color: tierMeta.text }]}>
                  FORGING{"\u2026"}
                </Animated.Text>
              </View>
              <View style={[s.skeletonBar, s.skeletonBarWide, { backgroundColor: tierMeta.border }]} />
              <View style={[s.skeletonBar, s.skeletonBarMedium, { backgroundColor: tierMeta.border }]} />
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
                            isBrowse && obj.checkedInAt ? tierMeta.bg : "transparent",
                        },
                      ]}
                    >
                      <Text style={s.stopEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                    </View>
                    {i < arr.length - 1 && (
                      <View style={[s.stopLine, { backgroundColor: tierMeta.border }]} />
                    )}
                    <View style={s.stopText}>
                      <Text style={s.stopName}>
                        {(obj.venueName || obj.title || "Stop").split("|")[0].trim()}
                      </Text>
                      {obj.hook && (
                        <Text style={s.stopHook} numberOfLines={1}>
                          {obj.hook}
                        </Text>
                      )}
                    </View>
                  </View>
                ),
              )}
              {isBrowse && objectives.length > 3 && (
                <Text style={s.moreStops}>+{objectives.length - 3} more</Text>
              )}
            </Animated.View>
          )}

          {/* ═══ FLAVOR TEXT — shown when there's room ═══ */}
          {isReady && option.summary && objectives.length <= 3 && (
            <Animated.View
              style={[s.flavorBlock, { borderColor: tierMeta.border }]}
            >
              <Text style={s.flavorText}>
                {"\u201C"}{option.summary.split(/[.!]/)[0].trim()}.{"\u201D"}
              </Text>
              <Text style={s.flavorAttrib}>{"\u2014"} Quest lore</Text>
            </Animated.View>
          )}

          <View style={{ flex: 1 }} />

          {/* ═══ TAG CHIPS ═══ */}
          <View style={s.tagRow}>
            {cardTags.map((tag) => (
              <View key={tag} style={[s.tagChip, { borderColor: tierMeta.border }]}>
                <Text style={[s.tagText, { color: tierMeta.text }]}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* ═══ SERIAL FOOTER ═══ */}
          <View style={s.serialRow}>
            <Text style={s.serialNumber}>
              SQ{"\u00B7"}{(option.id ?? "").slice(0, 8).toUpperCase()}
            </Text>
            <Text style={s.serialNumber}>
              {"\u00B7"} {stopCount} STOPS
              {totalCost > 0 ? ` \u00B7 $${totalCost}` : ""}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={s.serialNumber}>
              {option.city?.toUpperCase() ?? ""}
            </Text>
          </View>
        </Pressable>

        {/* Blur overlay for off-center cards — only rendered for nearby cards */}
        {isNearby && <BlurOverlay scrollX={scrollX} index={index} />}
      </Animated.View>
    );
  },
);

QuestCard.displayName = "QuestCard";

const BlurOverlay: React.FC<{
  scrollX: SharedValue<number>;
  index: number;
}> = React.memo(({ scrollX, index }) => {
  const blurStyle = useAnimatedStyle(() => {
    const cardCenter = index * SNAP_WIDTH;
    const dist = Math.abs(cardCenter + scrollX.value);
    const opacity = interpolate(dist, [0, SNAP_WIDTH * 0.4, SNAP_WIDTH], [0, 0, 1], "clamp");
    return { opacity };
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { borderRadius: radius.sm, overflow: "hidden" }, blurStyle]}
      pointerEvents="none"
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

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

  // Reset scroll to first card when a new set of options arrives (select mode only)
  const optionIds = options.map((o) => o.id).join(",");
  useEffect(() => {
    if (!isBrowse) {
      activeIdx.value = 0;
      scrollX.value = withSpring(0, { damping: 20, stiffness: 150 });
    }
  }, [optionIds]);

  const handleSelect = useCallback(
    (option: SidequestResponse) => {
      if (isSelecting) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelect?.(option);
    },
    [isSelecting, onSelect],
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
              ? "Swipe to browse \u00B7 Tap to open \u00B7 Hold to delete"
              : "Swipe to browse \u00B7 Tap to select"}
          </Text>
        </>
      )}

      <GestureDetector gesture={panGesture}>
        <Animated.View style={s.carouselClip}>
          <Animated.View style={[s.carouselStrip, stripStyle]}>
            {options.map((option, idx) => (
              <QuestCard
                key={option.id ?? idx}
                option={option}
                index={idx}
                totalCards={totalCards}
                scrollX={scrollX}
                activeIdx={activeIdx}
                sheenTrigger={sheenTrigger}
                onSelect={handleSelect}
                onPress={onPress}
                onDelete={onDelete}
                onDiscardComplete={onDiscardComplete}
                isDiscarding={discardingId === option.id}
                mode={mode}
                activeItineraryId={activeItineraryId}
                colors={colors}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {DotIndicators}
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
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    headerCats: {
      fontSize: 8,
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
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    title: {
      fontSize: 16,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      lineHeight: 21,
    },
    subtitle: {
      fontSize: 8,
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
      gap: spacing.xs,
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
    stopLine: {
      position: "absolute",
      top: 32,
      left: 14,
      width: 1.5,
      height: 16,
      opacity: 0.4,
    },
    stopText: {
      flex: 1,
      paddingTop: 2,
      gap: 1,
    },
    stopName: {
      fontSize: 12,
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
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.sm - 3,
      borderWidth: 1,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    flavorText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      fontStyle: "italic",
      lineHeight: 15,
    },
    flavorAttrib: {
      fontSize: 7,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginTop: 2,
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
      fontSize: 7,
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
      fontSize: 7,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.2,
      opacity: 0.5,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
