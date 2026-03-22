import { useEffect, useRef } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";

const HYSTERESIS_RATIO = 0.8; // New candidate must be 20% closer to switch
const MIN_ZOOM = 10; // Hide chip when zoomed out beyond this

/**
 * Determines which district the user is "looking at" based on viewport center.
 * Simply picks the nearest district centroid to the viewport center.
 * Uses hysteresis to prevent flickering on district boundaries.
 * Clears focus when zoomed out (zoom < 10) so the chip hides.
 */
export function useDistrictFocus(): void {
  const mapViewport = useLocationStore((s) => s.mapViewport);
  const zoomLevel = useLocationStore((s) => s.zoomLevel);
  const districts = useDistrictMapStore((s) => s.districts);
  const setFocusedDistrict = useDistrictMapStore((s) => s.setFocusedDistrict);

  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapViewport || districts.length === 0 || zoomLevel < MIN_ZOOM) {
      if (currentIdRef.current !== null) {
        currentIdRef.current = null;
        setFocusedDistrict(null);
      }
      return;
    }

    const centerLat = (mapViewport.north + mapViewport.south) / 2;
    const centerLng = (mapViewport.east + mapViewport.west) / 2;

    // Find nearest district centroid — no viewport bounds check,
    // just closest to center
    let bestId: string | null = null;
    let bestDist = Infinity;
    let currentDist = Infinity;

    for (const d of districts) {
      const dist =
        (d.centroidLat - centerLat) ** 2 + (d.centroidLng - centerLng) ** 2;

      if (dist < bestDist) {
        bestDist = dist;
        bestId = d.id;
      }

      if (d.id === currentIdRef.current) {
        currentDist = dist;
      }
    }

    // Hysteresis: keep current unless new is significantly closer
    if (currentIdRef.current !== null && currentDist < Infinity) {
      if (bestId !== currentIdRef.current && bestDist > currentDist * HYSTERESIS_RATIO) {
        return; // Keep current — new candidate isn't close enough
      }
    }

    if (bestId !== currentIdRef.current) {
      currentIdRef.current = bestId;
      setFocusedDistrict(bestId);
    }
  }, [mapViewport, zoomLevel, districts, setFocusedDistrict]);
}
