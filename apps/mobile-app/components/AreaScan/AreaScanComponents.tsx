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
import { scheduleOnRN } from "react-native-worklets";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useFocusEffect } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import { useDialogStreamStore } from "@/stores/useDialogStreamStore";
import {
  useColors,
  spacing,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  type Colors,
} from "@/theme";
import { CATEGORY_PALETTE } from "@/utils/categoryColors";
import { useMapMountGate } from "@/hooks/useMapMountGate";
import { useAppActive } from "@/hooks/useAppActive";
import { useMapStyle } from "@/contexts/MapStyleContext";
import type { AreaScanMetadata } from "@/services/api/modules/areaScan";

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
// --- Constants ---

const COLLAPSED_HEIGHT = 44;
const SHEEN_WIDTH = 100;

export const CHARS_PER_PAGE = 200;
export const CHAR_DELAY_MS = 20;
export const AUTO_ADVANCE_MS = 2500;
export const BAR_COLORS = CATEGORY_PALETTE;

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

export function getRadiusForZoom(_zoom: number): number {
  return 16093; // 10 miles
}

// --- Sub-components ---

export function ZoneHeader({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  const colors = useColors();
  const zoneStyles = useMemo(() => createZoneStyles(colors), [colors]);
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
  const colors = useColors();
  const barStyles = useMemo(() => createBarStyles(colors), [colors]);
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
  const themeColors = useColors();
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
        stroke={themeColors.border.default}
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
  const colors = useColors();
  const heroStyles = useMemo(() => createHeroStyles(colors), [colors]);

  const trailCount = zoneStats.trails?.length ?? 0;
  const parts: string[] = [];
  if (zoneStats.eventCount > 0) {
    parts.push(
      `${zoneStats.eventCount} event${zoneStats.eventCount !== 1 ? "s" : ""}`,
    );
  }
  if (trailCount > 0) {
    parts.push(`${trailCount} trail${trailCount !== 1 ? "s" : ""}`);
  }
  const subtitle = parts.length > 0 ? parts.join(" · ") + " nearby" : "Nothing nearby";

  // Pick emoji: if trails dominate and no events, show trail emoji
  const emoji =
    zoneStats.eventCount === 0 && trailCount > 0
      ? "\u{1F6E4}\u{FE0F}"
      : zoneStats.topEmoji;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={heroStyles.container}
    >
      <View style={heroStyles.headerRow}>
        <Text style={heroStyles.emoji}>{emoji}</Text>
        <View style={heroStyles.headerText}>
          <Text style={heroStyles.name}>
            {zoneStats.zoneName.toUpperCase()}
          </Text>
          <Text style={heroStyles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </Reanimated.View>
  );
}

export function StatPillRow({ zoneStats }: { zoneStats: AreaScanMetadata }) {
  const colors = useColors();
  const pillStyles = useMemo(() => createPillStyles(colors), [colors]);
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
  const colors = useColors();
  const encounterStyles = useMemo(
    () => createEncounterStyles(colors),
    [colors],
  );
  if (!events || events.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={encounterStyles.container}
    >
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

// --- Scanning animation (shown while loading) ---

export function ScanningAnimation({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const colors = useColors();
  const { mapStyle } = useMapStyle();
  const scanStyles = useMemo(() => createScanStyles(colors), [colors]);
  const coordinate: [number, number] = useMemo(() => [lng, lat], [lng, lat]);

  const { isMapSafeToMount, onContainerLayout } =
    useMapMountGate("area-scan-loading");
  const isAppActive = useAppActive();

  // Looping camera: cycle heading 0→360 and oscillate pitch
  // Uses imperative setCamera to avoid 60fps React re-renders
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let raf: number;
    let last = performance.now();
    let t = 0;

    const tick = (now: number) => {
      if (!isMounted.current) return;
      const dt = (now - last) / 1000;
      last = now;
      t += dt;

      // Full rotation every ~24s
      const newHeading = (t * 15) % 360;
      // Oscillate pitch between 40 and 65
      const newPitch = 52.5 + 12.5 * Math.sin(t * 0.4);

      cameraRef.current?.setCamera({
        centerCoordinate: coordinate,
        zoomLevel: 15,
        heading: newHeading,
        pitch: newPitch,
        animationDuration: 0,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      isMounted.current = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Pulsing ring overlay
  const ringScale = useSharedValue(0.6);
  useEffect(() => {
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 2000, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
    );
    return () => cancelAnimation(ringScale);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: "60deg" },
      { scale: ringScale.value },
    ],
    opacity: interpolate(ringScale.value, [0.6, 1], [0.5, 0]),
  }));

  return (
    <View style={scanStyles.container} onLayout={onContainerLayout}>
      {isMapSafeToMount && isAppActive && (
        <MapboxGL.MapView
          style={StyleSheet.absoluteFill}
          styleURL={mapStyle}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={true}
          pitchEnabled={true}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={coordinate}
            zoomLevel={15}
            pitch={50}
            heading={0}
            animationDuration={0}
          />
        </MapboxGL.MapView>
      )}

      {/* Gradient overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg.primary} stopOpacity="0.4" />
              <Stop offset="0.5" stopColor={colors.bg.primary} stopOpacity="0.2" />
              <Stop offset="1" stopColor={colors.bg.primary} stopOpacity="0.7" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scanGrad)" />
        </Svg>
      </View>

      {/* Pulsing ring + label */}
      <View style={scanStyles.overlay} pointerEvents="none">
        <View style={scanStyles.pulseAnchor}>
          <Reanimated.View style={[scanStyles.ring, ringStyle]} />
          <View style={scanStyles.centerDot} />
        </View>
        {/* Label removed — DialogBox shows scanning status */}
      </View>
    </View>
  );
}

// --- Tab bar for switching between Events and Trails ---

type AreaTab = "events" | "trails";

export function AreaTabBar({
  activeTab,
  onTabPress,
  eventCount,
  trailCount,
}: {
  activeTab: AreaTab;
  onTabPress: (tab: AreaTab) => void;
  eventCount: number;
  trailCount: number;
}) {
  const colors = useColors();
  const tabStyles = useMemo(() => createTabStyles(colors), [colors]);

  const tabs: { key: AreaTab; label: string; count: number }[] = [
    { key: "events", label: "Events", count: eventCount },
    { key: "trails", label: "Trails", count: trailCount },
  ];

  return (
    <View style={tabStyles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[tabStyles.tabButton, isActive && tabStyles.tabButtonActive]}
            onPress={() => onTabPress(tab.key)}
          >
            <Text
              style={[tabStyles.tabText, isActive && tabStyles.tabTextActive]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <Text
                style={[
                  tabStyles.tabCount,
                  isActive && tabStyles.tabCountActive,
                ]}
              >
                {tab.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ZoneTrails({
  trails,
  onTrailPress,
}: {
  trails: AreaScanMetadata["trails"];
  onTrailPress?: (trail: AreaScanMetadata["trails"][number]) => void;
}) {
  const colors = useColors();
  const trailStyles = useMemo(() => createTrailStyles(colors), [colors]);
  if (!trails || trails.length === 0) return null;

  return (
    <Reanimated.View
      entering={FadeInDown.duration(400)}
      style={trailStyles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {trails.map((trail, i) => (
          <View key={trail.id}>
            {i > 0 && <View style={trailStyles.separator} />}
            <Pressable
              style={trailStyles.row}
              onPress={() => onTrailPress?.(trail)}
            >
              <Text style={trailStyles.emoji}>🛤️</Text>
              <View style={trailStyles.info}>
                <Text style={trailStyles.title} numberOfLines={1}>
                  {trail.name}
                </Text>
                <Text style={trailStyles.subtitle} numberOfLines={1}>
                  {trail.surface}
                  {" · "}
                  {trail.lengthMeters >= 1000
                    ? `${(trail.lengthMeters / 1000).toFixed(1)} km`
                    : `${trail.lengthMeters}m`}
                  {trail.lit ? " · lit" : ""}
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

export function useDialogStreamer(): DialogStreamerState & {
  feedPages: (newPages: string[]) => void;
  restart: () => void;
} {
  const pages = useDialogStreamStore((s) => s.pages);
  const pageIndex = useDialogStreamStore((s) => s.pageIndex);
  const pageComplete = useDialogStreamStore((s) => s.pageComplete);
  const displayText = useDialogStreamStore((s) => s.displayText);
  const feedPagesFn = useDialogStreamStore((s) => s.feedPages);
  const handleTap = useDialogStreamStore((s) => s.handleTap);
  const restart = useDialogStreamStore((s) => s.restart);
  const cancel = useDialogStreamStore((s) => s.cancel);

  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Cancel streaming when screen loses focus (screens don't unmount in a stack)
  useFocusEffect(
    useCallback(() => {
      return () => {
        cancel();
      };
    }, [cancel]),
  );

  // Blinking ▼ indicator
  const isLastPage = pageIndex >= pages.length - 1;

  useEffect(() => {
    if (pageComplete && !isLastPage) {
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
    feedPages: feedPagesFn,
    restart,
  };
}

// --- DialogBox component ---

function LoadingText({ text = "Generating insight" }: { text?: string }) {
  const colors = useColors();
  const dialogStyles = useMemo(() => createDialogStyles(colors), [colors]);
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

function CooldownError({ message }: { message: string }) {
  const colors = useColors();
  const dialogStyles = useMemo(() => createDialogStyles(colors), [colors]);
  const isRateLimit = /too many|rate limit|429|cooldown/i.test(message);

  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (!isRateLimit) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [isRateLimit]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  if (!isRateLimit) {
    return <Text style={dialogStyles.errorText}>{message}</Text>;
  }

  return (
    <View style={dialogStyles.cooldownContainer}>
      <Reanimated.Text style={[dialogStyles.cooldownLabel, pulseStyle]}>
        COOLDOWN ACTIVE
      </Reanimated.Text>
      <Text style={dialogStyles.cooldownHint}>Try again in a moment</Text>
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
  onExpandComplete,
  inline,
  style,
  loadingText,
  startCollapsed,
}: {
  isLoading: boolean;
  error: string | null;
  displayText: string;
  showContinue: boolean;
  showDone?: boolean;
  blinkAnim: Animated.Value;
  onTap: () => void;
  onRestart?: () => void;
  onExpandComplete?: () => void;
  inline?: boolean;
  style?: ViewStyle;
  loadingText?: string;
  startCollapsed?: boolean;
}) {
  const colors = useColors();
  const dialogStyles = useMemo(() => createDialogStyles(colors), [colors]);
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

  const [collapsed, setCollapsed] = useState(!!startCollapsed);
  const [statusText, setStatusText] = useState(
    startCollapsed ? "Tap for insight" : loadingText || "Generating insight",
  );
  const prevIsLoading = useRef<boolean | null>(null);

  const onExpandCompleteRef = useRef(onExpandComplete);
  onExpandCompleteRef.current = onExpandComplete;
  const fireExpandComplete = useCallback(() => {
    onExpandCompleteRef.current?.();
  }, []);

  const onRestartRef = useRef(onRestart);
  onRestartRef.current = onRestart;
  const fireRestart = useCallback(() => {
    onRestartRef.current?.();
  }, []);

  // Phase 0: repeating golden sheen during loading (non-inline only)
  useEffect(() => {
    if (inline) {
      contentOpacity.value = 1;
      statusOpacity.value = 0;
      phase.value = 3;
      if (!isLoading) fireExpandComplete();
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

  // Update status text when loadingText prop changes during loading
  useEffect(() => {
    if (isLoading && !inline && loadingText) {
      setStatusText(loadingText);
    }
  }, [loadingText, isLoading, inline]);

  // Detect isLoading true→false transition
  useEffect(() => {
    if (inline) {
      prevIsLoading.current = isLoading;
      return;
    }

    if (prevIsLoading.current === true && !isLoading) {
      cancelAnimation(sheenPos);

      if (error) {
        // Error: skip sheen, expand to compact height and show
        phase.value = 3;
        statusOpacity.value = 0;
        const errorHeight = COLLAPSED_HEIGHT + 20;
        animHeight.value = withTiming(
          errorHeight,
          { duration: 300, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(fireExpandComplete);
          },
        );
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
                  scheduleOnRN(fireExpandComplete);
                },
              );
            },
          ),
        );
      }
    } else if (prevIsLoading.current === null && !isLoading) {
      if (startCollapsed) {
        // Stay collapsed until user taps
        animHeight.value = COLLAPSED_HEIGHT;
        contentOpacity.value = 0;
        statusOpacity.value = 1;
        phase.value = 0;
      } else {
        // Initial mount with isLoading=false: skip animation
        animHeight.value = targetHeightSV.value;
        contentOpacity.value = 1;
        statusOpacity.value = 0;
        phase.value = 3;
        fireExpandComplete();
      }
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

  const idleRef = useRef(!!startCollapsed);

  const handlePress = useCallback(() => {
    if (collapsed && idleRef.current) {
      // First tap from idle state: trigger fetch, stay collapsed for loading sheen
      idleRef.current = false;
      setCollapsed(false);
      onTap();
      return;
    }

    if (collapsed) {
      // Re-expand and restart streaming from the beginning
      setCollapsed(false);
      cancelAnimation(sheenPos);
      sheenActive.value = 0;
      statusOpacity.value = withTiming(0, { duration: 150 });
      animHeight.value = withTiming(
        targetHeightSV.value,
        { duration: 350, easing: Easing.out(Easing.cubic) },
        (fin) => {
          if (!fin) return;
          scheduleOnRN(fireRestart);
          contentOpacity.value = withDelay(50, withTiming(1, { duration: 200 }));
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
  }, [collapsed, showDone, onTap]);

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
          <Svg width={SHEEN_WIDTH} height={COLLAPSED_HEIGHT}>
            <Defs>
              <LinearGradient id="goldenSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#a0aec0" stopOpacity="0" />
                <Stop offset="0.3" stopColor="#cbd5e0" stopOpacity="0.5" />
                <Stop offset="0.5" stopColor="#f7fafc" stopOpacity="0.8" />
                <Stop offset="0.7" stopColor="#cbd5e0" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#a0aec0" stopOpacity="0" />
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
            <CooldownError message={error} />
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

const createDialogStyles = (colors: Colors) =>
  StyleSheet.create({
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
      color: colors.text.secondary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 2,
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
    cooldownContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 3,
    },
    cooldownLabel: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
      color: colors.accent.primary,
      letterSpacing: 3,
    },
    cooldownHint: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      letterSpacing: 1,
    },
  });

const createZoneStyles = (colors: Colors) =>
  StyleSheet.create({
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

const createBarStyles = (colors: Colors) =>
  StyleSheet.create({
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

const createHeroStyles = (colors: Colors) =>
  StyleSheet.create({
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

const createPillStyles = (colors: Colors) =>
  StyleSheet.create({
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

const createEncounterStyles = (colors: Colors) =>
  StyleSheet.create({
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

const createTrailStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: spacing.md,
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
    title: {
      fontSize: 13,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
  });

const createScanStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      marginHorizontal: -spacing.md,
      marginTop: -spacing.lg,
      marginBottom: -160,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    pulseAnchor: {
      alignItems: "center",
      justifyContent: "center",
      width: 140,
      height: 140,
    },
    ring: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      borderColor: colors.accent.primary,
    },
    centerDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accent.primary,
    },
    label: {
      marginTop: 20,
      fontSize: 12,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
      letterSpacing: 2,
      textTransform: "uppercase",
      fontWeight: "700",
    },
  });

const createTabStyles = (colors: Colors) =>
  StyleSheet.create({
    tabBar: {
      flexDirection: "row",
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.bg.card,
      borderRadius: radius.lg,
      padding: 2,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: spacing.sm,
      borderRadius: radius.lg - 2,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tabButtonActive: {
      backgroundColor: colors.bg.elevated,
    },
    tabText: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.text.primary,
    },
    tabCount: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.disabled,
    },
    tabCountActive: {
      color: colors.text.secondary,
    },
  });
