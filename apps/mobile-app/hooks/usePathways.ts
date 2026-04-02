import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { PathwaysResponse } from "@/services/api/modules/pathways";

let cachedPathways: PathwaysResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function usePathways() {
  const [data, setData] = useState<PathwaysResponse | null>(cachedPathways);
  const [isLoading, setIsLoading] = useState(!cachedPathways);

  const fetch = useCallback(async () => {
    const now = Date.now();
    if (cachedPathways && now - cacheTimestamp < CACHE_TTL) {
      setData(cachedPathways);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await apiClient.pathways.getPathways();
      cachedPathways = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[usePathways] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.pathways.getPathways();
      cachedPathways = result;
      cacheTimestamp = Date.now();
      setData(result);
    } catch (err) {
      console.error("[usePathways] Failed to refetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, refetch };
}
