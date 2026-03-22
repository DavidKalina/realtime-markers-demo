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
  const fetchingRef = useRef(false);
  const lastSnappedRef = useRef<string | null>(null);

  const fetchDistricts = (lat: number, lng: number) => {
    const snappedLat = snap(lat);
    const snappedLng = snap(lng);

    const key = `${snappedLat},${snappedLng}`;
    if (key === lastSnappedRef.current) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    lastSnappedRef.current = key;

    Promise.all([
      apiClient.districts.browse(snappedLat, snappedLng, FETCH_RADIUS_MILES),
      apiClient.districts
        .getCoverage(snappedLat, snappedLng, FETCH_RADIUS_MILES)
        .catch(() => null),
    ])
      .then(([browseResult, coverageResult]) => {
        const s = useDistrictMapStore.getState();
        s.setDistricts(browseResult.data);
        if (coverageResult) {
          s.setCoverage(coverageResult.districts);
        }
      })
      .catch((err) => {
        console.error("[useDistrictMapData] Fetch error:", err);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  };

  // Initial fetch from user location (before any pan)
  useEffect(() => {
    if (!userLocation || lastSnappedRef.current) return;
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
