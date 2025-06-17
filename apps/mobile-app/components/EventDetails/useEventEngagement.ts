import { apiClient } from "@/services/ApiClient";
import { EventEngagementMetrics } from "@/services/api/base/types";
import { useCallback, useEffect, useState } from "react";

interface UseEventEngagementReturn {
  engagement: EventEngagementMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useEventEngagement = (
  eventId: string,
  enabled: boolean = true,
  onEngagementUpdate?: () => void,
): UseEventEngagementReturn => {
  const [engagement, setEngagement] = useState<EventEngagementMetrics | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEngagement = useCallback(async () => {
    if (!eventId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.events.getEventEngagement(eventId);
      setEngagement(data);
    } catch (err) {
      console.error("Error fetching event engagement:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch engagement data",
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled]);

  const refetch = useCallback(async () => {
    await fetchEngagement();
    onEngagementUpdate?.();
  }, [fetchEngagement, onEngagementUpdate]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  return {
    engagement,
    loading,
    error,
    refetch,
  };
};
