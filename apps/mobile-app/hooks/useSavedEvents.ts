import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "@/services/ApiClient";
import { EventType } from "@/types/types";

interface UseSavedEventsOptions {
  initialLimit?: number;
  autoFetch?: boolean;
  type?: "personal" | "friends" | "discovered";
}

interface UseSavedEventsResult {
  events: EventType[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchEvents: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useSavedEvents = ({
  initialLimit = 10,
  autoFetch = true,
  type = "personal",
}: UseSavedEventsOptions = {}): UseSavedEventsResult => {
  const [events, setEvents] = useState<EventType[]>([]);
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

  // Keep refs in sync with state
  useEffect(() => {
    isLoadingRef.current = isLoading;
    cursorRef.current = cursor;
  }, [isLoading, cursor]);

  const fetchEvents = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
          setCursor(undefined);
          setHasMore(true);
          setEvents([]);
        } else if (!refresh && !isLoadingRef.current) {
          setIsFetchingMore(true);
        }

        // Add a cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        let response;

        switch (type) {
          case "personal":
            response = await apiClient.events.getSavedEvents({
              limit: initialLimit,
              cursor: refresh ? undefined : cursorRef.current,
              _t: timestamp,
            });
            break;
          case "friends":
            response = await apiClient.events.getFriendsSavedEvents({
              limit: initialLimit,
              cursor: refresh ? undefined : cursorRef.current,
              _t: timestamp,
            });
            break;
          case "discovered":
            response = await apiClient.events.getUserDiscoveredEvents({
              limit: initialLimit,
              cursor: refresh ? undefined : cursorRef.current,
              _t: timestamp,
            });
            break;
        }

        // Only update state if this is still the current type
        if (
          type === "personal" ||
          type === "friends" ||
          type === "discovered"
        ) {
          setHasMore(!!response.nextCursor);
          setCursor(response.nextCursor);

          if (refresh) {
            setEvents(response.events);
          } else {
            setEvents((prevEvents) => {
              // Filter out duplicates based on event ID
              const existingEventIds = new Set(
                prevEvents.map((event) => event.id),
              );
              const newEvents = response.events.filter(
                (event) => !existingEventIds.has(event.id),
              );
              return [...prevEvents, ...newEvents];
            });
          }
        }

        setError(null);
      } catch (err) {
        setError(
          `Failed to load ${
            type === "personal"
              ? "your"
              : type === "friends"
                ? "friends'"
                : "discovered"
          } saved events. Please try again.`,
        );
        console.error(`Error fetching ${type} saved events:`, err);
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
    setEvents([]);
    setCursor(undefined);
    setHasMore(true);
    setError(null);
    setIsLoading(true);
    setIsRefreshing(false);
    setIsFetchingMore(false);

    // Then fetch new data if autoFetch is enabled
    if (autoFetch) {
      fetchEvents(true);
    }
  }, [type, autoFetch, fetchEvents]);

  const loadMore = useCallback(async () => {
    if (!hasMore) {
      const now = Date.now();
      if (now - lastLoadMoreAttempt < 20000) {
        return;
      }
      setLastLoadMoreAttempt(now);
    }

    if (!isFetchingMore && !isRefreshing && hasMore && cursorRef.current) {
      await fetchEvents();
    }
  }, [isFetchingMore, isRefreshing, hasMore, fetchEvents, lastLoadMoreAttempt]);

  const refresh = useCallback(async () => {
    await fetchEvents(true);
  }, [fetchEvents]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      setCursor(undefined);
      setHasMore(true);
      fetchEvents();
    }
  }, [autoFetch, fetchEvents]);

  return {
    events,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    isFetchingMore,
    fetchEvents,
    loadMore,
    refresh,
  };
};
