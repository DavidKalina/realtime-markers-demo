import { useCallback, useEffect, useRef, useState } from "react";
import type MapboxGL from "@rnmapbox/maps";
import type { ItineraryPreviewStop } from "@/components/Itinerary/ItineraryCarousel";
import { useEventBroker } from "@/hooks/useEventBroker";
import { EventTypes } from "@/services/EventBroker";

interface UseItineraryPreviewOrbitOptions {
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  /** User's pitch preference — used to restore camera when orbit stops */
  isPitched?: boolean;
}

/**
 * Manages the camera orbit + preview marker when browsing itineraries
 * in the carousel. Flies to the first stop, then gently orbits.
 */
export function useItineraryPreviewOrbit({
  cameraRef,
  isPitched,
}: UseItineraryPreviewOrbitOptions) {
  const [previewStop, setPreviewStop] = useState<ItineraryPreviewStop | null>(
    null,
  );
  const [isOrbiting, setIsOrbiting] = useState(false);
  /** Synchronous flag — set before camera commands so consumers (e.g. viewport
   *  pause) see the value immediately, without waiting for a React re-render. */
  const isOrbitingRef = useRef(false);
  const orbitRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isPitchedRef = useRef(isPitched);
  isPitchedRef.current = isPitched;
  const { subscribe } = useEventBroker();

  // Stop any running orbit (and pending start delay)
  const stopOrbit = useCallback(() => {
    if (delayRef.current != null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (orbitRef.current != null) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
    isOrbitingRef.current = false;
    setIsOrbiting(false);
  }, []);

  // Start orbit around a coordinate
  const startOrbit = useCallback(
    (coordinate: [number, number]) => {
      stopOrbit();
      if (!cameraRef.current) return;

      // Initial fly-in: zoom 15, pitched, facing north
      cameraRef.current.setCamera({
        centerCoordinate: coordinate,
        zoomLevel: 15,
        pitch: 50,
        heading: 0,
        animationDuration: 1500,
        animationMode: "flyTo",
      });

      // Don't set isOrbiting yet — let viewport updates flow during the fly-in
      // so the server sends markers for the destination area. We pause only once
      // the rAF rotation loop starts (heading/pitch changes at a fixed point).

      // Start orbit after fly-in completes
      delayRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        // NOW pause viewport updates — the rotation loop doesn't change position
        isOrbitingRef.current = true;
        setIsOrbiting(true);

        let last = performance.now();
        let t = 0;

        // Throttle to ~30fps — orbit is slow enough that 60fps is wasted work
        const FRAME_INTERVAL = 33; // ms

        const tick = (now: number) => {
          if (!isMountedRef.current) return;
          const elapsed = now - last;

          if (elapsed >= FRAME_INTERVAL) {
            const dt = elapsed / 1000;
            last = now;
            t += dt;

            // Slow rotation: full circle every ~30s
            const heading = (t * 12) % 360;
            // Gentle pitch oscillation between 45 and 55
            const pitch = 50 + 5 * Math.sin(t * 0.3);

            cameraRef.current?.setCamera({
              centerCoordinate: coordinate,
              zoomLevel: 15,
              heading,
              pitch,
              animationDuration: FRAME_INTERVAL,
            });
          }

          orbitRef.current = requestAnimationFrame(tick);
        };

        orbitRef.current = requestAnimationFrame(tick);
      }, 1600);

      // Store timeout so we can cancel
      return () => {
        if (delayRef.current != null) {
          clearTimeout(delayRef.current);
          delayRef.current = null;
        }
      };
    },
    [cameraRef, stopOrbit],
  );

  // Handle preview stop changes
  const handlePreviewStop = useCallback(
    (stop: ItineraryPreviewStop | null) => {
      setPreviewStop(stop);

      if (stop) {
        startOrbit(stop.coordinate);
      } else {
        stopOrbit();
        // Restore camera to user's pitch preference
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            heading: 0,
            pitch: isPitchedRef.current ? 52 : 0,
            animationDuration: 800,
            animationMode: "easeTo",
          });
        }
      }
    },
    [startOrbit, stopOrbit, cameraRef],
  );

  // Stop orbit and restore pitch/heading when user pans the map
  const breakOrbitWithRestore = useCallback(() => {
    if (orbitRef.current != null || delayRef.current != null) {
      stopOrbit();
      cameraRef.current?.setCamera({
        heading: 0,
        pitch: isPitchedRef.current ? 52 : 0,
        animationDuration: 800,
        animationMode: "easeTo",
      });
    }
  }, [stopOrbit, cameraRef]);

  // Stop orbit when user pans the map — restore pitch/heading
  useEffect(() => {
    const unsubscribe = subscribe(
      EventTypes.USER_PANNING_VIEWPORT,
      breakOrbitWithRestore,
    );
    return unsubscribe;
  }, [subscribe, breakOrbitWithRestore]);

  // Stop orbit when a programmatic camera animation fires (e.g. marker press).
  // Only cancel the rAF — don't issue a competing setCamera, so useMapCamera
  // can animate to the target coordinates without being overridden.
  useEffect(() => {
    const unsubscribe = subscribe(EventTypes.CAMERA_ANIMATE_TO_LOCATION, () => {
      if (orbitRef.current != null || delayRef.current != null) {
        stopOrbit();
      }
    });
    return unsubscribe;
  }, [subscribe, stopOrbit]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopOrbit();
    };
  }, [stopOrbit]);

  return {
    previewStop,
    handlePreviewStop,
    /** Whether the orbit animation is currently running (state — for re-renders) */
    isOrbiting,
    /** Synchronous ref — for consumers that need the value before re-render */
    isOrbitingRef,
  };
}
