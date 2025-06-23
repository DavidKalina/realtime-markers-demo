import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "@/services/ApiClient";
import { CivicEngagement } from "@/services/ApiClient";

interface UseCivicEngagementsOptions {
  authUserId: string;
  initialLimit?: number;
  autoFetch?: boolean;
  type?: "my-engagements" | "all-engagements";
}

interface UseCivicEngagementsResult {
  civicEngagements: CivicEngagement[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchCivicEngagements: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCivicEngagements = ({
  authUserId,
  initialLimit = 10,
  autoFetch = true,
  type = "my-engagements",
}: UseCivicEngagementsOptions): UseCivicEngagementsResult => {
  const [civicEngagements, setCivicEngagements] = useState<CivicEngagement[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);

  // Use refs to track state that shouldn't trigger re-renders
  const isLoadingRef = useRef(isLoading);
  const cursorRef = useRef(cursor);
  const civicEngagementsLengthRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    isLoadingRef.current = isLoading;
    cursorRef.current = cursor;
    civicEngagementsLengthRef.current = civicEngagements.length;
  }, [isLoading, cursor, civicEngagements.length]);

  const fetchCivicEngagements = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setCivicEngagements([]);
        } else if (!refresh && !isLoadingRef.current) {
          setIsFetchingMore(true);
        }

        let response;

        if (type === "my-engagements") {
          // Get current user's civic engagements
          // Note: This assumes we have access to the current user ID
          // You might need to get this from auth context or pass it as a parameter
          const currentUserId = authUserId; // TODO: Get from auth context
          response =
            await apiClient.civicEngagements.getCivicEngagementsByCreator(
              currentUserId,
              {
                limit: initialLimit,
                cursor: refresh ? undefined : cursorRef.current,
              },
            );
        } else {
          // Get all civic engagements
          response = await apiClient.civicEngagements.getCivicEngagements({
            limit: initialLimit,
            offset: refresh ? 0 : civicEngagementsLengthRef.current,
          });

          // Transform the response to match the expected format
          response = {
            civicEngagements: response.civicEngagements,
            nextCursor:
              response.total >
              civicEngagementsLengthRef.current +
                response.civicEngagements.length
                ? "has-more"
                : undefined,
          };
        }

        setHasMore(!!response.nextCursor);
        setCursor(response.nextCursor);

        if (refresh) {
          setCivicEngagements(response.civicEngagements);
        } else {
          setCivicEngagements((prevEngagements) => {
            // Filter out duplicates based on engagement ID
            const existingEngagementIds = new Set(
              prevEngagements.map((engagement) => engagement.id),
            );
            const newEngagements = response.civicEngagements.filter(
              (engagement) => !existingEngagementIds.has(engagement.id),
            );
            return [...prevEngagements, ...newEngagements];
          });
        }

        setError(null);
      } catch (err) {
        setError(
          `Failed to load ${
            type === "my-engagements" ? "your" : "civic"
          } engagements. Please try again.`,
        );
        console.error(`Error fetching ${type} civic engagements:`, err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingMore(false);
      }
    },
    [initialLimit, type],
  );

  // Reset state when type changes
  useEffect(() => {
    // Clear all state immediately
    setCivicEngagements([]);
    setCursor(undefined);
    setHasMore(true);
    setError(null);
    setIsLoading(true);
    setIsRefreshing(false);
    setIsFetchingMore(false);

    // Then fetch new data if autoFetch is enabled
    if (autoFetch) {
      fetchCivicEngagements(true);
    }
  }, [type, autoFetch, fetchCivicEngagements]);

  const loadMore = useCallback(async () => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursorRef.current) {
      await fetchCivicEngagements();
    }
  }, [
    isFetchingMore,
    isRefreshing,
    hasMore,
    fetchCivicEngagements,
    lastLoadMoreAttempt,
  ]);

  const refresh = useCallback(async () => {
    await fetchCivicEngagements(true);
  }, [fetchCivicEngagements]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      setCursor(undefined);
      setHasMore(true);
      fetchCivicEngagements();
    }
  }, [autoFetch, fetchCivicEngagements]);

  return {
    civicEngagements,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    isFetchingMore,
    fetchCivicEngagements,
    loadMore,
    refresh,
  };
};
