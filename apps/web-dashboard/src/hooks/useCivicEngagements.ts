import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { CivicEngagementSummary } from "@realtime-markers/database";

// Use derived CivicEngagement type
type CivicEngagement = CivicEngagementSummary;

interface UseCivicEngagementsResult {
  civicEngagements: CivicEngagement[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCivicEngagements(): UseCivicEngagementsResult {
  const [civicEngagements, setCivicEngagements] = useState<CivicEngagement[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCivicEngagements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllCivicEngagements();
      setCivicEngagements(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch civic engagements",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCivicEngagements();
  }, [fetchCivicEngagements]);

  return { civicEngagements, loading, error, refetch: fetchCivicEngagements };
}
