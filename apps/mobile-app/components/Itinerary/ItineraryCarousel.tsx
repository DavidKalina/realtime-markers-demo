import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { apiClient } from "@/services/ApiClient";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useMapModeStore } from "@/stores/useMapModeStore";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import ItineraryTimeline from "./ItineraryTimeline";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 50;
const COLLAPSED_HEIGHT = 70;
const EXPANDED_HEIGHT = 420;
const GREEN_ACCENT = "#86efac";

const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

export interface ItineraryPreviewStop {
  coordinate: [number, number]; // [lng, lat]
  emoji: string;
  color: string;
  title: string;
}

interface ItineraryCarouselProps {
  style?: ViewStyle;
  onBack?: () => void;
  onPreviewStop?: (stop: ItineraryPreviewStop | null) => void;
}

const ItineraryCarousel: React.FC<ItineraryCarouselProps> = ({
  style,
  onBack,
  onPreviewStop,
}) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const activate = useActiveItineraryStore((state) => state.activate);
  const [activating, setActivating] = useState(false);

  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const contentOpacity = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const toggleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expanded) {
      contentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(COLLAPSED_HEIGHT, { duration: 250 });
      setExpanded(false);
    } else {
      animHeight.value = withTiming(EXPANDED_HEIGHT, { duration: 300 });
      contentOpacity.value = withTiming(1, { duration: 200 });
      setExpanded(true);
    }
  }, [expanded, animHeight, contentOpacity]);

  const fetchItineraries = useCallback(async () => {
    try {
      const result = await apiClient.itineraries.list(10);
      setItineraries(
        (result.data ?? []).filter(
          (it) => it.status === "READY" && !it.completedAt,
        ),
      );
    } catch (err) {
      console.error("[ItineraryCarousel] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItineraries();
  }, [fetchItineraries]);

  // Emit preview stop when index changes or itineraries load
  useEffect(() => {
    if (!onPreviewStop || itineraries.length === 0) return;
    const current = itineraries[activeIndex];
    if (!current) return;
    const firstStop = [...current.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((i) => i.latitude != null && i.longitude != null);
    if (firstStop) {
      onPreviewStop({
        coordinate: [Number(firstStop.longitude), Number(firstStop.latitude)],
        emoji: firstStop.emoji || "\u{1F4CD}",
        color: STOP_COLORS[0],
        title: firstStop.title || "",
      });
    }
  }, [activeIndex, itineraries, onPreviewStop]);

  // Clear preview on unmount
  useEffect(() => {
    return () => {
      onPreviewStop?.(null);
    };
  }, [onPreviewStop]);

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
    setActiveIndex((prev) => {
      const next = Math.min(prev + 1, itineraries.length - 1);
      if (next !== prev) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  }, [itineraries.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next !== prev) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  }, []);

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
            runOnJS(goNext)();
            swipeX.value = SCREEN_WIDTH * 0.3;
            swipeX.value = withSpring(0, { damping: 18, stiffness: 200 });
          },
        );
      } else if (e.translationX > SWIPE_THRESHOLD) {
        swipeX.value = withTiming(SCREEN_WIDTH * 0.5, { duration: 150 }, () => {
          runOnJS(goPrev)();
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
    if (success) {
      useMapModeStore.getState().enterItineraryMode();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [itineraries, activeIndex, activate]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onBack?.();
  }, [onBack]);

  if (loading || itineraries.length === 0) return null;

  const current = itineraries[activeIndex];
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
      <Animated.View style={[s.bubble, containerStyle]}>
        {/* Handle */}
        <View style={s.handleRow}>
          <View style={s.handle} />
        </View>

        {/* Collapsed row */}
        <Pressable style={s.contentRow} onPress={toggleExpand}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[s.swipeArea, collapsedContentStyle]}>
              <View style={s.emojiTrail}>
                {sortedItems.slice(0, 5).map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      s.emojiDot,
                      {
                        backgroundColor: STOP_COLORS[idx % STOP_COLORS.length],
                        marginLeft: idx > 0 ? -4 : 0,
                      },
                    ]}
                  >
                    <Text style={s.emojiText}>{item.emoji || "\u{1F4CD}"}</Text>
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
        </Pressable>

        {/* Dots (collapsed only) */}
        {!expanded && itineraries.length > 1 && (
          <View style={s.dotsRow}>
            {itineraries.map((c, i) => (
              <View
                key={c.id}
                style={[s.dot, i === activeIndex && s.dotActive]}
              />
            ))}
          </View>
        )}

        {/* Expanded content */}
        <Animated.View style={[s.expandedContent, expandedContentStyle]}>
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
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bubble: {
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border.subtle,
      paddingTop: 4,
      marginBottom: -spacing.lg,
      overflow: "hidden",
    },
    handleRow: {
      alignItems: "center",
      paddingBottom: 6,
    },
    handle: {
      width: 32,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
    },
    contentRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: 10,
      gap: spacing.sm,
    },
    swipeArea: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },

    // Emoji trail
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

    // Activate (collapsed)
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

    // Dots
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

    // Expanded
    expandedContent: {
      flex: 1,
      paddingHorizontal: spacing.md,
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
