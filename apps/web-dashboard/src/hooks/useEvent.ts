import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Event } from "@/lib/dashboard-data";

interface UseEventResult {
  event: Event | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEvent(id: string): UseEventResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!id) {
      setError("Event ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const eventData = await api.getEventById(id);
      setEvent(eventData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch event";
      setError(errorMessage);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return {
    event,
    loading,
    error,
    refetch: fetchEvent,
  };
}
