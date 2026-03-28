import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
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

import type { SidequestResponse } from "@/services/api/modules/sidequests";
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
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // ~5:7 trading card ratio
const CARD_GAP = 12;
const SNAP_WIDTH = CARD_WIDTH + CARD_GAP; // distance between card centers
const BOB_AMPLITUDE = 3;
const BOB_DURATION = 2400;

const TIER_DISPLAY: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  QUICK: {
    label: "QUICK & EASY",
    bg: "rgba(134, 239, 172, 0.12)",
    text: "rgba(134, 239, 172, 0.9)",
    border: "rgba(134, 239, 172, 0.25)",
  },
  SWEET_SPOT: {
    label: "SWEET SPOT",
    bg: "rgba(251, 191, 36, 0.12)",
    text: "rgba(251, 191, 36, 0.9)",
    border: "rgba(251, 191, 36, 0.25)",
  },
  BEST: {
    label: "BEST PACKAGE",
    bg: "rgba(168, 85, 247, 0.12)",
    text: "rgba(168, 85, 247, 0.9)",
    border: "rgba(168, 85, 247, 0.25)",
  },
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

// --- Tug animation constants ---
const TUG_FORCE = 14;
const TUG_INTERVAL = 2200;

// --- Individual animated card (handles GENERATING + READY states) ---

const QuestCard: React.FC<{
  option: SidequestResponse;
  index: number;
  totalCards: number;
  scrollX: SharedValue<number>;
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
    const tierMeta = TIER_DISPLAY[option.tier ?? "QUICK"] ?? TIER_DISPLAY.QUICK;
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

    // Bob animation
    const bobY = useSharedValue(0);
    useEffect(() => {
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
    }, [index]);

    // Tug animation (only while generating)
    const tugX = useSharedValue(0);
    const tugY = useSharedValue(0);
    const tugRotate = useSharedValue(0);

    useEffect(() => {
      if (isReady) return;
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
    }, [isReady, index]);

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

    return (
      <Animated.View
        style={[
          s.card,
          { borderColor: tierMeta.border },
          isReady ? undefined : s.cardGenerating,
          animatedStyle,
        ]}
      >
        {/* Tier-colored top stripe */}
        <View style={[s.tierStripe, { backgroundColor: tierMeta.text }]} />

        {/* Sheen: on swipe trigger + on reveal */}
        <CardSheen
          tierColor={tierMeta.text}
          sheenTrigger={isReady ? sheenTrigger : revealSheen}
          index={index}
        />

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
          {/* Top: Tier badge + status */}
          <View style={s.tierRow}>
            <View
              style={[
                s.tierBadge,
                {
                  backgroundColor: tierMeta.bg,
                  borderColor: tierMeta.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[s.tierBadgeText, { color: tierMeta.text }]}>
                {tierMeta.label}
              </Text>
            </View>
            {isBrowse ? (
              <View
                style={[
                  s.statusBadge,
                  {
                    backgroundColor: isCompleted
                      ? "rgba(134, 239, 172, 0.12)"
                      : isActiveQuest
                        ? "rgba(251, 191, 36, 0.12)"
                        : tierMeta.bg,
                    borderColor: isCompleted
                      ? "rgba(134, 239, 172, 0.9)"
                      : isActiveQuest
                        ? "rgba(251, 191, 36, 0.9)"
                        : tierMeta.border,
                  },
                ]}
              >
                {isCompleted && (
                  <Check
                    size={9}
                    color="rgba(134, 239, 172, 0.9)"
                    strokeWidth={3}
                  />
                )}
                {isActiveQuest && (
                  <View
                    style={[
                      s.activeDot,
                      { backgroundColor: "rgba(251, 191, 36, 0.9)" },
                    ]}
                  />
                )}
                <Text
                  style={[
                    s.statusText,
                    {
                      color: isCompleted
                        ? "rgba(134, 239, 172, 0.9)"
                        : isActiveQuest
                          ? "rgba(251, 191, 36, 0.9)"
                          : tierMeta.text,
                    },
                  ]}
                >
                  {isCompleted
                    ? `DONE${option.rating ? " " + "\u2605".repeat(option.rating) : ""}`
                    : isActiveQuest
                      ? `${checkedInCount}/${stopCount}`
                      : "READY"}
                </Text>
              </View>
            ) : (
              !isReady && (
                <Animated.Text
                  style={[
                    s.forgingLabel,
                    { color: tierMeta.text },
                    skeletonAnimStyle,
                  ]}
                >
                  FORGING{"\u2026"}
                </Animated.Text>
              )
            )}
          </View>

          {/* --- GENERATING skeleton (stays rendered, fades out) --- */}
          {!isReady && (
            <Animated.View style={[s.skeletonBody, skeletonAnimStyle]}>
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
              <View style={s.skeletonDivider} />
              <View style={s.skeletonStopRow}>
                <View
                  style={[s.skeletonDot, { borderColor: tierMeta.border }]}
                />
                <View
                  style={[
                    s.skeletonBar,
                    { flex: 1, backgroundColor: tierMeta.border },
                  ]}
                />
              </View>
              <View style={s.skeletonStopRow}>
                <View
                  style={[s.skeletonDot, { borderColor: tierMeta.border }]}
                />
                <View
                  style={[
                    s.skeletonBar,
                    { flex: 1, backgroundColor: tierMeta.border },
                  ]}
                />
              </View>
            </Animated.View>
          )}

          {/* --- READY content (staggered reveal) --- */}
          <View
            style={s.readyContent}
            pointerEvents={isReady ? "auto" : "none"}
          >
            {/* Hero */}
            <Animated.View style={[s.heroBlock, heroAnimStyle]}>
              <Text style={s.emoji}>{objectives[0]?.emoji ?? "\u{1F3AF}"}</Text>
              <Text style={s.title} numberOfLines={2}>
                {option.title ?? "Sidequest"}
              </Text>
              {option.summary && (
                <Text style={s.summary} numberOfLines={2}>
                  {option.summary}
                </Text>
              )}
            </Animated.View>

            <Animated.View style={dividerAnimStyle}>
              <View style={s.divider} />
            </Animated.View>

            {/* Timeline */}
            <Animated.View style={[s.stops, stopsAnimStyle]}>
              {(isBrowse ? objectives.slice(0, 4) : objectives).map(
                (obj, i, arr) => (
                  <View key={obj.id} style={s.timelineRow}>
                    <View style={s.timelineTrack}>
                      <View
                        style={[
                          s.timelineCircle,
                          {
                            borderColor: tierMeta.border,
                            backgroundColor:
                              isBrowse && obj.checkedInAt
                                ? tierMeta.bg
                                : isBrowse
                                  ? "transparent"
                                  : tierMeta.bg,
                          },
                        ]}
                      >
                        <Text style={s.timelineEmoji}>
                          {obj.emoji ?? "\u{1F4CD}"}
                        </Text>
                      </View>
                      {i < arr.length - 1 && (
                        <View
                          style={[
                            s.timelineLine,
                            { backgroundColor: tierMeta.border },
                          ]}
                        />
                      )}
                    </View>
                    <View style={s.timelineContent}>
                      <Text style={s.stopName} numberOfLines={1}>
                        {obj.venueName ?? obj.title}
                      </Text>
                      {obj.hook && (
                        <Text style={s.stopHook} numberOfLines={2}>
                          {obj.hook}
                        </Text>
                      )}
                    </View>
                  </View>
                ),
              )}
              {isBrowse && objectives.length > 4 && (
                <Text style={s.moreStops}>+{objectives.length - 4} more</Text>
              )}
            </Animated.View>

            <View style={{ flex: 1 }} />

            {/* Tags */}
            <Animated.View style={tagsAnimStyle}>
              {(() => {
                const tags = new Set<string>();
                for (const c of option.categories ?? []) tags.add(c);
                for (const a of option.activityTypes ?? []) tags.add(a);
                for (const obj of objectives) {
                  if (obj.venueCategory) tags.add(obj.venueCategory);
                }
                const tagList = [...tags].slice(0, 5);
                if (tagList.length === 0) return null;
                return (
                  <View style={s.tagRow}>
                    {tagList.map((tag) => (
                      <View
                        key={tag}
                        style={[s.tagChip, { borderColor: tierMeta.border }]}
                      >
                        <Text style={[s.tagText, { color: tierMeta.text }]}>
                          {tag.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </Animated.View>

            {/* Stats bar */}
            <Animated.View style={[s.statsBar, statsAnimStyle]}>
              <View style={s.statPill}>
                <Text style={s.statValue}>{stopCount}</Text>
                <Text style={s.statLabel}>STOPS</Text>
              </View>
              {totalCost > 0 && (
                <View style={s.statPill}>
                  <Text style={s.statValue}>~${totalCost}</Text>
                  <Text style={s.statLabel}>EST.</Text>
                </View>
              )}
              {isBrowse && isActiveQuest && stopCount > 0 && (
                <View style={s.statPill}>
                  <Text style={s.statValue}>
                    {Math.round((checkedInCount / stopCount) * 100)}%
                  </Text>
                  <Text style={s.statLabel}>DONE</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              {isBrowse ? (
                option.city ? (
                  <Text style={s.cityText}>{option.city}</Text>
                ) : null
              ) : (
                <View
                  style={[
                    s.selectHint,
                    {
                      borderColor: tierMeta.border,
                      backgroundColor: tierMeta.bg,
                    },
                  ]}
                >
                  <Text style={[s.selectHintText, { color: tierMeta.text }]}>
                    TAP TO SELECT
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

QuestCard.displayName = "QuestCard";

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
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .enabled(!isSelecting && totalCards > 1)
    .onUpdate((e) => {
      scrollX.value = -activeIdx.value * SNAP_WIDTH + e.translationX;
    })
    .onEnd((e) => {
      // Determine which card to snap to based on velocity + position
      const projected = scrollX.value + e.velocityX * 0.15;
      let snapIdx = Math.round(-projected / SNAP_WIDTH);
      snapIdx = Math.max(0, Math.min(totalCards - 1, snapIdx));
      const changed = snapIdx !== activeIdx.value;
      activeIdx.value = snapIdx;
      scrollX.value = withSpring(
        -snapIdx * SNAP_WIDTH,
        {
          damping: 20,
          stiffness: 200,
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
            key={options[i].id}
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
      <Text style={s.label}>
        {isBrowse ? "YOUR QUESTS" : "CHOOSE YOUR QUEST"}
      </Text>
      <Text style={s.hint}>
        {isBrowse
          ? "Swipe to browse \u00B7 Tap to open \u00B7 Hold to delete"
          : "Swipe to browse \u00B7 Tap to select"}
      </Text>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={s.carouselClip}>
          <Animated.View style={[s.carouselStrip, stripStyle]}>
            {options.map((option, idx) => (
              <QuestCard
                key={option.id}
                option={option}
                index={idx}
                totalCards={totalCards}
                scrollX={scrollX}
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

const createCardStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: "hidden",
      shadowColor: colors.fixed.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    cardGenerating: {
      borderStyle: "dashed",
    },
    tierStripe: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      opacity: 0.8,
    },
    cardInner: {
      flex: 1,
      padding: spacing.lg,
      paddingTop: spacing.lg + 2,
      gap: spacing.sm,
      overflow: "hidden",
    },
    tierRow: {
      flexDirection: "row",
      alignItems: "center",
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
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: 2,
    },
    forgingLabel: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
      marginLeft: "auto",
    },
    readyContent: {
      ...StyleSheet.absoluteFillObject,
      top: 42,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    skeletonBody: {
      flex: 1,
      gap: spacing.md,
      paddingTop: spacing.md,
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
    skeletonDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.default,
      marginVertical: spacing.xs,
    },
    skeletonStopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    skeletonDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      opacity: 0.3,
    },
    tierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    tierBadgeText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.8,
    },
    summary: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    stops: {
      gap: 0,
    },
    timelineRow: {
      flexDirection: "row",
      minHeight: 44,
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
      alignItems: "center",
      justifyContent: "center",
    },
    timelineEmoji: {
      fontSize: 13,
    },
    timelineLine: {
      width: 1.5,
      flex: 1,
      marginVertical: 2,
      opacity: 0.4,
    },
    timelineContent: {
      flex: 1,
      paddingLeft: 8,
      paddingTop: 3,
      paddingBottom: 8,
      gap: 1,
    },
    stopHook: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      fontStyle: "italic",
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
    },
    tagChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.full,
      borderWidth: 1,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    tagText: {
      fontSize: 8,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 0.5,
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
    selectHint: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    selectHintText: {
      fontSize: 8,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    stopName: {
      flex: 1,
      fontSize: fontSize.sm,
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
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    cityText: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
  });
