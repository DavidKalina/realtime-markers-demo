import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronRight, X } from "lucide-react-native";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import ItineraryTimeline from "./ItineraryTimeline";
import {
  useColors,
  type Colors,
  fontWeight,
  fontFamily,
  spacing,
} from "@/theme";
import { scheduleOnRN } from "react-native-worklets";

const COLLAPSED_HEIGHT = 70;
const EXPANDED_HEIGHT = 420;
const SHEEN_WIDTH = 100;
const GREEN_ACCENT = "#86efac";
const DISMISS_THRESHOLD = 80;

const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

interface AdventureHUDProps {
  style?: ViewStyle;
}

const AdventureHUD: React.FC<AdventureHUDProps> = ({ style }) => {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const itinerary = useActiveItineraryStore((s) => s.itinerary);
  const deactivate = useActiveItineraryStore((s) => s.deactivate);

  const [expanded, setExpanded] = useState(false);
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

  // Swipe offset (collapsed only)
  const swipeY = useSharedValue(0);
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeY.value }],
    opacity: interpolate(swipeY.value, [0, DISMISS_THRESHOLD], [1, 0.3]),
  }));

  const dismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deactivate();
  }, [deactivate]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([10, 10])
    .failOffsetX([-15, 15])
    .enabled(!expanded)
    .onUpdate((e) => {
      swipeY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD) {
        swipeY.value = withTiming(200, { duration: 200 });
        scheduleOnRN(dismiss);
      } else {
        swipeY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  // Sheen animation (collapsed only)
  const sheenPos = useSharedValue(0);
  const sheenActive = useSharedValue(1);
  const [containerMeasured, setContainerMeasured] = useState(false);
  const containerWidthSV = useSharedValue(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, []);

  useEffect(() => {
    if (expanded) return;
    const runSheen = () => {
      sheenActive.value = 1;
      sheenPos.value = 0;
      sheenPos.value = withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      });
    };
    const initialTimeout = setTimeout(runSheen, 1500);
    const interval = setInterval(runSheen, 15000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [expanded]);

  const sheenAnimStyle = useAnimatedStyle(() => {
    if (sheenActive.value === 0) return { opacity: 0 };
    const translateX =
      containerWidthSV.value > 0
        ? interpolate(
            sheenPos.value,
            [0, 1],
            [-SHEEN_WIDTH, containerWidthSV.value + SHEEN_WIDTH],
          )
        : -SHEEN_WIDTH;
    const opacity = interpolate(
      sheenPos.value,
      [0, 0.05, 0.95, 1],
      [0, 0.8, 0.8, 0],
    );
    return { opacity, transform: [{ translateX }] };
  });

  const handleViewDetail = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/itineraries/${itinerary!.id}` as const);
  }, [itinerary, router]);

  if (!itinerary) return null;

  const items = itinerary.items || [];
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const checked = items.filter((i) => i.checkedInAt).length;
  const total = items.length;
  const progress = total > 0 ? checked / total : 0;

  const nextStop = sortedItems.find((i) => !i.checkedInAt);
  const nextStopIdx = nextStop
    ? sortedItems.indexOf(nextStop)
    : sortedItems.length - 1;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[style, swipeStyle]}>
        <Animated.View
          style={[s.bubble, containerStyle]}
          onLayout={handleLayout}
        >
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Collapsed row — tappable to expand */}
          <Pressable style={s.contentRow} onPress={toggleExpand}>
            {nextStop && (
              <View
                style={[
                  s.emojiDot,
                  {
                    backgroundColor:
                      STOP_COLORS[nextStopIdx % STOP_COLORS.length],
                  },
                ]}
              >
                <Text style={s.emojiText}>{nextStop.emoji || "\u{1F4CD}"}</Text>
              </View>
            )}

            <View style={s.titleCol}>
              <Text style={s.cardTitle} numberOfLines={1}>
                {itinerary.title || "Active Adventure"}
              </Text>
              <Text style={s.cardMeta} numberOfLines={1}>
                {nextStop
                  ? `Next: ${nextStop.title}`
                  : `${checked}/${total} stops`}
              </Text>
            </View>

            <View style={s.progressPill}>
              <Text style={s.progressPillText}>
                {checked}/{total}
              </Text>
            </View>

            {expanded ? (
              <ChevronDown size={14} color={colors.text.secondary} />
            ) : (
              <ChevronRight size={14} color={colors.text.secondary} />
            )}
          </Pressable>

          {/* Expanded content */}
          <Animated.View style={[s.expandedContent, expandedContentStyle]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces
              style={s.scrollView}
            >
              <ItineraryTimeline items={sortedItems} isActive />
            </ScrollView>

            <View style={s.footerRow}>
              <Pressable style={s.cancelButton} onPress={dismiss}>
                <X size={14} color={colors.text.secondary} />
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.viewButton} onPress={handleViewDetail}>
                <Text style={s.viewButtonText}>View Details</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Sheen sweep (collapsed only) */}
          {!expanded && containerMeasured && (
            <Animated.View
              style={[s.sheenBeam, sheenAnimStyle]}
              pointerEvents="none"
            >
              <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
                <Defs>
                  <LinearGradient id="advSheen" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={GREEN_ACCENT} stopOpacity="0" />
                    <Stop offset="0.3" stopColor="#a8e6c0" stopOpacity="0.3" />
                    <Stop offset="0.5" stopColor="#d4f5e0" stopOpacity="0.5" />
                    <Stop offset="0.7" stopColor="#a8e6c0" stopOpacity="0.3" />
                    <Stop offset="1" stopColor={GREEN_ACCENT} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width={SHEEN_WIDTH}
                  height={COLLAPSED_HEIGHT}
                  fill="url(#advSheen)"
                />
              </Svg>
            </Animated.View>
          )}

          {/* Progress bar along bottom edge */}
          <View style={s.progressTrack}>
            <ProgressFill progress={progress} />
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const ProgressFill: React.FC<{ progress: number }> = ({ progress }) => {
  const animStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round(progress * 100)}%` as unknown as number, {
      duration: 600,
    }),
  }));

  return (
    <Animated.View
      style={[
        {
          height: "100%",
          backgroundColor: GREEN_ACCENT,
        },
        animStyle,
      ]}
    />
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
    emojiDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.bg.card,
    },
    emojiText: {
      fontSize: 14,
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
    progressPill: {
      backgroundColor: colors.border.medium,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    progressPillText: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
    },
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
    viewButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: GREEN_ACCENT,
    },
    viewButtonText: {
      fontSize: 12,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: "#000",
    },
    sheenBeam: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 1,
    },
    progressTrack: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: colors.border.medium,
      zIndex: 4,
    },
  });

export default AdventureHUD;
