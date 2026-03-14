import { useEffect, useRef, useState } from "react";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { LINE_DRAW_MS } from "@/components/Itinerary/ItineraryRouteLayer";

/** Delay (ms) before inserting Mapbox children — lets the native view hierarchy settle. */
const LAYER_MOUNT_DELAY = 1000;

/** Extra buffer after layers mount before the reveal sequence starts. */
const POST_MOUNT_BUFFER = 300;

/** Total delay before the reveal begins (layers mount + buffer). */
const REVEAL_START_DELAY = LAYER_MOUNT_DELAY + POST_MOUNT_BUFFER;

/** Dwell time at each stop before moving to the next. */
const DWELL_MS = 800;

/** How long to linger on a checked-in stop before flying to the next one. */
const CHECKIN_CELEBRATION_MS = 2200;

/** Camera fly duration for the initial approach to the first stop. */
const INITIAL_FLY_MS = 1800;

interface UseItineraryRevealOptions {
  cameraRef: React.RefObject<{
    setCamera: (opts: Record<string, unknown>) => void;
    fitBounds: (...args: unknown[]) => void;
  } | null>;
}

interface UseItineraryRevealResult {
  /** How many stops to show (line + pins). null = show all (normal mode). */
  revealedStopCount: number | null;
  /** True once enough time has passed after activation for Mapbox layers to mount safely. */
  layersSafe: boolean;
}

/**
 * Orchestrates the cinematic reveal sequence when an itinerary is activated.
 *
 * Sequence:
 * 1. Camera flies to first stop, pin appears
 * 2. For each subsequent stop: dwell → camera flies to next stop, line segment + pin appear
 * 3. After all stops, zoom out to fit the full route
 *
 * Also handles deferred MapView layer mount and ITINERARY_CHECKIN subscription.
 */
export function useItineraryReveal({
  cameraRef,
}: UseItineraryRevealOptions): UseItineraryRevealResult {
  const activeItinerary = useActiveItineraryStore((s) => s.itinerary);
  const markCheckedIn = useActiveItineraryStore((s) => s.markCheckedIn);

  // ── Deferred layer mount ──────────────────────────────────
  const [layersSafe, setLayersSafe] = useState(false);

  useEffect(() => {
    if (!activeItinerary) {
      setLayersSafe(false);
      return;
    }

    const timer = setTimeout(() => setLayersSafe(true), LAYER_MOUNT_DELAY);
    return () => {
      clearTimeout(timer);
      setLayersSafe(false);
    };
  }, [activeItinerary?.id]);

  // ── Check-in subscription ─────────────────────────────────
  useEffect(() => {
    const unsub = eventBroker.on(
      EventTypes.ITINERARY_CHECKIN,
      (data: { itineraryId: string; itemId: string; completed: boolean }) => {
        const current = useActiveItineraryStore.getState().itinerary;

        // 1. Fly to the checked-in stop first so the user sees the celebration
        if (current) {
          const checkedItem = current.items.find((i) => i.id === data.itemId);
          if (checkedItem?.latitude && checkedItem?.longitude) {
            cameraRef.current?.setCamera({
              centerCoordinate: [
                Number(checkedItem.longitude),
                Number(checkedItem.latitude),
              ],
              zoomLevel: 16,
              animationDuration: 1000,
              animationMode: "flyTo",
            });
          }
        }

        // 2. Mark checked in (triggers the pin celebration animation)
        markCheckedIn(data.itemId, new Date().toISOString());

        // 3. After celebration plays, fly to the next unchecked stop
        setTimeout(() => {
          const updated = useActiveItineraryStore.getState().itinerary;
          if (updated) {
            const nextStop = [...updated.items]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .find((i) => !i.checkedInAt);
            if (nextStop?.latitude && nextStop?.longitude) {
              cameraRef.current?.setCamera({
                centerCoordinate: [
                  Number(nextStop.longitude),
                  Number(nextStop.latitude),
                ],
                zoomLevel: 15,
                animationDuration: 1200,
                animationMode: "flyTo",
              });
            }
          }
        }, CHECKIN_CELEBRATION_MS);
      },
    );
    return unsub;
  }, [markCheckedIn, cameraRef]);

  // ── Cinematic reveal sequence ─────────────────────────────
  const [revealedStopCount, setRevealedStopCount] = useState<number | null>(
    null,
  );

  const revealedIdRef = useRef<string | null>(
    useActiveItineraryStore.getState().itinerary?.id ?? null,
  );
  const revealTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    revealTimeoutsRef.current.forEach(clearTimeout);
    revealTimeoutsRef.current = [];

    if (!activeItinerary) {
      revealedIdRef.current = null;
      setRevealedStopCount(null);
      return;
    }

    // Only play reveal once per itinerary
    if (revealedIdRef.current === activeItinerary.id) {
      setRevealedStopCount(null);
      return;
    }
    revealedIdRef.current = activeItinerary.id;

    const geoItems = [...activeItinerary.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((i) => i.latitude != null && i.longitude != null);

    if (geoItems.length === 0) {
      setRevealedStopCount(null);
      return;
    }

    const coord = (i: (typeof geoItems)[0]): [number, number] => [
      Number(i.longitude),
      Number(i.latitude),
    ];

    const push = (delay: number, fn: () => void) => {
      revealTimeoutsRef.current.push(setTimeout(fn, delay));
    };

    // Start with nothing visible
    setRevealedStopCount(0);

    // ── Step 1: wait for layers to mount, then fly to first stop ──
    push(REVEAL_START_DELAY, () => {
      setRevealedStopCount(1);
      cameraRef.current?.setCamera({
        centerCoordinate: coord(geoItems[0]),
        zoomLevel: 15,
        pitch: 45,
        animationDuration: INITIAL_FLY_MS,
        animationMode: "flyTo",
      });
    });

    // ── Step 2+: camera flies to each stop, line + pin appear together ──
    let cursor = REVEAL_START_DELAY + INITIAL_FLY_MS;

    geoItems.slice(1).forEach((item, idx) => {
      const revealAt = cursor + DWELL_MS;

      push(revealAt, () => {
        setRevealedStopCount(idx + 2);
        cameraRef.current?.setCamera({
          centerCoordinate: coord(item),
          zoomLevel: 15,
          pitch: 45,
          animationDuration: LINE_DRAW_MS,
          animationMode: "easeTo",
        });
      });

      cursor = revealAt + LINE_DRAW_MS;
    });

    // ── Final: zoom out to show all stops ──
    push(cursor + DWELL_MS, () => {
      const coords = geoItems.map(coord);
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      cameraRef.current?.fitBounds(
        [Math.max(...lngs), Math.max(...lats)],
        [Math.min(...lngs), Math.min(...lats)],
        60,
        1500,
      );
      setRevealedStopCount(null);
    });

    return () => {
      revealTimeoutsRef.current.forEach(clearTimeout);
      revealTimeoutsRef.current = [];
    };
  }, [activeItinerary?.id, cameraRef]);

  return { revealedStopCount, layersSafe };
}
