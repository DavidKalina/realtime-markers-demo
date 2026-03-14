import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import MapboxGL from "@rnmapbox/maps";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { LINE_DRAW_MS } from "./ItineraryRouteLayer";

const DOT_SIZE = 12;
const GLOW_SIZE = 28;

interface Props {
  /** Line reveal count from the hook (drives which segment to trace) */
  revealedLineCount: number | null;
  /** Ref to the MapView for coordinate → screen-point conversion */
  mapRef: React.RefObject<MapboxGL.MapView | null>;
}

/**
 * Renders a glowing dot OUTSIDE MapView that traces the route between stops.
 * Uses getPointInView() once per segment to convert geo → screen coords,
 * then animates purely with reanimated (no MapView re-renders).
 */
export default function RouteTracer({ revealedLineCount, mapRef }: Props) {
  const itinerary = useActiveItineraryStore((s) => s.itinerary);

  const allCoords = useMemo(() => {
    if (!itinerary?.items?.length) return [];
    return [...itinerary.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.latitude != null && item.longitude != null)
      .map((item): [number, number] => [
        Number(item.longitude),
        Number(item.latitude),
      ]);
  }, [itinerary?.items]);

  const isRevealing = revealedLineCount !== null;

  // Screen coordinates for animation endpoints
  const [visible, setVisible] = useState(false);
  const prevCount = useRef(0);

  // Reanimated shared values for position
  const dotX = useSharedValue(0);
  const dotY = useSharedValue(0);
  const dotOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);

  useEffect(() => {
    if (!isRevealing || revealedLineCount == null || revealedLineCount < 2) {
      setVisible(false);
      dotOpacity.value = 0;
      prevCount.current = revealedLineCount ?? 0;
      return;
    }

    // Only animate when count increased
    if (revealedLineCount <= prevCount.current) {
      prevCount.current = revealedLineCount;
      return;
    }
    prevCount.current = revealedLineCount;

    const from = allCoords[revealedLineCount - 2];
    const to = allCoords[revealedLineCount - 1];
    if (!from || !to || !mapRef.current) return;

    // Convert geo coords to screen points (async, but only once per segment)
    Promise.all([
      mapRef.current.getPointInView(from),
      mapRef.current.getPointInView(to),
    ]).then(([fromPt, toPt]) => {
      if (!fromPt || !toPt) return;

      // Position at start immediately
      dotX.value = fromPt[0];
      dotY.value = fromPt[1];
      dotOpacity.value = 1;
      glowScale.value = 0.5;
      setVisible(true);

      // Animate to destination
      dotX.value = withTiming(toPt[0], {
        duration: LINE_DRAW_MS,
        easing: Easing.inOut(Easing.cubic),
      });
      dotY.value = withTiming(toPt[1], {
        duration: LINE_DRAW_MS,
        easing: Easing.inOut(Easing.cubic),
      });
      glowScale.value = withTiming(1, {
        duration: LINE_DRAW_MS / 2,
        easing: Easing.out(Easing.cubic),
      });
    });

    return () => {
      dotOpacity.value = 0;
    };
  }, [revealedLineCount, isRevealing, allCoords, mapRef]);

  // Fade out when reveal ends
  useEffect(() => {
    if (!isRevealing) {
      dotOpacity.value = withTiming(0, { duration: 400 });
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isRevealing]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [
      { translateX: dotX.value - DOT_SIZE / 2 },
      { translateY: dotY.value - DOT_SIZE / 2 },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value * 0.4,
    transform: [
      { translateX: dotX.value - GLOW_SIZE / 2 },
      { translateY: dotY.value - GLOW_SIZE / 2 },
      { scale: glowScale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={[styles.dot, dotStyle]} />
    </>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: 0,
    left: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#86efac",
    zIndex: 1002,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: "#86efac",
    zIndex: 1001,
  },
});
