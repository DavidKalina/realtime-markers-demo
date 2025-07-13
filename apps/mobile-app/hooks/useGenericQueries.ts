// hooks/useGenericQueries.ts
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import debounce from "lodash/debounce";

// ============================================================================
// GENERIC TYPES
// ============================================================================

// Generic pagination response type
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  prevCursor?: string;
  total?: number;
}

// Generic query function type
export type QueryFunction<T> = (params?: Record<string, unknown>) => Promise<T>;

// Generic infinite query function type
export type InfiniteQueryFunction<T> = (
  params: Record<string, unknown>,
) => Promise<PaginatedResponse<T>>;

// Generic mutation function type
export type MutationFunction<TData, TVariables> = (
  variables: TVariables,
) => Promise<TData>;

// ============================================================================
// GENERIC INFINITE QUERY HOOK
// ============================================================================

interface UseInfiniteDataOptions<T> {
  queryKey: string[];
  queryFn: InfiniteQueryFunction<T>;
  initialParams?: Record<string, unknown>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  getNextPageParam?: (lastPage: PaginatedResponse<T>) => string | undefined;
  getPreviousPageParam?: (
    firstPage: PaginatedResponse<T>,
  ) => string | undefined;
}

export const useInfiniteData = <T>({
  queryKey,
  queryFn,
  initialParams = {},
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000, // 10 minutes
  getNextPageParam = (lastPage) => lastPage.nextCursor,
  getPreviousPageParam = (firstPage) => firstPage.prevCursor,
}: UseInfiniteDataOptions<T>) => {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      queryFn({ ...initialParams, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
    getPreviousPageParam,
    enabled,
    staleTime,
    gcTime,
  });
};

// ============================================================================
// GENERIC SINGLE ITEM QUERY HOOK
// ============================================================================

interface UseSingleDataOptions<T> {
  queryKey: string[];
  queryFn: QueryFunction<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export const useSingleData = <T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000, // 10 minutes
}: UseSingleDataOptions<T>) => {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime,
  });
};

// ============================================================================
// GENERIC MUTATION HOOK
// ============================================================================

interface UseMutationOptions<TData, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  invalidateQueries?: string[][];
}

export const useGenericMutation = <TData, TVariables>({
  mutationFn,
  onSuccess,
  onError,
  invalidateQueries = [],
}: UseMutationOptions<TData, TVariables>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate specified queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      onError?.(error, variables);
    },
  });
};

// ============================================================================
// GENERIC SEARCH HOOK
// ============================================================================

interface UseSearchOptions<T> {
  queryKey: string[];
  queryFn: (query: string, params?: Record<string, unknown>) => Promise<T>;
  debounceMs?: number;
  enabled?: boolean;
  initialData?: T;
  staleTime?: number;
  gcTime?: number;
}

export const useSearch = <T>({
  queryKey,
  queryFn,
  debounceMs = 500,
  enabled = true,
  initialData,
  staleTime = 2 * 60 * 1000, // 2 minutes
  gcTime = 5 * 60 * 1000, // 5 minutes
}: UseSearchOptions<T>) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  const debouncedSetQuery = useMemo(
    () => debounce((query: string) => setDebouncedQuery(query), debounceMs),
    [debounceMs],
  );

  const query = useQuery({
    queryKey: [...queryKey, debouncedQuery],
    queryFn: () => queryFn(debouncedQuery),
    enabled: enabled && !!debouncedQuery.trim(),
    staleTime,
    gcTime,
    initialData,
  });

  const handleSearchChange = useCallback(
    (newQuery: string) => {
      setSearchQuery(newQuery);
      debouncedSetQuery(newQuery);
    },
    [debouncedSetQuery],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    debouncedQuery,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    clearSearch,
  };
};

// ============================================================================
// GENERIC INFINITE SEARCH HOOK
// ============================================================================

interface UseInfiniteSearchOptions<T> {
  queryKey: string[];
  queryFn: (
    params: Record<string, unknown> & { query?: string },
  ) => Promise<PaginatedResponse<T>>;
  initialParams?: Record<string, unknown>;
  debounceMs?: number;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export const useInfiniteSearch = <T>({
  queryKey,
  queryFn,
  initialParams = {},
  debounceMs = 500,
  enabled = true,
  staleTime = 2 * 60 * 1000, // 2 minutes
  gcTime = 5 * 60 * 1000, // 5 minutes
}: UseInfiniteSearchOptions<T>) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  const debouncedSetQuery = useMemo(
    () => debounce((query: string) => setDebouncedQuery(query), debounceMs),
    [debounceMs],
  );

  const infiniteQuery = useInfiniteQuery({
    queryKey: [...queryKey, debouncedQuery, initialParams],
    queryFn: ({ pageParam }) =>
      queryFn({
        ...initialParams,
        cursor: pageParam,
        query: debouncedQuery.trim() || undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
    enabled:
      enabled &&
      (!!debouncedQuery.trim() || Object.keys(initialParams).length > 0),
    staleTime,
    gcTime,
  });

  const handleSearchChange = useCallback(
    (newQuery: string) => {
      setSearchQuery(newQuery);
      debouncedSetQuery(newQuery);
    },
    [debouncedSetQuery],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  // Get all items from all pages
  const allItems = useMemo(() => {
    return infiniteQuery.data?.pages.flatMap((page) => page.items) || [];
  }, [infiniteQuery.data]);

  // Check if there are more items to load
  const hasMore = useMemo(() => {
    const lastPage =
      infiniteQuery.data?.pages[infiniteQuery.data.pages.length - 1];
    return !!lastPage?.nextCursor;
  }, [infiniteQuery.data]);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    debouncedQuery,
    data: infiniteQuery.data,
    allItems,
    hasMore,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    isFetchingPreviousPage: infiniteQuery.isFetchingPreviousPage,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
    fetchNextPage: infiniteQuery.fetchNextPage,
    fetchPreviousPage: infiniteQuery.fetchPreviousPage,
    clearSearch,
  };
};

// ============================================================================
// UTILITY HOOKS
// ============================================================================

// Hook to get all items from infinite query pages
export const useAllItemsFromInfiniteQuery = <T>(infiniteQuery: {
  data?: { pages: PaginatedResponse<T>[] };
}): T[] => {
  return (
    infiniteQuery.data?.pages.flatMap(
      (page: PaginatedResponse<T>) => page.items,
    ) || []
  );
};

// Hook to check if there are more items to load
export const useHasMoreItems = (infiniteQuery: {
  data?: { pages: PaginatedResponse<unknown>[] };
}): boolean => {
  return !!infiniteQuery.data?.pages[infiniteQuery.data.pages.length - 1]
    ?.nextCursor;
};

// Hook to get loading states
export const useLoadingStates = (infiniteQuery: {
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isError: boolean;
  error: unknown;
}) => {
  return {
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    isFetchingPreviousPage: infiniteQuery.isFetchingPreviousPage,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error,
  };
};
