import { useCallback, useEffect, useState, useRef } from "react";
import { groupsModule } from "@/services/api/modules/groups";
import { EventType } from "@/types/types";
import * as Haptics from "expo-haptics";

interface UseGroupEventsOptions {
  groupId: string;
  pageSize?: number;
  initialFetch?: boolean;
  query?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface UseGroupEventsReturn {
  events: EventType[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  error: string | null;
  hasMore: boolean;
  hasPrevious: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadPrevious: () => Promise<void>;
  retry: () => Promise<void>;
}

export const useGroupEvents = ({
  groupId,
  pageSize = 10,
  initialFetch = true,
  query,
  categoryId,
  startDate,
  endDate,
}: UseGroupEventsOptions): UseGroupEventsReturn => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [prevCursor, setPrevCursor] = useState<string | undefined>(undefined);
  const [lastLoadMoreAttempt, setLastLoadMoreAttempt] = useState<number>(0);

  // Add refs to track mounted state and prevent state updates after unmount
  const isMounted = useRef(true);
  const fetchEventsRef = useRef<typeof fetchEvents>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchEvents = useCallback(
    async (
      cursor?: string,
      direction: "forward" | "backward" = "forward",
      refresh = false,
    ) => {
      if (!isMounted.current) return;

      try {
        if (refresh) {
          setIsRefreshing(true);
          setNextCursor(undefined);
          setPrevCursor(undefined);
          setHasMore(true);
          setHasPrevious(false);
          setEvents([]);
        } else if (!refresh && !isLoading) {
          setIsFetchingMore(true);
        }

        const response = await groupsModule.getGroupEvents(groupId, {
          cursor,
          limit: pageSize,
          direction,
          query,
          categoryId,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        });

        if (!isMounted.current) return;

        setHasMore(!!response.nextCursor);
        setHasPrevious(!!response.prevCursor);
        setNextCursor(response.nextCursor);
        setPrevCursor(response.prevCursor);

        if (refresh) {
          setEvents(response.events);
        } else {
          // Use Set to efficiently track existing event IDs
          const existingEventIds = new Set(events.map((event) => event.id));
          const newEvents = response.events.filter(
            (event) => !existingEventIds.has(event.id),
          );

          if (newEvents.length > 0) {
            setEvents((prev) => [...prev, ...newEvents]);
          }
        }

        setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        setError("Failed to load events. Please try again.");
        console.error("Error fetching group events:", err);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsFetchingMore(false);
        }
      }
    },
    [
      groupId,
      pageSize,
      query,
      categoryId,
      startDate,
      endDate,
      events,
      isLoading,
    ],
  );

  // Update the ref whenever fetchEvents changes
  useEffect(() => {
    fetchEventsRef.current = fetchEvents;
  }, [fetchEvents]);

  // Initial fetch
  useEffect(() => {
    if (initialFetch && fetchEventsRef.current) {
      fetchEventsRef.current(undefined, "forward", true);
    }
  }, [initialFetch]);

  const refresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fetchEventsRef.current) {
      await fetchEventsRef.current(undefined, "forward", true);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || !nextCursor) return;

    const now = Date.now();
    if (now - lastLoadMoreAttempt < 2000) return; // Prevent rapid load more attempts
    setLastLoadMoreAttempt(now);

    if (fetchEventsRef.current) {
      await fetchEventsRef.current(nextCursor, "forward");
    }
  }, [hasMore, isFetchingMore, nextCursor, lastLoadMoreAttempt]);

  const loadPrevious = useCallback(async () => {
    if (!hasPrevious || isFetchingMore || !prevCursor) return;

    const now = Date.now();
    if (now - lastLoadMoreAttempt < 2000) return; // Prevent rapid load more attempts
    setLastLoadMoreAttempt(now);

    if (fetchEventsRef.current) {
      await fetchEventsRef.current(prevCursor, "backward");
    }
  }, [hasPrevious, isFetchingMore, prevCursor, lastLoadMoreAttempt]);

  const retry = useCallback(async () => {
    if (fetchEventsRef.current) {
      await fetchEventsRef.current(undefined, "forward", true);
    }
  }, []);

  return {
    events,
    isLoading,
    isRefreshing,
    isFetchingMore,
    error,
    hasMore,
    hasPrevious,
    refresh,
    loadMore,
    loadPrevious,
    retry,
  };
};
