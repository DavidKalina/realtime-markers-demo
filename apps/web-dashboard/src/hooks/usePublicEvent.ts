import { apiClient } from "@/lib/api";
import { useEffect, useState } from "react";

export function usePublicEvent(id: string) {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get(`/api/public/events/${id}`, {
          requireAuth: false,
        });
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchEvent();
    }
  }, [id]);

  return { event, loading, error };
}
