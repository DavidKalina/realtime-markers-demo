import { useState, useEffect, useCallback } from "react";
import { apiClient, LeaderboardEntry } from "@/services/ApiClient";

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  myRank: { rank: number; scanCount: number } | null;
  isLoading: boolean;
  city: string | null;
}

const useLeaderboard = (city: string | null): UseLeaderboardReturn => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<{
    rank: number;
    checkinCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!city) return;

    try {
      setIsLoading(true);
      const [board, rank] = await Promise.all([
        apiClient.leaderboard.getCityLeaderboard(city),
        apiClient.leaderboard.getMyRank(city),
      ]);
      setLeaderboard(board);
      setMyRank(rank);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    myRank,
    isLoading,
    city,
  };
};

export default useLeaderboard;
