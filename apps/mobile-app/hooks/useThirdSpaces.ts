import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type {
  ThirdSpaceSummary,
  ThirdSpacesResponse,
} from "@/services/api/modules/leaderboard";

interface UseThirdSpacesReturn {
  topCities: ThirdSpaceSummary[];
  closestCities: ThirdSpaceSummary[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const stabilize = (coord: number | undefined): number | undefined =>
  coord !== undefined ? Math.round(coord * 100) / 100 : undefined;

const useThirdSpaces = (
  userLat?: number,
  userLng?: number,
): UseThirdSpacesReturn => {
  const [data, setData] = useState<ThirdSpacesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stableLat = stabilize(userLat);
  const stableLng = stabilize(userLng);

  const fetch = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.leaderboard.getThirdSpaces(
        stableLat,
        stableLng,
      );
      setData(result);
    } catch (err) {
      console.error("Error fetching third spaces:", err);
    } finally {
      setIsLoading(false);
    }
  }, [stableLat, stableLng]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    topCities: data?.topCities ?? [],
    closestCities: data?.closestCities ?? [],
    isLoading,
    refetch: fetch,
  };
};

export default useThirdSpaces;
