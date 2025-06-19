import { useEffect, useState } from "react";
import { DashboardDataService, type QueryInsights } from "@/lib/dashboard-data";

interface QueryInsightsOptions {
  days?: number;
  limit?: number;
  minSearches?: number;
}

interface QueryInsightsData {
  insights: QueryInsights | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQueryInsights(
  options: QueryInsightsOptions = {},
): QueryInsightsData {
  const [insights, setInsights] = useState<QueryInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueryInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const insightsData = await DashboardDataService.getQueryInsights(options);
      setInsights(insightsData);
    } catch (err) {
      console.error("Failed to load query insights:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load query insights",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueryInsights();
  }, [options.days, options.limit, options.minSearches]);

  return {
    insights,
    loading,
    error,
    refetch: loadQueryInsights,
  };
}
