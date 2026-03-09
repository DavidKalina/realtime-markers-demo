import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  useColors,
  fontFamily,
  fontWeight,
  fontSize,
  spacing,
  type Colors,
} from "@/theme";
import type {
  ItineraryItemResponse,
  DayForecast,
  HourlyForecast,
} from "@/services/api/modules/itineraries";

// WMO weather code → emoji mapping
function weatherEmoji(code: number): string {
  if (code === 0) return "\u2600\uFE0F"; // Clear sky
  if (code <= 3) return "\u26C5"; // Partly cloudy / overcast
  if (code <= 48) return "\uD83C\uDF2B\uFE0F"; // Fog
  if (code <= 57) return "\uD83C\uDF27\uFE0F"; // Drizzle
  if (code <= 67) return "\uD83C\uDF27\uFE0F"; // Rain
  if (code <= 77) return "\u2744\uFE0F"; // Snow
  if (code <= 82) return "\uD83C\uDF26\uFE0F"; // Rain showers
  if (code <= 86) return "\uD83C\uDF28\uFE0F"; // Snow showers
  if (code >= 95) return "\u26C8\uFE0F"; // Thunderstorm
  return "\u2601\uFE0F"; // Fallback cloudy
}

function getHourlyForTime(
  forecast: DayForecast | undefined,
  startTime: string,
): HourlyForecast | null {
  if (!forecast?.hourly) return null;
  const hour = parseInt(startTime.split(":")[0], 10);
  if (isNaN(hour)) return null;
  return forecast.hourly.find((h) => h.hour === hour) ?? null;
}

// Rotating accent colors for each stop
const STOP_COLORS = [
  "#93c5fd", // blue
  "#86efac", // green
  "#fcd34d", // yellow
  "#c4b5fd", // purple
  "#f9a8d4", // pink
  "#fdba74", // orange
  "#67e8f9", // cyan
];

const CHECKIN_GREEN = "#22c55e";

interface ItineraryTimelineProps {
  items: ItineraryItemResponse[];
  forecast?: DayForecast;
  isActive?: boolean;
  onCheckin?: (itemId: string) => void;
}

// --- Animated cost counter ---

const AnimatedCost: React.FC<{ value: number; startDelay: number }> = ({
  value,
  startDelay,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const animated = useSharedValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    animated.value = 0;
    animated.value = withDelay(
      startDelay,
      withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, startDelay]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current) => {
      scheduleOnRN(setDisplayed, current);
    },
  );

  return <Text style={styles.costValue}>${displayed}</Text>;
};

// --- Single timeline stop (chain-animated) ---

interface TimelineStopProps {
  item: ItineraryItemResponse;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  stopColor: string;
  isRevealed: boolean;
  onRevealComplete: () => void;
  isActive?: boolean;
  onCheckin?: (itemId: string) => void;
  weather?: HourlyForecast | null;
}

const CONTENT_DURATION = 350;
const RAIL_DURATION = 280;
const RAIL_PAUSE = 80; // pause before content slides in

const TimelineStop = React.memo(
  ({
    item,
    index,
    isFirst,
    isLast,
    stopColor,
    isRevealed,
    onRevealComplete,
    isActive,
    onCheckin,
    weather,
  }: TimelineStopProps) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const cost = Number(item.estimatedCost) || 0;
    const isCheckedIn = !!item.checkedInAt;

    // Animation shared values
    const railProgress = useSharedValue(0); // 0→1: line grows down
    const dotScale = useSharedValue(0);
    const contentOpacity = useSharedValue(0);
    const contentTranslateX = useSharedValue(12);
    const travelOpacity = useSharedValue(0);
    const checkinScale = useSharedValue(isCheckedIn ? 1 : 0);

    // Stable callbacks for scheduleOnRN
    const onRevealRef = useRef(onRevealComplete);
    onRevealRef.current = onRevealComplete;
    const fireRevealComplete = useCallback(() => {
      onRevealRef.current();
    }, []);

    useEffect(() => {
      if (!isRevealed) return;

      const hasTravelNote = !isFirst && !!item.travelNote;
      let t = 0;

      // Step 1: If there's a travel note, fade it in first
      if (hasTravelNote) {
        travelOpacity.value = withDelay(
          t,
          withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
        );
        t += 180;
      }

      // Step 2: Grow the rail line down (if not first and no travel note, show lineAbove)
      if (!isFirst) {
        railProgress.value = withDelay(
          t,
          withTiming(1, {
            duration: RAIL_DURATION,
            easing: Easing.out(Easing.cubic),
          }),
        );
        t += RAIL_DURATION * 0.6; // overlap slightly
      }

      // Step 3: Pop in the dot
      dotScale.value = withDelay(
        t,
        withTiming(1, { duration: 250, easing: Easing.out(Easing.back(1.8)) }),
      );
      t += 150;

      // Step 4: Slide in content from right
      contentOpacity.value = withDelay(
        t + RAIL_PAUSE,
        withTiming(1, {
          duration: CONTENT_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
      );
      contentTranslateX.value = withDelay(
        t + RAIL_PAUSE,
        withTiming(
          0,
          {
            duration: CONTENT_DURATION,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            // Chain: signal the next stop to start
            if (finished) {
              scheduleOnRN(fireRevealComplete);
            }
          },
        ),
      );
    }, [isRevealed]);

    // Animate check-in when status changes from unchecked → checked
    const prevCheckedRef = useRef(isCheckedIn);
    useEffect(() => {
      if (isCheckedIn && !prevCheckedRef.current) {
        // Bounce animation for newly checked-in items
        checkinScale.value = withSequence(
          withTiming(1.3, { duration: 200, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        );
      }
      prevCheckedRef.current = isCheckedIn;
    }, [isCheckedIn]);

    // Animated styles
    const dotAnimStyle = useAnimatedStyle(() => ({
      transform: [{ scale: dotScale.value }],
    }));

    const checkinOverlayStyle = useAnimatedStyle(() => ({
      transform: [{ scale: checkinScale.value }],
      opacity: checkinScale.value,
    }));

    const lineAboveAnimStyle = useAnimatedStyle(() => ({
      transform: [{ scaleY: railProgress.value }],
    }));

    const lineBelowAnimStyle = useAnimatedStyle(() => ({
      opacity: contentOpacity.value * 0.3,
    }));

    const contentAnimStyle = useAnimatedStyle(() => ({
      opacity: contentOpacity.value,
      transform: [{ translateX: contentTranslateX.value }],
    }));

    const travelAnimStyle = useAnimatedStyle(() => ({
      opacity: travelOpacity.value,
    }));

    return (
      <View>
        {/* Travel note connector */}
        {!isFirst && item.travelNote && (
          <Animated.View style={[styles.travelRow, travelAnimStyle]}>
            <View style={styles.travelRail}>
              <View
                style={[styles.travelDash, { backgroundColor: stopColor }]}
              />
            </View>
            <Text style={styles.travelText}>{item.travelNote}</Text>
          </Animated.View>
        )}

        <View style={styles.stopRow}>
          {/* Rail */}
          <View style={styles.rail}>
            {!isFirst && !item.travelNote && (
              <Animated.View
                style={[
                  styles.lineAbove,
                  { backgroundColor: stopColor, transformOrigin: "top" },
                  lineAboveAnimStyle,
                ]}
              />
            )}
            <Pressable
              disabled={!isActive || isCheckedIn || !onCheckin}
              onPress={() => onCheckin?.(item.id)}
            >
              <Animated.View
                style={[
                  styles.dot,
                  { backgroundColor: isCheckedIn ? CHECKIN_GREEN : stopColor },
                  dotAnimStyle,
                ]}
              >
                {isCheckedIn ? (
                  <Animated.View style={checkinOverlayStyle}>
                    <Text style={styles.dotEmoji}>{"\u2713"}</Text>
                  </Animated.View>
                ) : (
                  <Text style={styles.dotEmoji}>
                    {item.emoji || "\u{1F4CD}"}
                  </Text>
                )}
              </Animated.View>
            </Pressable>
            {!isLast && (
              <Animated.View
                style={[
                  styles.lineBelow,
                  { backgroundColor: stopColor },
                  lineBelowAnimStyle,
                ]}
              />
            )}
          </View>

          {/* Content */}
          <Animated.View style={[styles.content, contentAnimStyle]}>
            <View style={styles.statRow}>
              <Text style={styles.timeText}>
                {formatTime(item.startTime)} – {formatTime(item.endTime)}
              </Text>
              <View style={styles.statRight}>
                {cost > 0 && isRevealed && (
                  <AnimatedCost value={cost} startDelay={200} />
                )}
                {weather && (
                  <Text style={styles.weatherText}>
                    {weatherEmoji(weather.weatherCode)} {weather.tempF}°
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.itemTitle}>{item.title}</Text>

            {item.description && (
              <Text style={styles.itemDesc} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {item.venueName && (
              <Text style={styles.venueText} numberOfLines={1}>
                {item.venueName}
                {item.venueAddress ? ` · ${item.venueAddress}` : ""}
              </Text>
            )}

            {item.eventId && (
              <Text style={[styles.eventTag, { color: stopColor }]}>
                From scanned event
              </Text>
            )}

            {isCheckedIn && (
              <Text style={styles.checkedInTag}>{"\u2705"} Checked in</Text>
            )}
          </Animated.View>
        </View>
      </View>
    );
  },
);

// --- Main component ---

export default function ItineraryTimeline({
  items,
  forecast,
  isActive,
  onCheckin,
}: ItineraryTimelineProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const totalCost = useMemo(
    () =>
      sorted.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0),
    [sorted],
  );

  // Chain state: tracks how many stops have finished their entrance
  const [revealedCount, setRevealedCount] = useState(0);
  const [showTotal, setShowTotal] = useState(false);

  // Kick off the chain: reveal the first stop after a short initial delay
  useEffect(() => {
    if (sorted.length > 0 && revealedCount === 0) {
      const timer = setTimeout(() => setRevealedCount(1), 150);
      return () => clearTimeout(timer);
    }
  }, [sorted.length]);

  const handleStopRevealed = useCallback(
    (idx: number) => {
      // Reveal the next stop in the chain
      if (idx + 1 < sorted.length) {
        setRevealedCount(idx + 2); // +2 because revealedCount is 1-indexed
      } else {
        // Last stop finished — show total
        setShowTotal(true);
      }
    },
    [sorted.length],
  );

  // Total row animation
  const totalOpacity = useSharedValue(0);
  const totalTranslateY = useSharedValue(8);

  useEffect(() => {
    if (!showTotal) return;
    totalOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    totalTranslateY.value = withDelay(
      100,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
  }, [showTotal]);

  const totalAnimStyle = useAnimatedStyle(() => ({
    opacity: totalOpacity.value,
    transform: [{ translateY: totalTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {sorted.map((item, idx) => (
        <TimelineStop
          key={item.id}
          item={item}
          index={idx}
          isFirst={idx === 0}
          isLast={idx === sorted.length - 1}
          stopColor={STOP_COLORS[idx % STOP_COLORS.length]}
          isRevealed={revealedCount > idx}
          onRevealComplete={() => handleStopRevealed(idx)}
          isActive={isActive}
          onCheckin={onCheckin}
          weather={getHourlyForTime(forecast, item.startTime)}
        />
      ))}

      {/* Total */}
      {sorted.length > 0 && (
        <Animated.View style={[styles.totalRow, totalAnimStyle]}>
          <Text style={styles.totalLabel}>ESTIMATED TOTAL</Text>
          {showTotal && <AnimatedCost value={totalCost} startDelay={200} />}
        </Animated.View>
      )}
    </View>
  );
}

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      paddingVertical: spacing.md,
    },

    // --- Stop row ---
    stopRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    rail: {
      width: 32,
      alignItems: "center",
    },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    dotEmoji: {
      fontSize: 14,
    },
    lineAbove: {
      width: 2,
      height: 10,
    },
    lineBelow: {
      flex: 1,
      width: 2,
      minHeight: 10,
    },
    content: {
      flex: 1,
      paddingBottom: spacing.md,
      gap: 3,
    },

    // --- Stat row (time + cost) ---
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    timeText: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      letterSpacing: 0.3,
    },
    statRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    weatherText: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
      minWidth: 52,
      textAlign: "right",
    },
    costValue: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },

    // --- Item content ---
    itemTitle: {
      fontSize: fontSize.sm,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      lineHeight: 20,
    },
    itemDesc: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      lineHeight: 16,
    },
    venueText: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.detail,
      lineHeight: 16,
    },
    eventTag: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: 2,
    },
    checkedInTag: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: CHECKIN_GREEN,
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // --- Travel connector ---
    travelRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    travelRail: {
      width: 32,
      alignItems: "center",
    },
    travelDash: {
      width: 2,
      height: 16,
      opacity: 0.25,
    },
    travelText: {
      flex: 1,
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.regular,
      color: colors.text.disabled,
      fontStyle: "italic",
      letterSpacing: 0.2,
    },

    // --- Total row ---
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.default,
      paddingHorizontal: 2,
    },
    totalLabel: {
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      letterSpacing: 1,
    },
  });
