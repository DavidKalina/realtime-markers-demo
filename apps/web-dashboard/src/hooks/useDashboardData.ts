import { useEffect, useState } from "react";
import {
  DashboardDataService,
  type DashboardOverview,
  type LlmCostsSummary,
} from "@/lib/dashboard-data";

interface DashboardData {
  overview: DashboardOverview | null;
  llmCosts: LlmCostsSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [llmCosts, setLlmCosts] = useState<LlmCostsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, llmData] = await Promise.all([
        DashboardDataService.getOverview(),
        DashboardDataService.getLlmCostsSummary(),
      ]);
      setOverview(overviewData);
      setLlmCosts(llmData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return {
    overview,
    llmCosts,
    loading,
    error,
    refetch: loadDashboardData,
  };
}
