import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";
import { useItineraryJobStore } from "@/stores/useItineraryJobStore";
import { useActiveItineraryStore } from "@/stores/useActiveItineraryStore";

/**
 * Fetches the user's recent READY (uncompleted) itineraries.
 * Shared between ItineraryMapMarkers and ItineraryCarousel.
 *
 * Automatically refetches when:
 * - A generation job completes (hasReady flag)
 * - The active itinerary changes (activation, deactivation, completion)
 */
export function useRecentItineraries() {
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const hasReady = useItineraryJobStore((s) => s.hasReady);
  const clearReady = useItineraryJobStore((s) => s.clearReady);
  const activeItineraryId = useActiveItineraryStore(
    (s) => s.itinerary?.id ?? null,
  );

  const fetch = useCallback(async () => {
    try {
      const result = await apiClient.itineraries.list(10);
      setItineraries(
        (result.data ?? []).filter(
          (it) => it.status === "READY" && !it.completedAt,
        ),
      );
    } catch (err) {
      console.error("[useRecentItineraries] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Refetch when a generation job completes
  useEffect(() => {
    if (hasReady) {
      clearReady();
      fetch();
    }
  }, [hasReady, clearReady, fetch]);

  // Refetch when the active itinerary changes (activation/deactivation/completion)
  const prevActiveIdRef = useRef(activeItineraryId);
  useEffect(() => {
    if (prevActiveIdRef.current !== activeItineraryId) {
      prevActiveIdRef.current = activeItineraryId;
      fetch();
    }
  }, [activeItineraryId, fetch]);

  return { itineraries, loading, refetch: fetch };
}
