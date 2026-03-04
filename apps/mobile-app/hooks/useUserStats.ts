import { useState, useEffect, useCallback } from "react";
import { apiClient, UserStats } from "@/services/ApiClient";

let cachedStats: UserStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface UseUserStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
}

const useUserStats = (): UseUserStatsReturn => {
  const [stats, setStats] = useState<UserStats | null>(cachedStats);
  const [isLoading, setIsLoading] = useState(!cachedStats);

  const fetchStats = useCallback(async () => {
    const now = Date.now();
    if (cachedStats && now - cacheTimestamp < CACHE_TTL) {
      setStats(cachedStats);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiClient.leaderboard.getMyStats();
      cachedStats = data;
      cacheTimestamp = Date.now();
      setStats(data);
    } catch (err) {
      console.error("Error fetching user stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading };
};

export default useUserStats;
