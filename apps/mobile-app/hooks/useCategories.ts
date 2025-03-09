import { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../services/ApiClient";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface CategoriesResponse {
  categories: Category[];
  total: number;
  hasMore: boolean;
}

interface UseCategoriesOptions {
  initialPageSize?: number;
  searchDebounceTime?: number;
}

export function useCategories(options: UseCategoriesOptions = {}): {
  categories: Category[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  search: (query: string) => void;
  searchQuery: string;
  refreshing: boolean;
  refresh: () => Promise<void>;
  clearSearch: () => void;
} {
  const { initialPageSize = 20, searchDebounceTime = 300 } = options;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isLoadingMoreRef = useRef(false);

  // Function to fetch categories with pagination and search
  const fetchCategories = useCallback(
    async (
      searchText: string,
      offsetValue: number,
      limit: number,
      shouldReplace: boolean = false
    ) => {
      if (!isMountedRef.current) return;

      // Don't set loading to true when refreshing to avoid flickering
      if (!refreshing && !isLoadingMoreRef.current) {
        setLoading(true);
      }

      try {
        // Use the new getCategories method from apiClient
        const result = await apiClient.getCategories({
          search: searchText,
          limit: limit,
          offset: offsetValue,
        });

        if (isMountedRef.current) {
          if (shouldReplace) {
            setCategories(result.categories);
          } else {
            // Merge new categories with existing ones, avoiding duplicates
            setCategories((prev) => [
              ...prev,
              ...result.categories.filter(
                (newCat) => !prev.some((existingCat) => existingCat.id === newCat.id)
              ),
            ]);
          }

          setHasMore(result.hasMore);
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error("Error fetching categories:", err);
          setError(
            `Failed to load categories: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          isLoadingMoreRef.current = false;
        }
      }
    },
    [refreshing]
  );

  // Load initial data when component mounts or search query changes
  useEffect(() => {
    fetchCategories(searchQuery, 0, initialPageSize, true);

    return () => {
      isMountedRef.current = false;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [fetchCategories, initialPageSize, searchQuery]);

  // Function to load more data (for infinite scroll)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;
    const nextOffset = offset + initialPageSize;
    setOffset(nextOffset);
    await fetchCategories(searchQuery, nextOffset, initialPageSize);
  }, [fetchCategories, hasMore, initialPageSize, loading, offset, searchQuery]);

  // Function to handle search with debouncing
  const search = useCallback(
    (query: string) => {
      setSearchQuery(query);

      // Reset pagination when search changes
      setOffset(0);

      // Clear previous timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      // Set new timer for debouncing
      searchTimerRef.current = setTimeout(() => {
        fetchCategories(query, 0, initialPageSize, true);
      }, searchDebounceTime);
    },
    [fetchCategories, initialPageSize, searchDebounceTime]
  );

  // Function to clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setOffset(0);
    fetchCategories("", 0, initialPageSize, true);
  }, [fetchCategories, initialPageSize]);

  // Function to refresh the data
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    await fetchCategories(searchQuery, 0, initialPageSize, true);
  }, [fetchCategories, initialPageSize, searchQuery]);

  return {
    categories,
    loading,
    error,
    hasMore,
    loadMore,
    search,
    searchQuery,
    refreshing,
    refresh,
    clearSearch,
  };
}
