import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";

interface CategoryBreakdown {
  name: string;
  icon: string | null;
  count: number;
}

interface CityBreakdown {
  city: string;
  count: number;
}

export interface UserStats {
  categoryBreakdown: CategoryBreakdown[];
  cityBreakdown: CityBreakdown[];
  globalRank: number;
  totalUsers: number;
}

let cachedStats: UserStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface UseUserStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
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
      const url = `${apiClient.baseUrl}/api/users/me/stats`;
      const response = await apiClient.fetchWithAuth(url);
      const data = await response.json();
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

  return { stats, isLoading, refetch: fetchStats };
};

export default useUserStats;
