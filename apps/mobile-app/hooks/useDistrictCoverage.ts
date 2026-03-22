import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { CoverageResponse } from "@/services/api/modules/districts";

interface UseDistrictCoverageReturn {
  total: number;
  explored: number;
  districts: { id: string; name: string; explored: boolean }[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const stabilize = (coord: number | undefined): number | undefined =>
  coord !== undefined ? Math.round(coord * 100) / 100 : undefined;

const useDistrictCoverage = (
  lat?: number,
  lng?: number,
  radius?: number,
): UseDistrictCoverageReturn => {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stableLat = stabilize(lat);
  const stableLng = stabilize(lng);

  const fetch = useCallback(async () => {
    if (stableLat == null || stableLng == null) return;
    try {
      setIsLoading(true);
      const result = await apiClient.districts.getCoverage(
        stableLat,
        stableLng,
        radius,
      );
      setData(result);
    } catch (err) {
      console.error("Error fetching district coverage:", err);
    } finally {
      setIsLoading(false);
    }
  }, [stableLat, stableLng, radius]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    total: data?.total ?? 0,
    explored: data?.explored ?? 0,
    districts: data?.districts ?? [],
    isLoading,
    refetch: fetch,
  };
};

export default useDistrictCoverage;
