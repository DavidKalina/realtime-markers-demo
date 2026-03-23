import { useEffect, useRef } from "react";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";
import { useDistrictMapStore } from "@/stores/useDistrictMapStore";
import { apiClient } from "@/services/ApiClient";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { useUserLocation } from "@/contexts/LocationContext";

/**
 * Detects when an itinerary completion results in exploring a new district.
 * Re-fetches coverage after completion and compares against previous state.
 * Emits DISTRICT_EXPLORED event if a new district was unlocked.
 */
export function useDistrictExplorationReveal(): void {
  const completionData = useActiveItineraryStore((s) => s.completionData);
  const { userLocation } = useUserLocation();
  const prevCompletionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!completionData || !userLocation) return;

    // Dedup: only fire once per completion
    const completionId = completionData.itinerary.id;
    if (completionId === prevCompletionRef.current) return;
    prevCompletionRef.current = completionId;

    // Wait for backend to process the completion and update district memberships
    const timer = setTimeout(async () => {
      try {
        const prevCoverage = useDistrictMapStore.getState().coverageMap;

        const [lng, lat] = userLocation;
        const result = await apiClient.districts.getCoverage(lat, lng, 50);

        const store = useDistrictMapStore.getState();
        store.setCoverage(result.districts);

        // Check for newly explored districts
        for (const d of result.districts) {
          if (d.explored && !prevCoverage[d.id]) {
            store.markExplored(d.id);
            eventBroker.emit(EventTypes.DISTRICT_EXPLORED, {
              timestamp: Date.now(),
              source: "exploration_reveal",
              districtId: d.id,
              districtName: d.name,
            });
          }
        }
      } catch {
        // Silent fail — exploration reveal is non-critical
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [completionData, userLocation]);

}
