import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { DistrictBrowseResponse } from "@/services/api/modules/districts";

interface UseBrowseDistrictsReturn {
  districts: DistrictBrowseResponse[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const stabilize = (coord: number | undefined): number | undefined =>
  coord !== undefined ? Math.round(coord * 100) / 100 : undefined;

const useBrowseDistricts = (
  lat?: number,
  lng?: number,
  radius?: number,
): UseBrowseDistrictsReturn => {
  const [districts, setDistricts] = useState<DistrictBrowseResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const stableLat = stabilize(lat);
  const stableLng = stabilize(lng);

  const fetch = useCallback(async () => {
    if (stableLat == null || stableLng == null) return;
    try {
      setIsLoading(true);
      const result = await apiClient.districts.browse(
        stableLat,
        stableLng,
        radius,
      );
      setDistricts(result.data);
    } catch (err) {
      console.error("Error fetching districts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [stableLat, stableLng, radius]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    districts,
    isLoading,
    refetch: fetch,
  };
};

export default useBrowseDistricts;
