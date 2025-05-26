import { useCallback, useEffect, useState, useRef } from "react";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";

interface UseUserGroupsOptions {
  pageSize?: number;
  initialFetch?: boolean;
}

interface UseUserGroupsReturn {
  groups: ClientGroup[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
}

export const useUserGroups = ({
  pageSize = 10,
  initialFetch = true,
}: UseUserGroupsOptions = {}): UseUserGroupsReturn => {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);

  // Add refs to track mounted state and prevent state updates after unmount
  const isMounted = useRef(true);
  const fetchGroupsRef = useRef<typeof fetchGroups>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchGroups = useCallback(
    async (refresh = false) => {
      if (!isMounted.current) return;

      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setGroups([]);
        } else if (!refresh && !isLoading) {
          setIsFetchingMore(true);
        }

        const response = await apiClient.groups.getUserGroups({
          limit: pageSize,
          cursor: refresh ? undefined : cursor,
        });

        if (!isMounted.current) return;

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setGroups(response.groups);
        } else {
          // Use Set to efficiently track existing group IDs
          const existingGroupIds = new Set(groups.map((group) => group.id));
          const newGroups = response.groups.filter(
            (group) => !existingGroupIds.has(group.id),
          );

          if (newGroups.length > 0) {
            setGroups((prev) => [...prev, ...newGroups]);
          }
        }

        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        setError("Failed to load groups. Please try again.");
        console.error("Error fetching user groups:", err);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsFetchingMore(false);
        }
      }
    },
    [cursor, groups, isLoading, pageSize],
  );

  // Update the ref whenever fetchGroups changes
  useEffect(() => {
    fetchGroupsRef.current = fetchGroups;
  }, [fetchGroups]);

  // Initial fetch
  useEffect(() => {
    if (initialFetch && fetchGroupsRef.current) {
      fetchGroupsRef.current(true);
    }
  }, [initialFetch]);

  const refresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fetchGroupsRef.current) {
      await fetchGroupsRef.current(true);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || !cursor) return;

    const now = Date.now();
    if (now - lastLoadMoreAttempt < 2000) return; // Prevent rapid load more attempts
    setLastLoadMoreAttempt(now);

    if (fetchGroupsRef.current) {
      await fetchGroupsRef.current();
    }
  }, [hasMore, isFetchingMore, cursor, lastLoadMoreAttempt]);

  const retry = useCallback(async () => {
    if (fetchGroupsRef.current) {
      await fetchGroupsRef.current(true);
    }
  }, []);

  return {
    groups,
    isLoading,
    isRefreshing,
    isFetchingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    retry,
  };
};
