import { useState, useEffect, useCallback } from "react";
import { apiClient, type ProfileInsightsResponse } from "@/services/ApiClient";

let cachedInsights: ProfileInsightsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useProfileInsights() {
  const [data, setData] = useState<ProfileInsightsResponse | null>(
    cachedInsights,
  );
  const [isLoading, setIsLoading] = useState(!cachedInsights);

  const fetch = useCallback(async () => {
    const now = Date.now();
    if (cachedInsights && now - cacheTimestamp < CACHE_TTL) {
      setData(cachedInsights);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await apiClient.getProfileInsights();
      cachedInsights = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[useProfileInsights] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.getProfileInsights();
      cachedInsights = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[useProfileInsights] Failed to refetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, refetch };
}
