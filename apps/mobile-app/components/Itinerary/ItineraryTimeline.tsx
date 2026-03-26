import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import type { ItineraryItemResponse } from "@/services/api/modules/itineraries";

/**
 * Parse Google opening hours for the current day and return a display label.
 * Input format: ["Monday: 9:00 AM – 5:00 PM", "Tuesday: 10:00 AM – 6:00 PM", ...]
 */
function getBusinessHoursLabel(
  openingHours: string[] | undefined,
): { label: string; isOpen: boolean } | null {
  if (!openingHours || openingHours.length === 0) return null;

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = openingHours.find((h) => h.startsWith(dayName));

  if (!todayHours) return null;

  // "Monday: Closed"
  if (todayHours.includes("Closed")) {
    return { label: "Closed today", isOpen: false };
  }

  // "Monday: Open 24 hours"
  if (todayHours.includes("Open 24 hours")) {
    return { label: "Open 24h", isOpen: true };
  }

  // "Monday: 9:00 AM – 5:00 PM" or "Monday: 9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM"
  const timePart = todayHours.substring(todayHours.indexOf(":") + 1).trim();
  // Parse the closing time from the last range
  const ranges = timePart.split(",").map((r) => r.trim());
  const lastRange = ranges[ranges.length - 1];
  const closePart = lastRange.split("\u2013")[1]?.trim() ?? lastRange.split("-")[1]?.trim();

  if (!closePart) return { label: timePart, isOpen: true };

  // Parse close time to compare with now
  const closeMatch = closePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (closeMatch) {
    let closeHour = parseInt(closeMatch[1], 10);
    const closeMin = parseInt(closeMatch[2], 10);
    const period = closeMatch[3].toUpperCase();
    if (period === "PM" && closeHour !== 12) closeHour += 12;
    if (period === "AM" && closeHour === 12) closeHour = 0;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const closeMinutes = closeHour * 60 + closeMin;

    // Also check if we're before open
    const openPart = ranges[0].split("\u2013")[0]?.trim() ?? ranges[0].split("-")[0]?.trim();
    const openMatch = openPart?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let openMinutes = 0;
    if (openMatch) {
      let openHour = parseInt(openMatch[1], 10);
      const openMin = parseInt(openMatch[2], 10);
      const openPeriod = openMatch[3].toUpperCase();
      if (openPeriod === "PM" && openHour !== 12) openHour += 12;
      if (openPeriod === "AM" && openHour === 12) openHour = 0;
      openMinutes = openHour * 60 + openMin;
    }

    if (currentMinutes < openMinutes) {
      return { label: `Opens ${openPart}`, isOpen: false };
    }
    if (currentMinutes >= closeMinutes) {
      return { label: "Closed now", isOpen: false };
    }
    // Less than 1 hour until close
    if (closeMinutes - currentMinutes <= 60) {
      return { label: `Closes ${closePart}`, isOpen: true };
    }
    return { label: "Open now", isOpen: true };
  }

  return { label: timePart, isOpen: true };
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
  isActive?: boolean;
  onCheckin?: (itemId: string) => void;
  onItemPress?: (item: ItineraryItemResponse) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
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
  onItemPress?: (item: ItineraryItemResponse) => void;
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
    onItemPress,
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
    const checkinScale = useSharedValue(isCheckedIn ? 1 : 0);

    // Stable callbacks for scheduleOnRN
    const onRevealRef = useRef(onRevealComplete);
    onRevealRef.current = onRevealComplete;
    const fireRevealComplete = useCallback(() => {
      onRevealRef.current();
    }, []);

    useEffect(() => {
      if (!isRevealed) return;

      let t = 0;

      // Step 1: Grow the rail line down
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

    const hoursInfo = getBusinessHoursLabel(item.openingHours);

    return (
      <View>
        <View style={styles.stopRow}>
          {/* Rail */}
          <View style={styles.rail}>
            {!isFirst && (
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
            <Pressable
              onPress={() => onItemPress?.(item)}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <View style={{ gap: 3 }}>
                <View style={styles.statRow}>
                  {hoursInfo && (
                    <Text
                      style={[
                        styles.hoursText,
                        { color: hoursInfo.isOpen ? CHECKIN_GREEN : colors.text.secondary },
                      ]}
                    >
                      {hoursInfo.label}
                    </Text>
                  )}
                  <View style={styles.statRight}>
                    {cost > 0 && isRevealed && (
                      <AnimatedCost value={cost} startDelay={200} />
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
                    {item.venueAddress
                      ? ` · ${extractCity(item.venueAddress)}`
                      : ""}
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
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  },
);

// --- Main component ---

export default function ItineraryTimeline({
  items,
  isActive,
  onCheckin,
  onItemPress,
  scrollRef,
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

  // Track layout positions of each stop for auto-scrolling
  const stopLayoutsRef = useRef<Record<number, { y: number; height: number }>>(
    {},
  );
  const containerOffsetRef = useRef(0);

  const handleStopLayout = useCallback(
    (idx: number, y: number, height: number) => {
      stopLayoutsRef.current[idx] = { y, height };
    },
    [],
  );

  // Kick off the chain: reveal the first stop after a short initial delay
  useEffect(() => {
    if (sorted.length > 0 && revealedCount === 0) {
      const timer = setTimeout(() => setRevealedCount(1), 150);
      return () => clearTimeout(timer);
    }
  }, [sorted.length]);

  const handleStopRevealed = useCallback(
    (idx: number) => {
      // Auto-scroll to show the bottom of the just-revealed stop
      if (scrollRef?.current) {
        const layout = stopLayoutsRef.current[idx];
        if (layout) {
          const targetY = containerOffsetRef.current + layout.y + layout.height;
          scrollRef.current.scrollTo({
            y: Math.max(0, targetY - 200),
            animated: true,
          });
        }
      }

      // Reveal the next stop in the chain
      if (idx + 1 < sorted.length) {
        setRevealedCount(idx + 2); // +2 because revealedCount is 1-indexed
      } else {
        // Last stop finished — show total
        setShowTotal(true);
      }
    },
    [sorted.length, scrollRef],
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
    <View
      style={styles.container}
      onLayout={(e) => {
        containerOffsetRef.current = e.nativeEvent.layout.y;
      }}
    >
      {sorted.map((item, idx) => (
        <View
          key={item.id}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            handleStopLayout(idx, y, height);
          }}
        >
          <TimelineStop
            item={item}
            index={idx}
            isFirst={idx === 0}
            isLast={idx === sorted.length - 1}
            stopColor={STOP_COLORS[idx % STOP_COLORS.length]}
            isRevealed={revealedCount > idx}
            onRevealComplete={() => handleStopRevealed(idx)}
            isActive={isActive}
            onCheckin={onCheckin}
            onItemPress={onItemPress}
          />
        </View>
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

// Pull "City, ST" from a Google address like
// "1234 Main St, Denver, CO 80205, USA"
// Parts: [street, city, stateZip, country]
function extractCity(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  // 4+ parts: street, city, "CO 80205", "USA"
  if (parts.length >= 4) {
    const city = parts[parts.length - 3];
    const state = parts[parts.length - 2].replace(/\s*\d{5}(-\d{4})?$/, "");
    return state ? `${city}, ${state}` : city;
  }
  // 3 parts: "city, CO 80205, USA" or "city, state zip"
  if (parts.length === 3) {
    const city = parts[0];
    const state = parts[1].replace(/\s*\d{5}(-\d{4})?$/, "");
    return state ? `${city}, ${state}` : city;
  }
  // 2 parts: "city, state"
  if (parts.length === 2) {
    const state = parts[1].replace(/\s*\d{5}(-\d{4})?$/, "");
    return state ? `${parts[0]}, ${state}` : parts[0];
  }
  return address;
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

    // --- Stat row (hours + cost) ---
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    hoursText: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.3,
    },
    statRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
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
