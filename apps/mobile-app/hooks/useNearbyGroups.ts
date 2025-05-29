import { useCallback, useEffect, useState } from "react";
import { groupsModule } from "@/services/api/modules/groups";
import type { ClientGroup } from "@/services/api/base/types";

interface UseNearbyGroupsOptions {
  initialLimit?: number;
  categoryId?: string;
  minMemberCount?: number;
  maxDistance?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  autoFetch?: boolean;
}

interface UseNearbyGroupsResult {
  groups: ClientGroup[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reset: () => void;
  updateCoordinates: (coordinates: { lat: number; lng: number }) => void;
}

export function useNearbyGroups({
  initialLimit = 10,
  categoryId,
  minMemberCount,
  maxDistance,
  coordinates,
  autoFetch = true,
}: UseNearbyGroupsOptions): UseNearbyGroupsResult {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCoordinates, setCurrentCoordinates] = useState(coordinates);

  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await groupsModule.nearbyGroups({
        limit: initialLimit,
        categoryId,
        minMemberCount,
        maxDistance,
        coordinates: currentCoordinates,
      });

      setGroups(result.groups);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch nearby groups",
      );
      console.error("Error fetching nearby groups:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    initialLimit,
    categoryId,
    minMemberCount,
    maxDistance,
    currentCoordinates,
  ]);

  const refresh = useCallback(async () => {
    await fetchGroups();
  }, [fetchGroups]);

  const reset = useCallback(() => {
    setGroups([]);
    setError(null);
  }, []);

  const updateCoordinates = useCallback(
    (newCoordinates: { lat: number; lng: number }) => {
      setCurrentCoordinates(newCoordinates);
      // Reset the groups when coordinates change
      reset();
    },
    [reset],
  );

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchGroups();
    }
  }, [autoFetch, fetchGroups]);

  // Refetch when coordinates change
  useEffect(() => {
    if (autoFetch) {
      fetchGroups();
    }
  }, [currentCoordinates, autoFetch, fetchGroups]);

  return {
    groups,
    isLoading,
    error,
    refresh,
    reset,
    updateCoordinates,
  };
}
