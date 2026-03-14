import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { apiClient } from "@/services/ApiClient";
import type { BrowseItineraryResponse } from "@/services/api/modules/itineraries";

export type { BrowseItineraryResponse };

export default function useBrowseItineraries(city: string | null) {
  const [itineraries, setItineraries] = useState<BrowseItineraryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const fetch = useCallback(async () => {
    if (!city) {
      setItineraries([]);
      return;
    }

    const id = ++fetchIdRef.current;
    setIsLoading(true);

    try {
      const result = await apiClient.itineraries.browse(city, { limit: 50 });
      if (id === fetchIdRef.current) {
        setItineraries(result.data);
      }
    } catch (err) {
      console.error("[useBrowseItineraries] Failed:", err);
      if (id === fetchIdRef.current) {
        setItineraries([]);
      }
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [city]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const groupedByIntention = useMemo(() => {
    const groups: Record<string, BrowseItineraryResponse[]> = {};
    for (const it of itineraries) {
      const key = it.intention || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    }
    return groups;
  }, [itineraries]);

  return { itineraries, groupedByIntention, isLoading, refetch: fetch };
}
