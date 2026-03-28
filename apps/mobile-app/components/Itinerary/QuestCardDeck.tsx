import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
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
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = CARD_WIDTH * 1.4; // ~5:7 trading card ratio
const CARD_VERTICAL_OFFSET = 14;
const CARD_SCALE_STEP = 0.05;
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
  onSelect: (option: SidequestResponse) => void;
  isSelecting: boolean;
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
    const opacity = interpolate(progress, [0, 0.05, 0.5, 0.95, 1], [0, 0.8, 1, 0.8, 0]);

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
        <Rect width={SHEEN_BAND} height={SHEEN_TRAVEL} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
});

CardSheen.displayName = "CardSheen";

// --- Individual animated card ---

const QuestCard: React.FC<{
  option: SidequestResponse;
  index: number;
  totalCards: number;
  activeIndex: SharedValue<number>;
  swipeX: SharedValue<number>;
  sheenTrigger: SharedValue<number>;
  onSelect: (option: SidequestResponse) => void;
  colors: Colors;
}> = React.memo(
  ({ option, index, totalCards, activeIndex, swipeX, sheenTrigger, onSelect, colors }) => {
    const s = useMemo(() => createCardStyles(colors), [colors]);
    const tierMeta =
      TIER_DISPLAY[option.tier ?? "QUICK"] ?? TIER_DISPLAY.QUICK;

    // Bob animation — each card has a different phase
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

    const animatedStyle = useAnimatedStyle(() => {
      const pos = ((index - activeIndex.value) % totalCards + totalCards) % totalCards;

      // Front card (pos === 0) responds to swipe
      const isFront = pos === 0;
      const translateX = isFront ? swipeX.value : 0;

      // Stack offset: cards behind shift down and scale down
      const baseTranslateY = pos * CARD_VERTICAL_OFFSET;
      const scale = 1 - pos * CARD_SCALE_STEP;

      // Rotation on swipe for front card
      const rotate = isFront
        ? interpolate(swipeX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15])
        : 0;

      // Opacity: front card fades slightly during swipe, back cards are slightly dimmer
      const opacity = isFront
        ? interpolate(
            Math.abs(swipeX.value),
            [0, SCREEN_WIDTH * 0.5],
            [1, 0.7],
          )
        : interpolate(pos, [0, 1, 2], [1, 0.85, 0.7]);

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

    const objectives = (option.objectives ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    const totalCost = objectives.reduce((sum, o) => sum + (Number(o.estimatedCost) || 0), 0);
    const stopCount = objectives.length;

    return (
      <Animated.View style={[s.card, { borderColor: tierMeta.border }, animatedStyle]}>
        {/* Tier-colored top stripe */}
        <View style={[s.tierStripe, { backgroundColor: tierMeta.text }]} />

        {/* Diagonal sheen sweep */}
        <CardSheen tierColor={tierMeta.text} sheenTrigger={sheenTrigger} index={index} />

        <Pressable
          style={s.cardInner}
          onPress={() => onSelect(option)}
        >
          {/* Top: Tier badge */}
          <View style={s.tierRow}>
            <View style={[s.tierBadge, { backgroundColor: tierMeta.bg, borderColor: tierMeta.border, borderWidth: 1 }]}>
              <Text style={[s.tierBadgeText, { color: tierMeta.text }]}>
                {tierMeta.label}
              </Text>
            </View>
          </View>

          {/* Hero: emoji + title + summary */}
          <View style={s.heroBlock}>
            <Text style={s.emoji}>
              {objectives[0]?.emoji ?? "\u{1F3AF}"}
            </Text>
            <Text style={s.title} numberOfLines={2}>{option.title ?? "Sidequest"}</Text>
            {option.summary && (
              <Text style={s.summary} numberOfLines={2}>
                {option.summary}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Stops timeline */}
          <View style={s.stops}>
            {objectives.map((obj, i) => (
              <View key={obj.id} style={s.timelineRow}>
                {/* Timeline track: circle + connector line */}
                <View style={s.timelineTrack}>
                  <View style={[s.timelineCircle, { borderColor: tierMeta.border, backgroundColor: tierMeta.bg }]}>
                    <Text style={s.timelineEmoji}>{obj.emoji ?? "\u{1F4CD}"}</Text>
                  </View>
                  {i < objectives.length - 1 && (
                    <View style={[s.timelineLine, { backgroundColor: tierMeta.border }]} />
                  )}
                </View>
                {/* Stop content */}
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
            ))}
          </View>

          {/* Spacer to push footer down */}
          <View style={{ flex: 1 }} />

          {/* Bottom stats bar */}
          <View style={s.statsBar}>
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
            <View style={{ flex: 1 }} />
            <View style={[s.selectHint, { borderColor: tierMeta.border, backgroundColor: tierMeta.bg }]}>
              <Text style={[s.selectHintText, { color: tierMeta.text }]}>
                TAP TO SELECT
              </Text>
            </View>
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
  onSelect,
  isSelecting,
}) => {
  const colors = useColors();
  const s = useMemo(() => createDeckStyles(colors), [colors]);
  const totalCards = options.length;

  const activeIndex = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const sheenTrigger = useSharedValue(0);

  const handleSelect = useCallback(
    (option: SidequestResponse) => {
      if (isSelecting) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelect(option);
    },
    [isSelecting, onSelect],
  );

  const onSwipeComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sheenTrigger.value = sheenTrigger.value + 1;
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .enabled(!isSelecting)
    .onUpdate((e) => {
      swipeX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        // Swipe completed — animate out then cycle
        const direction = e.translationX > 0 ? 1 : -1;
        swipeX.value = withTiming(
          direction * SCREEN_WIDTH,
          { duration: 200, easing: Easing.in(Easing.cubic) },
          () => {
            // Cycle to next card
            activeIndex.value = (activeIndex.value + 1) % totalCards;
            swipeX.value = 0;
            scheduleOnRN(onSwipeComplete);
          },
        );
      } else {
        // Snap back
        swipeX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // Dot indicators
  const DotIndicators = useMemo(
    () => (
      <View style={s.dots}>
        {options.map((_, i) => (
          <DotIndicator
            key={options[i].id}
            index={i}
            activeIndex={activeIndex}
            totalCards={totalCards}
            colors={colors}
          />
        ))}
      </View>
    ),
    [options, totalCards, colors],
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(500)
        .duration(450)
        .easing(Easing.out(Easing.cubic))}
      style={s.container}
    >
      <Text style={s.label}>CHOOSE YOUR QUEST</Text>
      <Text style={s.hint}>Swipe to browse · Tap to select</Text>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={s.deckContainer}>
          {/* Render in reverse so the front card is on top for touches */}
          {[...options].reverse().map((option, reversedIdx) => {
            const originalIdx = totalCards - 1 - reversedIdx;
            return (
              <QuestCard
                key={option.id}
                option={option}
                index={originalIdx}
                totalCards={totalCards}
                activeIndex={activeIndex}
                swipeX={swipeX}
                sheenTrigger={sheenTrigger}
                onSelect={handleSelect}
                colors={colors}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>

      {DotIndicators}
    </Animated.View>
  );
};

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
      width: isActive ? 16 : 6,
      backgroundColor: isActive ? "#86efac" : colors.border.default,
      opacity: isActive ? 1 : 0.5,
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
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      letterSpacing: 1,
    },
    hint: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.disabled,
      marginBottom: spacing.xs,
    },
    deckContainer: {
      height: CARD_HEIGHT + CARD_VERTICAL_OFFSET * 2 + 20,
      alignItems: "center",
      position: "relative",
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
      position: "absolute",
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      top: 0,
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
  });
