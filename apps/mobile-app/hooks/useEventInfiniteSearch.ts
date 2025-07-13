// hooks/useEventInfiniteSearch.ts
// Modern infinite scroll search hook using generic queries

import { useCallback } from "react";
import { useInfiniteEventSearch } from "./useEventQueries";
import { EventResponse as EventType } from "@realtime-markers/types";
import { GetEventsParams } from "@/services/api/base/types";

interface UseEventInfiniteSearchOptions {
  initialParams?: GetEventsParams;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseEventInfiniteSearchReturn {
  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedQuery: string;

  // Data
  allItems: EventType[];
  data: unknown; // Infinite query data

  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isError: boolean;

  // Pagination
  hasMore: boolean;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;

  // Error handling
  error: unknown;

  // Utilities
  clearSearch: () => void;
}

/**
 * Modern infinite scroll search hook for events
 * Replaces the outdated useEventSearch.ts with a more robust solution
 */
export const useEventInfiniteSearch = ({
  initialParams = {},
}: UseEventInfiniteSearchOptions = {}): UseEventInfiniteSearchReturn => {
  // Use the infinite search hook from useEventQueries
  const infiniteSearch = useInfiniteEventSearch({
    ...initialParams,
    limit: initialParams.limit || 10,
  });

  // Memoize the search query setter to prevent unnecessary re-renders
  const setSearchQuery = useCallback(
    (query: string) => {
      infiniteSearch.setSearchQuery(query);
    },
    [infiniteSearch.setSearchQuery],
  );

  // Memoize the clear search function
  const clearSearch = useCallback(() => {
    infiniteSearch.clearSearch();
  }, [infiniteSearch.clearSearch]);

  // Memoize the fetch next page function
  const fetchNextPage = useCallback(() => {
    if (infiniteSearch.hasMore && !infiniteSearch.isFetchingNextPage) {
      infiniteSearch.fetchNextPage();
    }
  }, [
    infiniteSearch.hasMore,
    infiniteSearch.isFetchingNextPage,
    infiniteSearch.fetchNextPage,
  ]);

  // Memoize the fetch previous page function
  const fetchPreviousPage = useCallback(() => {
    if (!infiniteSearch.isFetchingPreviousPage) {
      infiniteSearch.fetchPreviousPage();
    }
  }, [infiniteSearch.isFetchingPreviousPage, infiniteSearch.fetchPreviousPage]);

  return {
    // Search state
    searchQuery: infiniteSearch.searchQuery,
    setSearchQuery,
    debouncedQuery: infiniteSearch.debouncedQuery,

    // Data
    allItems: infiniteSearch.allItems,
    data: infiniteSearch.data,

    // Loading states
    isLoading: infiniteSearch.isLoading,
    isFetching: infiniteSearch.isFetching,
    isFetchingNextPage: infiniteSearch.isFetchingNextPage,
    isFetchingPreviousPage: infiniteSearch.isFetchingPreviousPage,
    isError: infiniteSearch.isError,

    // Pagination
    hasMore: infiniteSearch.hasMore,
    fetchNextPage,
    fetchPreviousPage,

    // Error handling
    error: infiniteSearch.error,

    // Utilities
    clearSearch,
  };
};

export default useEventInfiniteSearch;
