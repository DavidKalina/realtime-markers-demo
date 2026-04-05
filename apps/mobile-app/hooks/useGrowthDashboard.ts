import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { GrowthDashboardResponse } from "@/services/api/modules/growthDashboard";

let cached: GrowthDashboardResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useGrowthDashboard() {
  const [data, setData] = useState<GrowthDashboardResponse | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);

  const fetch = useCallback(async () => {
    const now = Date.now();
    if (cached && now - cacheTimestamp < CACHE_TTL) {
      setData(cached);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await apiClient.growthDashboard.getDashboard();
      cached = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[useGrowthDashboard] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.growthDashboard.getDashboard();
      cached = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[useGrowthDashboard] Failed to refetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, refetch };
}
