import React, { useEffect, useMemo, useState } from "react";
import MapboxGL from "@rnmapbox/maps";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";

/** Duration for the camera pan between stops. Exported so the
 *  reveal hook can synchronize camera panning to the same timing. */
export const LINE_DRAW_MS = 2000;
const PULSE_INTERVAL_MS = 1600;

interface Props {
  /** null = show all (normal mode), number = cinematic reveal in progress */
  revealedStopCount: number | null;
}

export default function ItineraryRouteLayer({ revealedStopCount }: Props) {
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

  const isRevealing = revealedStopCount !== null;

  // ── Reveal mode ───────────────────────────────────────────
  // Shows a static line through all revealed stops. No per-frame animation —
  // the camera easeTo provides the visual motion of traveling the route.
  // This avoids frequent re-renders inside MapView which cause native crashes.

  const revealLine = useMemo(() => {
    if (!isRevealing || revealedStopCount == null || revealedStopCount < 2)
      return null;
    const coords = allCoords.slice(0, revealedStopCount);
    if (coords.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: coords },
      properties: {},
    };
  }, [isRevealing, revealedStopCount, allCoords]);

  // ── Normal mode: completed / upcoming split ───────────────

  const { completedCoords, upcomingCoords } = useMemo(() => {
    if (isRevealing || !itinerary?.items?.length || allCoords.length < 2)
      return { completedCoords: null, upcomingCoords: null };

    const sorted = [...itinerary.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((item) => item.latitude != null && item.longitude != null);

    const firstUncheckedIdx = sorted.findIndex((item) => !item.checkedInAt);
    const splitIdx =
      firstUncheckedIdx === -1 ? sorted.length - 1 : firstUncheckedIdx;

    if (firstUncheckedIdx === 0) {
      return { completedCoords: allCoords, upcomingCoords: null };
    }

    return {
      completedCoords: splitIdx >= 1 ? allCoords.slice(0, splitIdx + 1) : null,
      upcomingCoords:
        splitIdx < allCoords.length - 1 ? allCoords.slice(splitIdx) : null,
    };
  }, [isRevealing, itinerary?.items, allCoords]);

  // Breathing opacity for upcoming dashed line
  const [dashOpacity, setDashOpacity] = useState(0.5);

  useEffect(() => {
    if (isRevealing || !upcomingCoords) return;
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) % PULSE_INTERVAL_MS;
      const t = Math.sin((elapsed / PULSE_INTERVAL_MS) * Math.PI * 2);
      setDashOpacity(0.5 + t * 0.2);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRevealing, upcomingCoords]);

  const completedLine = useMemo(() => {
    if (!completedCoords || completedCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: completedCoords,
      },
      properties: {},
    };
  }, [completedCoords]);

  const upcomingLine = useMemo(() => {
    if (!upcomingCoords || upcomingCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: upcomingCoords,
      },
      properties: {},
    };
  }, [upcomingCoords]);

  // ── Render ──

  if (isRevealing) {
    if (!revealLine) return null;
    return (
      <MapboxGL.ShapeSource id="itinerary-reveal-line" shape={revealLine}>
        <MapboxGL.LineLayer
          id="itinerary-reveal-line-layer"
          style={{
            lineColor: "#86efac",
            lineWidth: 3.5,
            lineCap: "round",
            lineJoin: "round",
            lineOpacity: 0.85,
            lineOpacityTransition: { duration: 800, delay: 0 },
          }}
        />
      </MapboxGL.ShapeSource>
    );
  }

  // Always mount both ShapeSources so Mapbox doesn't error when toggling
  // between completed/upcoming states. Empty FeatureCollection as fallback.
  const emptyShape = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [] as never[],
    }),
    [],
  );

  return (
    <>
      <MapboxGL.ShapeSource
        id="itinerary-completed-line"
        shape={completedLine ?? emptyShape}
      >
        <MapboxGL.LineLayer
          id="itinerary-completed-line-layer"
          style={{
            lineColor: "#22c55e",
            lineWidth: 4,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      </MapboxGL.ShapeSource>
      <MapboxGL.ShapeSource
        id="itinerary-upcoming-line"
        shape={upcomingLine ?? emptyShape}
      >
        <MapboxGL.LineLayer
          id="itinerary-upcoming-line-layer"
          style={{
            lineColor: "#86efac",
            lineWidth: 3,
            lineCap: "round",
            lineJoin: "round",
            lineOpacity: dashOpacity,
            lineDasharray: [2, 3],
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  );
}
