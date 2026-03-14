import React, { useEffect, useRef, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import MapboxGL from "@rnmapbox/maps";
import { Check } from "lucide-react-native";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { spring } from "@/theme";
import type { ItineraryItemResponse } from "@/services/api/modules/itineraries";

const STOP_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#67e8f9",
];

type WaypointState = "completed" | "next" | "upcoming";

const WaypointPin = React.memo(
  ({
    item,
    index,
    state,
  }: {
    item: ItineraryItemResponse;
    index: number;
    state: WaypointState;
  }) => {
    const color = STOP_COLORS[index % STOP_COLORS.length];
    const prevCheckedIn = useRef(item.checkedInAt);

    // Pop-in animation — small delay so the line draws first
    const scale = useSharedValue(0);
    useEffect(() => {
      scale.value = withDelay(300, withSpring(1, spring.bouncy));
      return () => cancelAnimation(scale);
    }, []);

    // Pulsing ring for "next" state
    const ringScale = useSharedValue(1);
    const ringOpacity = useSharedValue(0);
    useEffect(() => {
      if (state === "next") {
        ringScale.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 0 }),
            withTiming(1.8, { duration: 1200 }),
          ),
          -1,
        );
        ringOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 0 }),
            withTiming(0, { duration: 1200 }),
          ),
          -1,
        );
      } else {
        cancelAnimation(ringScale);
        cancelAnimation(ringOpacity);
        ringScale.value = 1;
        ringOpacity.value = 0;
      }
      return () => {
        cancelAnimation(ringScale);
        cancelAnimation(ringOpacity);
      };
    }, [state]);

    // Check-in celebration: floating checkmark + ripple burst + color transition
    const rippleScale = useSharedValue(0);
    const rippleOpacity = useSharedValue(0);
    const floatingCheckY = useSharedValue(0);
    const floatingCheckScale = useSharedValue(0);
    const floatingCheckOpacity = useSharedValue(0);
    const checkTransition = useSharedValue(item.checkedInAt ? 1 : 0);

    useEffect(() => {
      if (item.checkedInAt && !prevCheckedIn.current) {
        // 1. Big scale pulse on the pin
        scale.value = withSequence(
          withSpring(1.5, spring.bouncy),
          withDelay(800, withSpring(1, spring.bouncy)),
        );

        // 2. Ripple burst
        rippleOpacity.value = withSequence(
          withTiming(0.7, { duration: 50 }),
          withTiming(0, { duration: 800 }),
        );
        rippleScale.value = withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(4, { duration: 850 }),
        );

        // 3. Floating checkmark emoji rises up and fades out
        floatingCheckScale.value = withSequence(
          withTiming(0, { duration: 0 }),
          withSpring(1.4, { damping: 8, stiffness: 200 }),
          withDelay(600, withTiming(0.8, { duration: 400 })),
        );
        floatingCheckOpacity.value = withSequence(
          withTiming(1, { duration: 100 }),
          withDelay(800, withTiming(0, { duration: 500 })),
        );
        floatingCheckY.value = withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-60, {
            duration: 1400,
            easing: Easing.out(Easing.cubic),
          }),
        );

        // 4. Transition dot color from emoji → green check (after float finishes)
        checkTransition.value = withDelay(
          1000,
          withTiming(1, { duration: 400 }),
        );
      }
      prevCheckedIn.current = item.checkedInAt;
    }, [item.checkedInAt]);

    const markerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: scale.value,
    }));

    const ringStyle = useAnimatedStyle(() => ({
      opacity: ringOpacity.value,
      transform: [{ scale: ringScale.value }],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      opacity: rippleOpacity.value,
      transform: [{ scale: rippleScale.value }],
    }));

    const floatingCheckStyle = useAnimatedStyle(() => ({
      opacity: floatingCheckOpacity.value,
      transform: [
        { translateY: floatingCheckY.value },
        { scale: floatingCheckScale.value },
      ],
    }));

    // Animated background color: original → green
    const dotBgStyle = useAnimatedStyle(() => {
      const t = checkTransition.value;
      // Interpolate RGB from original color to #22c55e
      // We use opacity-based crossfade for simplicity
      return { opacity: 1 - t };
    });

    const checkBgStyle = useAnimatedStyle(() => ({
      opacity: checkTransition.value,
    }));

    if (!item.latitude || !item.longitude) return null;

    const isCompleted = state === "completed";
    const alreadyChecked = !!prevCheckedIn.current && isCompleted;
    const dotOpacity = state === "upcoming" ? 0.6 : 1;

    return (
      <MapboxGL.MarkerView
        coordinate={[Number(item.longitude), Number(item.latitude)]}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <Animated.View style={[styles.marker, markerStyle]}>
          {/* Dot — stacked layers for animated color crossfade */}
          <View style={[styles.markerDot, { opacity: dotOpacity }]}>
            {/* Original color layer (fades out on check-in) */}
            {alreadyChecked ? null : (
              <Animated.View
                style={[
                  styles.markerDotInner,
                  { backgroundColor: color },
                  dotBgStyle,
                ]}
              >
                <Text style={styles.markerEmoji}>
                  {item.emoji || "\u{1F4CD}"}
                </Text>
              </Animated.View>
            )}
            {/* Green check layer (fades in on check-in) */}
            <Animated.View
              style={[
                styles.markerDotInner,
                styles.markerDotAbsolute,
                { backgroundColor: "#22c55e" },
                alreadyChecked ? { opacity: 1 } : checkBgStyle,
              ]}
            >
              <Check size={14} color="#fff" strokeWidth={3} />
            </Animated.View>
          </View>

          {/* Number badge */}
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{item.sortOrder}</Text>
          </View>

          {/* Floating checkmark emoji */}
          <Animated.View style={[styles.floatingCheck, floatingCheckStyle]}>
            <Text style={styles.floatingCheckEmoji}>{"\u2705"}</Text>
          </Animated.View>

          {/* Pulsing ring for next stop */}
          {state === "next" && (
            <Animated.View
              style={[styles.pulseRing, { borderColor: color }, ringStyle]}
            />
          )}

          {/* Celebration ripple */}
          <Animated.View
            style={[styles.ripple, { borderColor: "#22c55e" }, rippleStyle]}
          />
        </Animated.View>
      </MapboxGL.MarkerView>
    );
  },
);

interface Props {
  /** null = show all stops, number = only show first N stops (cinematic reveal) */
  revealedStopCount: number | null;
}

export default function ItineraryWaypoints({ revealedStopCount }: Props) {
  const itinerary = useActiveItineraryStore((s) => s.itinerary);

  const sortedItems = useMemo(() => {
    if (!itinerary?.items?.length) return [];
    return [...itinerary.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.latitude != null && item.longitude != null);
  }, [itinerary?.items]);

  // During reveal, only show pins up to revealedStopCount
  const visibleItems =
    revealedStopCount !== null
      ? sortedItems.slice(0, revealedStopCount)
      : sortedItems;

  if (visibleItems.length === 0) return null;

  const firstUncheckedIdx = sortedItems.findIndex((item) => !item.checkedInAt);

  return (
    <>
      {visibleItems.map((item, idx) => {
        let state: WaypointState;
        if (item.checkedInAt) {
          state = "completed";
        } else if (idx === firstUncheckedIdx) {
          state = "next";
        } else {
          state = "upcoming";
        }
        return (
          <WaypointPin key={item.id} item={item} index={idx} state={state} />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },
  markerDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    overflow: "hidden",
  },
  markerDotInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDotAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  markerEmoji: {
    fontSize: 16,
  },
  floatingCheck: {
    position: "absolute",
    top: -10,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingCheckEmoji: {
    fontSize: 28,
  },
  numberBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  numberText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },
  pulseRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  ripple: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
  },
});
