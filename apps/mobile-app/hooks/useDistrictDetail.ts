import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/ApiClient";
import type { DistrictDetailResponse } from "@/services/api/modules/districts";

interface UseDistrictDetailReturn {
  data: DistrictDetailResponse | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const useDistrictDetail = (
  districtId: string | null,
): UseDistrictDetailReturn => {
  const [data, setData] = useState<DistrictDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!districtId) return;
    try {
      setIsLoading(true);
      const result = await apiClient.districts.getDetail(districtId);
      setData(result);
    } catch (err) {
      console.error("Error fetching district detail:", err);
    } finally {
      setIsLoading(false);
    }
  }, [districtId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    isLoading,
    refetch: fetch,
  };
};

export default useDistrictDetail;
