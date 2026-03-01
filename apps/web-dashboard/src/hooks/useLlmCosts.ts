import { useEffect, useState } from "react";
import { apiService } from "@/services/api";
import type { LlmCostsData } from "@/services/api";

interface UseLlmCostsResult {
  data: LlmCostsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLlmCosts(days: number = 30): UseLlmCostsResult {
  const [data, setData] = useState<LlmCostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getLlmCosts(days);
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || "Failed to fetch LLM costs");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch LLM costs",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  return { data, loading, error, refetch: fetchData };
}
