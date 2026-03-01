import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "@/services/ApiClient";
import { useAuth } from "@/contexts/AuthContext";
import { FollowedUser } from "@/services/api/modules/follows";
import { invalidateProfileCache } from "@/hooks/useProfile";

interface UseFollowingOptions {
  initialLimit?: number;
  autoFetch?: boolean;
}

interface UseFollowingResult {
  users: FollowedUser[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
}

export const useFollowing = ({
  initialLimit = 20,
  autoFetch = true,
}: UseFollowingOptions = {}): UseFollowingResult => {
  const { user } = useAuth();
  const [users, setUsers] = useState<FollowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);

  const isLoadingRef = useRef(isLoading);
  const cursorRef = useRef(cursor);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    cursorRef.current = cursor;
  }, [isLoading, cursor]);

  const fetchFollowing = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setUsers([]);
        } else if (!refresh && !isLoadingRef.current) {
          setIsFetchingMore(true);
        }

        const response = await apiClient.follows.getFollowing(user.id, {
          limit: initialLimit,
          cursor: refresh ? undefined : cursorRef.current,
        });

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setUsers(response.users);
        } else {
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const newUsers = response.users.filter(
              (u) => !existingIds.has(u.id),
            );
            return [...prev, ...newUsers];
          });
        }

        setError(null);
      } catch (err) {
        setError("Failed to load following. Please try again.");
        console.error("Error fetching following:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingMore(false);
      }
    },
    [initialLimit, user?.id],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursorRef.current) {
      await fetchFollowing();
    }
  }, [
    isFetchingMore,
    isRefreshing,
    hasMore,
    fetchFollowing,
    lastLoadMoreAttempt,
  ]);

  const refresh = useCallback(async () => {
    await fetchFollowing(true);
  }, [fetchFollowing]);

  const unfollowUser = useCallback(
    async (targetUserId: string) => {
      // Optimistic removal
      setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      invalidateProfileCache();

      try {
        await apiClient.follows.toggleFollow(targetUserId);
      } catch (err) {
        console.error("Error unfollowing user:", err);
        // Revert on failure by refetching
        await fetchFollowing(true);
      }
    },
    [fetchFollowing],
  );

  useEffect(() => {
    if (autoFetch && user?.id) {
      setCursor(undefined);
      setHasMore(true);
      fetchFollowing();
    }
  }, [autoFetch, fetchFollowing, user?.id]);

  return {
    users,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    isFetchingMore,
    loadMore,
    refresh,
    unfollowUser,
  };
};
