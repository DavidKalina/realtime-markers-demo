import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { ThirdSpaceScoreResponse } from "@/services/api/modules/leaderboard";

interface UseThirdSpaceScoreReturn {
  score: ThirdSpaceScoreResponse | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const useThirdSpaceScore = (city: string | null): UseThirdSpaceScoreReturn => {
  const [score, setScore] = useState<ThirdSpaceScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScore = useCallback(async () => {
    if (!city) return;

    try {
      setIsLoading(true);
      const result = await apiClient.leaderboard.getThirdSpaceScore(city);
      setScore(result);
    } catch (err) {
      console.error("Error fetching third space score:", err);
    } finally {
      setIsLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return { score, isLoading, refetch: fetchScore };
};

export default useThirdSpaceScore;
