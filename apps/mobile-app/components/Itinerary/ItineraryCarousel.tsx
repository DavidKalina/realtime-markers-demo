import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import {
  fontFamily,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import { ChevronDown, Play, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import ItineraryTimeline from "./ItineraryTimeline";
import ExpandableCard, { GREEN_ACCENT, STOP_COLORS } from "./ExpandableCard";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 50;

export interface ItineraryPreviewStop {
  coordinate: [number, number]; // [lng, lat]
  emoji: string;
  color: string;
  title: string;
}

interface ItineraryCarouselProps {
  style?: ViewStyle;
  /** Itineraries to display — passed from parent (shared with map markers) */
  itineraries: ItineraryResponse[];
  /** Externally controlled active index (e.g. from tapping a map marker) */
  activeIndex: number;
  /** Called when the user swipes to a different itinerary */
  onIndexChange: (index: number) => void;
  onBack?: () => void;
  onPreviewStop?: (stop: ItineraryPreviewStop | null) => void;
  /** Whether the orbit camera animation is currently running */
  isOrbiting?: boolean;
}

/** Extract the preview stop data for a given itinerary */
export function getFirstStop(
  itinerary: ItineraryResponse,
): ItineraryPreviewStop | null {
  const firstItem = [...itinerary.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((i) => i.latitude != null && i.longitude != null);
  if (!firstItem) return null;
  return {
    coordinate: [Number(firstItem.longitude), Number(firstItem.latitude)],
    emoji: firstItem.emoji || "\u{1F4CD}",
    color: STOP_COLORS[0],
    title: firstItem.title || "",
  };
}

const ItineraryCarousel: React.FC<ItineraryCarouselProps> = ({
  style,
  itineraries,
  activeIndex,
  onIndexChange,
  onBack,
  onPreviewStop,
  isOrbiting,
}) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [expanded, setExpanded] = useState(false);
  const activate = useActiveItineraryStore((state) => state.activate);
  const [activating, setActivating] = useState(false);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Stable ref for preview callback to avoid stale closures
  const onPreviewStopRef = useRef(onPreviewStop);
  onPreviewStopRef.current = onPreviewStop;

  // Re-engage orbit when card is tapped while not orbiting
  const handleReOrbit = useCallback(() => {
    if (isOrbiting || !onPreviewStopRef.current || itineraries.length === 0)
      return;
    const current = itineraries[activeIndex];
    if (!current) return;
    const stop = getFirstStop(current);
    if (!stop) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPreviewStopRef.current(stop);
  }, [isOrbiting, itineraries, activeIndex]);

  // Emit preview stop when index changes (swipe between itineraries)
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip the initial render — orbit is triggered by the map marker tap,
    // not by the carousel mounting.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!onPreviewStopRef.current || itineraries.length === 0) return;
    const current = itineraries[activeIndex];
    if (!current) return;
    const stop = getFirstStop(current);
    if (stop) onPreviewStopRef.current(stop);
  }, [activeIndex, itineraries]);

  // Clear preview on unmount
  useEffect(() => {
    return () => {
      onPreviewStopRef.current?.(null);
    };
  }, []);

  // Horizontal swipe tracking (collapsed only)
  const swipeX = useSharedValue(0);

  const collapsedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
    opacity: interpolate(
      Math.abs(swipeX.value),
      [0, SCREEN_WIDTH * 0.4],
      [1, 0],
    ),
  }));

  const goNext = useCallback(() => {
    const next = Math.min(activeIndex + 1, itineraries.length - 1);
    if (next !== activeIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onIndexChange(next);
    }
  }, [activeIndex, itineraries.length, onIndexChange]);

  const goPrev = useCallback(() => {
    const next = Math.max(activeIndex - 1, 0);
    if (next !== activeIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onIndexChange(next);
    }
  }, [activeIndex, onIndexChange]);

  // Tap to re-engage orbit when user has panned away
  const tapGesture = Gesture.Tap()
    .enabled(!expanded)
    .onEnd(() => {
      scheduleOnRN(handleReOrbit);
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .enabled(!expanded)
    .onUpdate((e) => {
      swipeX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        swipeX.value = withTiming(
          -SCREEN_WIDTH * 0.5,
          { duration: 150 },
          () => {
            scheduleOnRN(goNext);
            swipeX.value = SCREEN_WIDTH * 0.3;
            swipeX.value = withSpring(0, { damping: 18, stiffness: 200 });
          },
        );
      } else if (e.translationX > SWIPE_THRESHOLD) {
        swipeX.value = withTiming(SCREEN_WIDTH * 0.5, { duration: 150 }, () => {
          scheduleOnRN(goPrev);
          swipeX.value = -SCREEN_WIDTH * 0.3;
          swipeX.value = withSpring(0, { damping: 18, stiffness: 200 });
        });
      } else {
        swipeX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  // Activate
  const handleActivate = useCallback(async () => {
    const itinerary = itineraries[activeIndex];
    if (!itinerary) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivating(true);
    const success = await activate(itinerary);
    setActivating(false);
    if (!success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [itineraries, activeIndex, activate]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBack?.();
  }, [onBack]);

  if (itineraries.length === 0) return null;

  const current = itineraries[activeIndex];
  if (!current) return null;
  const sortedItems = [...current.items].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const meta = [
    current.city,
    `${current.durationHours}h`,
    `${current.items.length} stops`,
  ].join(" \u00B7 ");

  return (
    <Animated.View style={style}>
      <ExpandableCard
        expanded={expanded}
        onToggleExpand={toggleExpand}
        collapsedContent={
          <>
            <GestureDetector gesture={Gesture.Race(tapGesture, panGesture)}>
              <Animated.View style={[s.swipeArea, collapsedContentStyle]}>
                <View style={s.emojiTrail}>
                  {sortedItems.slice(0, 5).map((item, idx) => (
                    <View
                      key={item.id}
                      style={[
                        s.emojiDot,
                        {
                          backgroundColor:
                            STOP_COLORS[idx % STOP_COLORS.length],
                          marginLeft: idx > 0 ? -4 : 0,
                        },
                      ]}
                    >
                      <Text style={s.emojiText}>
                        {item.emoji || "\u{1F4CD}"}
                      </Text>
                    </View>
                  ))}
                  {sortedItems.length > 5 && (
                    <View style={[s.emojiDot, s.emojiMore]}>
                      <Text style={s.emojiMoreText}>
                        +{sortedItems.length - 5}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={s.titleCol}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {current.title || "Untitled Plan"}
                  </Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
              </Animated.View>
            </GestureDetector>

            {!expanded ? (
              <Pressable
                style={({ pressed }) => [
                  s.activateButton,
                  pressed && s.activateButtonPressed,
                  activating && s.activateButtonDisabled,
                ]}
                onPress={handleActivate}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Play size={12} color="#000" fill="#000" />
                    <Text style={s.activateText}>Go</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <ChevronDown size={14} color={colors.text.secondary} />
            )}
          </>
        }
        afterCollapsed={
          !expanded && itineraries.length > 1 ? (
            <View style={s.dotsRow}>
              {itineraries.map((c, i) => (
                <View
                  key={c.id}
                  style={[s.dot, i === activeIndex && s.dotActive]}
                />
              ))}
            </View>
          ) : undefined
        }
        expandedContent={
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces
              style={s.scrollView}
            >
              <ItineraryTimeline items={sortedItems} />
            </ScrollView>

            <View style={s.footerRow}>
              <Pressable style={s.cancelButton} onPress={handleBack}>
                <X size={14} color={colors.text.secondary} />
                <Text style={s.cancelText}>Back</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.goButton,
                  pressed && s.goButtonPressed,
                  activating && s.goButtonDisabled,
                ]}
                onPress={handleActivate}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Play size={12} color="#000" fill="#000" />
                    <Text style={s.goButtonText}>Start Adventure</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        }
      />
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    swipeArea: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    emojiTrail: {
      flexDirection: "row",
      alignItems: "center",
    },
    emojiDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.bg.card,
    },
    emojiText: {
      fontSize: 12,
    },
    emojiMore: {
      backgroundColor: colors.border.medium,
      marginLeft: -4,
    },
    emojiMoreText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    titleCol: {
      flex: 1,
      gap: 1,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    cardMeta: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    activateButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: GREEN_ACCENT,
      borderRadius: radius.md,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    activateButtonPressed: {
      backgroundColor: "#6ee7a0",
    },
    activateButtonDisabled: {
      opacity: 0.6,
    },
    activateText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: "#000",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      paddingBottom: 6,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.border.medium,
    },
    dotActive: {
      backgroundColor: GREEN_ACCENT,
      width: 14,
      borderRadius: 3,
    },
    scrollView: {
      flex: 1,
    },
    footerRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
    },
    cancelButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    cancelText: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
    },
    goButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: GREEN_ACCENT,
    },
    goButtonPressed: {
      backgroundColor: "#6ee7a0",
    },
    goButtonDisabled: {
      opacity: 0.6,
    },
    goButtonText: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#000",
    },
  });

export default ItineraryCarousel;
