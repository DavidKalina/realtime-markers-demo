import { useCallback, useEffect, useState } from "react";
import { groupsModule } from "@/services/api/modules/groups";
import type { ClientGroup } from "@/services/api/base/types";

interface UseRecentGroupsOptions {
  initialLimit?: number;
  categoryId?: string;
  minMemberCount?: number;
  maxDistance?: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
  autoFetch?: boolean;
}

interface UseRecentGroupsResult {
  groups: ClientGroup[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  hasPrevious: boolean;
  loadMore: () => Promise<void>;
  loadPrevious: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export function useRecentGroups({
  initialLimit = 10,
  categoryId,
  minMemberCount,
  maxDistance,
  coordinates,
  autoFetch = true,
}: UseRecentGroupsOptions = {}): UseRecentGroupsResult {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [prevCursor, setPrevCursor] = useState<string | undefined>();

  const fetchGroups = useCallback(
    async (cursor?: string, direction: "forward" | "backward" = "forward") => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await groupsModule.recentGroups({
          cursor,
          limit: initialLimit,
          direction,
          categoryId,
          minMemberCount,
          maxDistance,
          coordinates,
        });

        setGroups(result.groups);
        setNextCursor(result.nextCursor);
        setPrevCursor(result.prevCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch groups");
        console.error("Error fetching recent groups:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [initialLimit, categoryId, minMemberCount, maxDistance, coordinates],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoading) return;
    await fetchGroups(nextCursor, "forward");
  }, [nextCursor, isLoading, fetchGroups]);

  const loadPrevious = useCallback(async () => {
    if (!prevCursor || isLoading) return;
    await fetchGroups(prevCursor, "backward");
  }, [prevCursor, isLoading, fetchGroups]);

  const refresh = useCallback(async () => {
    await fetchGroups(undefined, "forward");
  }, [fetchGroups]);

  const reset = useCallback(() => {
    setGroups([]);
    setNextCursor(undefined);
    setPrevCursor(undefined);
    setError(null);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchGroups();
    }
  }, [autoFetch, fetchGroups]);

  return {
    groups,
    isLoading,
    error,
    hasMore: !!nextCursor,
    hasPrevious: !!prevCursor,
    loadMore,
    loadPrevious,
    refresh,
    reset,
  };
}
