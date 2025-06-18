import { useState, useEffect } from "react";
import { apiService, type EventEngagement } from "@/services/api";

interface UseEventEngagementReturn {
  engagement: EventEngagement | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useEventEngagement = (
  eventId: string,
  enabled: boolean = true,
): UseEventEngagementReturn => {
  const [engagement, setEngagement] = useState<EventEngagement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEngagement = async () => {
    if (!eventId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getEventEngagement(eventId);

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setEngagement(response.data);
      }
    } catch (err) {
      console.error("Error fetching event engagement:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch engagement data",
      );
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchEngagement();
  };

  useEffect(() => {
    fetchEngagement();
  }, [eventId, enabled]);

  return {
    engagement,
    loading,
    error,
    refetch,
  };
};
