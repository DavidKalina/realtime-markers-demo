import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { PopularStop } from "@/services/api/modules/itineraries";

export { type PopularStop };

export default function usePopularStops(city: string | null) {
  const [stops, setStops] = useState<PopularStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const fetch = useCallback(async () => {
    if (!city) {
      setStops([]);
      return;
    }

    const id = ++fetchIdRef.current;
    setIsLoading(true);

    try {
      const data = await apiClient.itineraries.getPopularStops(city);
      if (id === fetchIdRef.current) {
        setStops(data);
      }
    } catch (err) {
      console.error("[usePopularStops] Failed:", err);
      if (id === fetchIdRef.current) {
        setStops([]);
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

  return { stops, isLoading, refetch: fetch };
}
