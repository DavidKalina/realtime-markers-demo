import { useEffect, useRef } from "react";
import { useUserLocation } from "@/contexts/LocationContext";
import { useLocationStore } from "@/stores/useLocationStore";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { apiClient } from "@/services/ApiClient";

const FETCH_RADIUS_MILES = 50;

/** Snap coordinate to 0.05° grid (~5.5km) to coarsely gate fetches. */
const snap = (n: number): number => Math.round(n / 0.05) * 0.05;

/**
 * Fetches district browse + coverage data for the map, gated by viewport movement.
 * Also does an initial fetch from userLocation so districts appear before the first pan.
 */
export function useDistrictMapData(): void {
  const mapViewport = useLocationStore((s) => s.mapViewport);
  const { userLocation } = useUserLocation();
  const fetchedKeysRef = useRef(new Set<string>());

  const fetchDistricts = (lat: number, lng: number, prefetch = false) => {
    const snappedLat = snap(lat);
    const snappedLng = snap(lng);

    const key = `${snappedLat},${snappedLng}`;
    // Skip if we've already fetched this grid cell (ever, not just last time).
    // Since the store now merges, we never need to re-fetch the same cell.
    if (fetchedKeysRef.current.has(key)) return;
    fetchedKeysRef.current.add(key);

    Promise.all([
      apiClient.districts.browse(snappedLat, snappedLng, FETCH_RADIUS_MILES),
      apiClient.districts
        .getCoverage(snappedLat, snappedLng, FETCH_RADIUS_MILES)
        .catch(() => null),
    ])
      .then(([browseResult, coverageResult]) => {
        // Read fresh viewport center at resolve-time (may have moved since fetch started)
        const vp = useLocationStore.getState().mapViewport;
        const center = vp
          ? { lat: (vp.north + vp.south) / 2, lng: (vp.east + vp.west) / 2 }
          : undefined;

        const s = useDistrictMapStore.getState();
        s.setDistricts(browseResult.data, center);
        if (coverageResult) {
          s.setCoverage(coverageResult.districts);
        }

        // Prefetch 8 neighboring grid cells so districts are already loaded
        // when the user pans. Fire-and-forget — dedup set prevents re-fetches.
        if (!prefetch) {
          const STEP = 0.05;
          for (const dLat of [-STEP, 0, STEP]) {
            for (const dLng of [-STEP, 0, STEP]) {
              if (dLat === 0 && dLng === 0) continue;
              fetchDistricts(snappedLat + dLat, snappedLng + dLng, true);
            }
          }
        }
      })
      .catch((err) => {
        console.error("[useDistrictMapData] Fetch error:", err);
        // Allow retry on failure
        fetchedKeysRef.current.delete(key);
      });
  };

  // Initial fetch from user location (before any pan)
  useEffect(() => {
    if (!userLocation || fetchedKeysRef.current.size > 0) return;
    const [lng, lat] = userLocation;
    fetchDistricts(lat, lng);
  }, [userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subsequent fetches from viewport changes
  useEffect(() => {
    if (!mapViewport) return;
    const centerLat = (mapViewport.north + mapViewport.south) / 2;
    const centerLng = (mapViewport.east + mapViewport.west) / 2;
    fetchDistricts(centerLat, centerLng);
  }, [mapViewport]); // eslint-disable-line react-hooks/exhaustive-deps
}
