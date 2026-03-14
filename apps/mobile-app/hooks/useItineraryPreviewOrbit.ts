import { useCallback, useEffect, useRef, useState } from "react";
import type MapboxGL from "@rnmapbox/maps";
import type { ItineraryPreviewStop } from "@/components/Itinerary/ItineraryCarousel";

interface UseItineraryPreviewOrbitOptions {
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
}

/**
 * Manages the camera orbit + preview marker when browsing itineraries
 * in the carousel. Flies to the first stop, then gently orbits.
 */
export function useItineraryPreviewOrbit({
  cameraRef,
}: UseItineraryPreviewOrbitOptions) {
  const [previewStop, setPreviewStop] = useState<ItineraryPreviewStop | null>(
    null,
  );
  const orbitRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const savedCameraRef = useRef<{
    center: [number, number];
    zoom: number;
  } | null>(null);

  // Stop any running orbit
  const stopOrbit = useCallback(() => {
    if (orbitRef.current != null) {
      cancelAnimationFrame(orbitRef.current);
      orbitRef.current = null;
    }
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

      // Start orbit after fly-in completes
      const startDelay = setTimeout(() => {
        if (!isMountedRef.current) return;
        let last = performance.now();
        let t = 0;

        const tick = (now: number) => {
          if (!isMountedRef.current) return;
          const dt = (now - last) / 1000;
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
            animationDuration: 0,
          });

          orbitRef.current = requestAnimationFrame(tick);
        };

        orbitRef.current = requestAnimationFrame(tick);
      }, 1600);

      // Store timeout so we can cancel
      return () => clearTimeout(startDelay);
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
        // Restore flat camera
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            heading: 0,
            pitch: 0,
            animationDuration: 800,
            animationMode: "easeTo",
          });
        }
      }
    },
    [startOrbit, stopOrbit, cameraRef],
  );

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
  };
}
