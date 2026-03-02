import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Reanimated, {
  FadeInDown,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { colors, spacing, fontFamily } from "@/theme";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
// --- Constants ---

const COLLAPSED_HEIGHT = 44;
const SHEEN_WIDTH = 100;

export const CHARS_PER_PAGE = 200;
export const CHAR_DELAY_MS = 20;
export const AUTO_ADVANCE_MS = 2500;
export const BAR_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#fda4af",
];

// --- Helpers ---

export function splitIntoPages(text: string, maxChars: number): string[] {
  // Split on newlines first — each line is a complete thought from the LLM
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pages: string[] = [];

  for (const line of lines) {
    if (line.length <= maxChars) {
      pages.push(line);
    } else {
      // Fallback: word-wrap lines that exceed maxChars
      const words = line.split(/\s+/);
      let current = "";
      for (const word of words) {
        const candidate = current ? current + " " + word : word;
        if (candidate.length > maxChars && current) {
          pages.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) pages.push(current);
    }
  }

  return pages;
}

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  if (mins < 60) return mins <= 1 ? "Now" : `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export function getRadiusForZoom(zoom: number): number {
  if (zoom >= 15) return 500;
  if (zoom >= 12) return 2000;
  if (zoom >= 10) return 5000;
  return 15000;
}

// --- Sub-components ---

export function ZoneHeader({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={zoneStyles.container}
    >
      <Text style={zoneStyles.emoji}>{zoneStats.topEmoji}</Text>
      <Text style={zoneStyles.name}>{zoneStats.zoneName.toUpperCase()}</Text>
      <View style={zoneStyles.divider} />
      <Text style={zoneStyles.subtitle}>
        {zoneStats.eventCount === 0
          ? "No events nearby"
          : `${zoneStats.eventCount} event${zoneStats.eventCount !== 1 ? "s" : ""} nearby`}
      </Text>
    </Reanimated.View>
  );
}

export function CategoryBarChart({
  breakdown,
}: {
  breakdown: AreaScanMetadata["categoryBreakdown"];
}) {
  if (breakdown.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(200)}
      style={barStyles.container}
    >
      <View style={barStyles.bar}>
        {breakdown.map((cat, i) => (
          <View
            key={cat.name}
            style={[
              barStyles.segment,
              {
                flex: cat.pct,
                backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === breakdown.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === breakdown.length - 1 ? 4 : 0,
              },
            ]}
          />
        ))}
      </View>
      <View style={barStyles.legend}>
        {breakdown.map((cat, i) => (
          <View key={cat.name} style={barStyles.legendItem}>
            <View
              style={[
                barStyles.legendDot,
                { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
              ]}
            />
            <Text style={barStyles.legendText}>
              {cat.name} {cat.pct}%
            </Text>
          </View>
        ))}
      </View>
    </Reanimated.View>
  );
}

// --- Pie Chart ---

const PIE_SIZE = 80;
const PIE_RADIUS = 30;
const PIE_STROKE = 8;
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS;

function PieSegment({
  color,
  arcLength,
  offset,
  index,
}: {
  color: string;
  arcLength: number;
  offset: number;
  index: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 80,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const currentArc = arcLength * progress.value;
    return {
      strokeDasharray: [currentArc, PIE_CIRCUMFERENCE - currentArc],
    };
  });

  return (
    <AnimatedCircle
      cx={PIE_SIZE / 2}
      cy={PIE_SIZE / 2}
      r={PIE_RADIUS}
      fill="none"
      stroke={color}
      strokeWidth={PIE_STROKE}
      strokeLinecap="butt"
      strokeDashoffset={-offset}
      animatedProps={animatedProps}
    />
  );
}

export function CategoryPieChart({
  breakdown,
  colors: colorsProp,
}: {
  breakdown: AreaScanMetadata["categoryBreakdown"];
  colors?: string[];
}) {
  const palette = colorsProp || BAR_COLORS;
  const segments = useMemo(() => {
    let offset = 0;
    return breakdown.map((cat, i) => {
      const arcLength = (cat.pct / 100) * PIE_CIRCUMFERENCE;
      const seg = {
        key: cat.name,
        color: palette[i % palette.length],
        arcLength,
        offset,
        index: i,
      };
      offset += arcLength;
      return seg;
    });
  }, [breakdown, palette]);

  return (
    <Svg
      width={PIE_SIZE}
      height={PIE_SIZE}
      viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
    >
      <Circle
        cx={PIE_SIZE / 2}
        cy={PIE_SIZE / 2}
        r={PIE_RADIUS}
        fill="none"
        stroke={colors.border.default}
        strokeWidth={PIE_STROKE}
        opacity={0.3}
      />
      {segments.map((seg) => (
        <PieSegment
          key={seg.key}
          color={seg.color}
          arcLength={seg.arcLength}
          offset={seg.offset}
          index={seg.index}
        />
      ))}
    </Svg>
  );
}

// --- ZoneHero (combined header + pie) ---

export function ZoneHero({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={heroStyles.container}
    >
      <View style={heroStyles.headerRow}>
        <Text style={heroStyles.emoji}>{zoneStats.topEmoji}</Text>
        <View style={heroStyles.headerText}>
          <Text style={heroStyles.name}>
            {zoneStats.zoneName.toUpperCase()}
          </Text>
          <Text style={heroStyles.subtitle}>
            {zoneStats.eventCount === 0
              ? "No events nearby"
              : `${zoneStats.eventCount} event${zoneStats.eventCount !== 1 ? "s" : ""} nearby`}
          </Text>
        </View>
      </View>
    </Reanimated.View>
  );
}

export function StatPillRow({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  const pills: { emoji: string; value: string; label: string }[] = [];

  if (zoneStats.totalViews > 0) {
    pills.push({
      emoji: "👁",
      value: formatNumber(zoneStats.totalViews),
      label: "views",
    });
  }
  if (zoneStats.totalSaves > 0) {
    pills.push({
      emoji: "💾",
      value: formatNumber(zoneStats.totalSaves),
      label: "saves",
    });
  }
  if (zoneStats.avgDistance > 0) {
    pills.push({
      emoji: "📏",
      value: `${zoneStats.avgDistance}m`,
      label: "avg",
    });
  }
  if (zoneStats.recurringCount > 0) {
    pills.push({
      emoji: "🔄",
      value: String(zoneStats.recurringCount),
      label: "recurring",
    });
  }

  if (pills.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(400)}
      style={pillStyles.row}
    >
      {pills.map((pill) => (
        <View key={pill.label} style={pillStyles.pill}>
          <Text style={pillStyles.pillEmoji}>{pill.emoji}</Text>
          <Text style={pillStyles.pillValue}>{pill.value}</Text>
          <Text style={pillStyles.pillLabel}>{pill.label}</Text>
        </View>
      ))}
    </Reanimated.View>
  );
}

export function ZoneEncounters({
  events,
  onEventPress,
}: {
  events: AreaScanMetadata["events"];
  onEventPress: (eventId: string) => void;
}) {
  if (!events || events.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400).delay(600)}
      style={encounterStyles.container}
    >
      <Text style={encounterStyles.header}>ZONE ENCOUNTERS</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {events.map((event, i) => (
          <View key={event.id}>
            {i > 0 && <View style={encounterStyles.separator} />}
            <Pressable
              style={encounterStyles.row}
              onPress={() => onEventPress(event.id)}
            >
              <Text style={encounterStyles.emoji}>{event.emoji}</Text>
              <View style={encounterStyles.info}>
                <View style={encounterStyles.topLine}>
                  <Text style={encounterStyles.title} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={encounterStyles.timeBadge}>
                    {formatRelativeTime(event.eventDate)}
                  </Text>
                </View>
                <Text style={encounterStyles.subtitle} numberOfLines={1}>
                  {event.categoryNames.split(",")[0]?.trim() || "Event"}
                  {" · "}
                  {event.distance}m
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Reanimated.View>
  );
}

// --- useDialogStreamer hook ---

export interface DialogStreamerState {
  pages: string[];
  pageIndex: number;
  displayText: string;
  pageComplete: boolean;
  isLastPage: boolean;
  showContinue: boolean;
  showDone: boolean;
  blinkAnim: Animated.Value;
  handleTap: () => void;
}

export function useDialogStreamer(
  onDismiss: () => void,
): DialogStreamerState & {
  feedPages: (newPages: string[]) => void;
  restart: () => void;
} {
  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [pageComplete, setPageComplete] = useState(false);

  const streamTimerRef = useRef<number>(null);
  const autoAdvanceRef = useRef<number>(null);
  const charIndexRef = useRef(0);
  const currentPageTextRef = useRef("");
  const mountedRef = useRef(true);

  const blinkAnim = useRef(new Animated.Value(1)).current;

  const streamPage = useCallback((text: string) => {
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    setDisplayText("");
    setPageComplete(false);
    charIndexRef.current = 0;
    currentPageTextRef.current = text;

    const tick = () => {
      if (!mountedRef.current) return;
      const i = charIndexRef.current;
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        charIndexRef.current = i + 1;
        if (i % 4 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
        streamTimerRef.current = setTimeout(tick, CHAR_DELAY_MS);
      } else {
        setPageComplete(true);
        streamTimerRef.current = null;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    };

    streamTimerRef.current = setTimeout(tick, 60);
  }, []);

  const feedPages = useCallback(
    (newPages: string[]) => {
      if (!mountedRef.current) return;
      setPages(newPages);
      if (newPages.length > 0) {
        setPageIndex(0);
        streamPage(newPages[0]);
      }
    },
    [streamPage],
  );

  // Auto-advance
  useEffect(() => {
    if (pageComplete && pageIndex < pages.length - 1) {
      autoAdvanceRef.current = setTimeout(() => {
        const next = pageIndex + 1;
        setPageIndex(next);
        streamPage(pages[next]);
      }, AUTO_ADVANCE_MS);
      return () => {
        if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      };
    }
  }, [pageComplete, pageIndex, pages, streamPage]);

  // Blinking ▼
  useEffect(() => {
    if (pageComplete && pageIndex < pages.length - 1) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.15,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    blinkAnim.setValue(1);
  }, [pageComplete, pageIndex, pages.length, blinkAnim]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const handleTap = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
      setDisplayText(currentPageTextRef.current);
      setPageComplete(true);
      charIndexRef.current = currentPageTextRef.current.length;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }

    if (pageComplete && pageIndex < pages.length - 1) {
      const next = pageIndex + 1;
      setPageIndex(next);
      streamPage(pages[next]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }

    if (pageComplete && pageIndex >= pages.length - 1 && pages.length > 0) {
      onDismiss();
    }
  }, [pageComplete, pageIndex, pages, streamPage, onDismiss]);

  const restart = useCallback(() => {
    if (pages.length > 0) {
      setPageIndex(0);
      streamPage(pages[0]);
    }
  }, [pages, streamPage]);

  const isLastPage = pageIndex >= pages.length - 1;
  const showContinue = pageComplete && !isLastPage;
  const showDone = pageComplete && isLastPage && pages.length > 0;

  return {
    pages,
    pageIndex,
    displayText,
    pageComplete,
    isLastPage,
    showContinue,
    showDone,
    blinkAnim,
    handleTap,
    feedPages,
    restart,
  };
}

// --- DialogBox component ---

function LoadingText({ text = "Generating insight" }: { text?: string }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={dialogStyles.loadingRow}>
      <Text style={dialogStyles.loadingText}>
        {text}
        {dots}
      </Text>
    </View>
  );
}

export function DialogBox({
  isLoading,
  error,
  displayText,
  showContinue,
  showDone = true,
  blinkAnim,
  onTap,
  onRestart,
  inline,
  style,
  loadingText,
}: {
  isLoading: boolean;
  error: string | null;
  displayText: string;
  showContinue: boolean;
  showDone?: boolean;
  blinkAnim: Animated.Value;
  onTap: () => void;
  onRestart?: () => void;
  inline?: boolean;
  style?: ViewStyle;
  loadingText?: string;
}) {
  const targetHeight =
    style && typeof (style as Record<string, unknown>).height === "number"
      ? ((style as Record<string, unknown>).height as number)
      : 95;
  const targetHeightSV = useSharedValue(targetHeight);

  const [containerMeasured, setContainerMeasured] = useState(false);
  const containerWidthSV = useSharedValue(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      containerWidthSV.value = w;
      setContainerMeasured(true);
    }
  }, []);

  const animHeight = useSharedValue(COLLAPSED_HEIGHT);
  const sheenPos = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const statusOpacity = useSharedValue(1);
  const phase = useSharedValue(0);
  const sheenActive = useSharedValue(1);

  const [collapsed, setCollapsed] = useState(false);
  const [statusText, setStatusText] = useState(
    loadingText || "Generating insight",
  );
  const prevIsLoading = useRef<boolean | null>(null);

  // Phase 0: repeating golden sheen during loading (non-inline only)
  useEffect(() => {
    if (inline) {
      contentOpacity.value = 1;
      statusOpacity.value = 0;
      phase.value = 3;
      return;
    }
    if (isLoading) {
      animHeight.value = COLLAPSED_HEIGHT;
      phase.value = 0;
      contentOpacity.value = 0;
      statusOpacity.value = 1;
      sheenActive.value = 1;
      setStatusText(loadingText || "Generating insight");
      cancelAnimation(sheenPos);
      sheenPos.value = 0;
      sheenPos.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [isLoading, inline]);

  // Detect isLoading true→false transition
  useEffect(() => {
    if (inline) {
      prevIsLoading.current = isLoading;
      return;
    }

    if (prevIsLoading.current === true && !isLoading) {
      cancelAnimation(sheenPos);

      if (error) {
        // Error: skip sheen, just expand and show
        phase.value = 3;
        statusOpacity.value = 0;
        animHeight.value = withTiming(targetHeightSV.value, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        contentOpacity.value = withTiming(1, { duration: 200 });
      } else {
        // Phase 1: "Insight ready" + final sheen sweep
        setStatusText("Insight ready");
        phase.value = 1;
        sheenPos.value = withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(
            1,
            { duration: 600, easing: Easing.inOut(Easing.ease) },
            (finished) => {
              if (!finished) return;
              // Phase 2: expand + fade out status text
              phase.value = 2;
              sheenActive.value = 0;
              statusOpacity.value = withTiming(0, { duration: 200 });
              animHeight.value = withTiming(
                targetHeightSV.value,
                { duration: 400, easing: Easing.out(Easing.cubic) },
                (finished2) => {
                  if (!finished2) return;
                  // Phase 3: content fade in
                  phase.value = 3;
                  contentOpacity.value = withTiming(1, { duration: 200 });
                },
              );
            },
          ),
        );
      }
    } else if (prevIsLoading.current === null && !isLoading) {
      // Initial mount with isLoading=false: skip animation
      animHeight.value = targetHeightSV.value;
      contentOpacity.value = 1;
      statusOpacity.value = 0;
      phase.value = 3;
    }

    prevIsLoading.current = isLoading;
  }, [isLoading, error, inline]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    if (inline) return {};
    return { height: animHeight.value };
  });

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

  const statusAnimStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handlePress = useCallback(() => {
    if (collapsed) {
      // Re-expand and restart streaming from the beginning
      setCollapsed(false);
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      statusOpacity.value = withTiming(0, { duration: 150 });
      onRestart?.();
      animHeight.value = withTiming(
        targetHeightSV.value,
        { duration: 350, easing: Easing.out(Easing.cubic) },
        (fin) => {
          if (!fin) return;
          contentOpacity.value = withTiming(1, { duration: 200 });
        },
      );
      return;
    }

    if (showDone) {
      // Collapse instead of dismissing
      setCollapsed(true);
      setStatusText("Reveal insight");
      contentOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(
        COLLAPSED_HEIGHT,
        { duration: 350, easing: Easing.out(Easing.cubic) },
        (fin) => {
          if (!fin) return;
          statusOpacity.value = withTiming(1, { duration: 200 });
        },
      );
      return;
    }

    // Normal: skip stream / advance page
    onTap();
  }, [collapsed, showDone, onTap, onRestart]);

  return (
    <Reanimated.View
      style={[
        dialogStyles.bubble,
        inline && dialogStyles.bubbleInline,
        style,
        animatedContainerStyle,
      ]}
      onLayout={handleLayout}
    >
      {/* Loading status text (phases 0–1) */}
      <Reanimated.View
        style={[dialogStyles.statusOverlay, statusAnimStyle]}
        pointerEvents="none"
      >
        <Text style={dialogStyles.statusText}>{statusText}</Text>
      </Reanimated.View>

      {/* Golden sheen sweep (phases 0–1) */}
      {containerMeasured && (
        <Reanimated.View
          style={[dialogStyles.sheenBeam, sheenAnimStyle]}
          pointerEvents="none"
        >
          <Svg
            width={SHEEN_WIDTH}
            height={COLLAPSED_HEIGHT}
          >
            <Defs>
              <LinearGradient id="goldenSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#fbbf24" stopOpacity="0" />
                <Stop offset="0.3" stopColor="#fbbf24" stopOpacity="0.5" />
                <Stop offset="0.5" stopColor="#fef3c7" stopOpacity="0.8" />
                <Stop offset="0.7" stopColor="#fbbf24" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={SHEEN_WIDTH}
              height={COLLAPSED_HEIGHT}
              fill="url(#goldenSheen)"
            />
          </Svg>
        </Reanimated.View>
      )}

      {/* Content (phase 3) */}
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        <Reanimated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {isLoading ? (
            <LoadingText text={loadingText} />
          ) : error ? (
            <Text style={dialogStyles.errorText}>{error}</Text>
          ) : (
            <View style={dialogStyles.textArea}>
              <Text style={dialogStyles.bubbleText}>{displayText}</Text>

              {showContinue && (
                <Animated.Text
                  style={[dialogStyles.continueArrow, { opacity: blinkAnim }]}
                >
                  ▼
                </Animated.Text>
              )}
              {showDone && !showContinue && (
                <Text style={dialogStyles.doneArrow}>▲</Text>
              )}
            </View>
          )}
        </Reanimated.View>
      </Pressable>
    </Reanimated.View>
  );
}

// --- Styles ---

export const layoutStyles = StyleSheet.create({
  spacer: {
    flex: 1,
  },
});

const dialogStyles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.bg.cardAlt,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: colors.border.medium,
    marginBottom: -spacing.lg,
  },
  bubbleInline: {
    minHeight: 60,
    borderTopWidth: 0,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    color: "#fbbf24",
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  sheenBeam: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  textArea: {
    flex: 1,
  },
  bubbleText: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fontFamily.mono,
  },
  continueArrow: {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontSize: 14,
    color: colors.accent.primary,
  },
  doneArrow: {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontSize: 14,
    color: colors.text.secondary,
  },
  loadingRow: {
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontFamily: fontFamily.mono,
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 14,
    color: colors.status.error.text,
    fontFamily: fontFamily.mono,
  },
});

const zoneStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  emoji: {
    fontSize: 32,
  },
  name: {
    fontSize: 24,
    fontFamily: fontFamily.mono,
    color: colors.accent.primary,
    letterSpacing: 2,
    fontWeight: "700",
    textAlign: "center",
  },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: colors.accent.muted,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const barStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  bar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  segment: {
    height: 8,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const heroStyles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  emoji: {
    fontSize: 36,
  },
  name: {
    fontSize: 20,
    fontFamily: fontFamily.mono,
    color: colors.accent.primary,
    letterSpacing: 2,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
  dnaSection: {
    gap: 10,
  },
  dnaLabel: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.accent.primary,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  legendWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bg.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  pillEmoji: {
    fontSize: 12,
  },
  pillValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    fontFamily: fontFamily.mono,
  },
  pillLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
  },
});

const encounterStyles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  header: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  emoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamily.mono,
    color: colors.text.primary,
  },
  timeBadge: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
    backgroundColor: colors.bg.cardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    color: colors.text.secondary,
  },
});
