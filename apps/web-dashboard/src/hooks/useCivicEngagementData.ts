import { useEffect, useState } from "react";
import { apiService } from "@/services/api";
import type {
  CivicEngagementMetrics,
  CivicEngagementTrends,
  CivicEngagementStatusAnalysis,
  CivicEngagementGeographic,
  CivicEngagementActivity,
} from "@/services/api";

interface CivicEngagementData {
  metrics: CivicEngagementMetrics | null;
  trends: CivicEngagementTrends | null;
  statusAnalysis: CivicEngagementStatusAnalysis | null;
  geographic: CivicEngagementGeographic | null;
  activity: CivicEngagementActivity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCivicEngagementData(): CivicEngagementData {
  const [metrics, setMetrics] = useState<CivicEngagementMetrics | null>(null);
  const [trends, setTrends] = useState<CivicEngagementTrends | null>(null);
  const [statusAnalysis, setStatusAnalysis] =
    useState<CivicEngagementStatusAnalysis | null>(null);
  const [geographic, setGeographic] =
    useState<CivicEngagementGeographic | null>(null);
  const [activity, setActivity] = useState<CivicEngagementActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCivicEngagementData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        metricsResponse,
        trendsResponse,
        statusResponse,
        geographicResponse,
        activityResponse,
      ] = await Promise.all([
        apiService.getCivicEngagementMetrics(),
        apiService.getCivicEngagementTrends(),
        apiService.getCivicEngagementStatusAnalysis(),
        apiService.getCivicEngagementGeographic(),
        apiService.getCivicEngagementActivity(),
      ]);

      if (metricsResponse.error) throw new Error(metricsResponse.error);
      if (trendsResponse.error) throw new Error(trendsResponse.error);
      if (statusResponse.error) throw new Error(statusResponse.error);
      if (geographicResponse.error) throw new Error(geographicResponse.error);
      if (activityResponse.error) throw new Error(activityResponse.error);

      setMetrics(metricsResponse.data || null);
      setTrends(trendsResponse.data || null);
      setStatusAnalysis(statusResponse.data || null);
      setGeographic(geographicResponse.data || null);
      setActivity(activityResponse.data || []);
    } catch (err) {
      console.error("Failed to load civic engagement data:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load civic engagement data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCivicEngagementData();
  }, []);

  return {
    metrics,
    trends,
    statusAnalysis,
    geographic,
    activity,
    loading,
    error,
    refetch: loadCivicEngagementData,
  };
}
