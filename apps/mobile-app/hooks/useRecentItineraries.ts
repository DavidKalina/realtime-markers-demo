import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/services/ApiClient";
import type { ItineraryResponse } from "@/services/api/modules/itineraries";

/**
 * Fetches the user's recent READY (uncompleted) itineraries.
 * Shared between ItineraryMapMarkers and ItineraryCarousel.
 */
export function useRecentItineraries() {
  const [itineraries, setItineraries] = useState<ItineraryResponse[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { itineraries, loading, refetch: fetch };
}
