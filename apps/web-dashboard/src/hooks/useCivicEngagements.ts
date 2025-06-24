import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

// Import the CivicEngagement type from the API client to ensure consistency
interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: "POSITIVE_FEEDBACK" | "NEGATIVE_FEEDBACK" | "IDEA";
  status: "PENDING" | "IN_REVIEW" | "IMPLEMENTED" | "CLOSED";
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
  adminNotes?: string;
  implementedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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
