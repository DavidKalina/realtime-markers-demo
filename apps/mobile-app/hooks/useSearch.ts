import { useCallback, useEffect, useState, useRef } from "react";
import { NativeSyntheticEvent, TextInputSubmitEditingEventData } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Cache constants
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
const SEARCH_DEBOUNCE = 500; // 500ms debounce for search typing

const useSearch = () => {
  // Main state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cache state
  const [cachedResults, setCachedResults] = useState<{
    [key: string]: { data: any[]; timestamp: number };
  }>({});

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Refs for debouncing
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Initial data fetching for categories and default content
  useFocusEffect(
    useCallback(() => {
      // Fetch categories first
      fetchCategories();

      // Then load default content (upcoming events) if no active search
      if (!searchQuery.trim() && selectedCategories.length === 0) {
        fetchDefaultContent();
      }

      return () => {
        // Clean up debounce on screen unfocus
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
      };
    }, [])
  );

  // Handle search query debouncing
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Only debounce if query has content
    if (searchQuery.trim()) {
      debounceTimeout.current = setTimeout(() => {
        setDebouncedSearchQuery(searchQuery);
      }, SEARCH_DEBOUNCE);
    } else {
      // If search is cleared, immediately reset
      setDebouncedSearchQuery("");
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  // Auto-search when debounced query or category changes
  useEffect(() => {
    if (debouncedSearchQuery || selectedCategories.length > 0) {
      resetPagination();
      fetchSearchResults();
    } else if (!searchQuery.trim() && selectedCategories.length === 0) {
      // If user clears search and categories, reload default content
      fetchDefaultContent();
    }
  }, [debouncedSearchQuery, selectedCategories]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/events/categories`);
      if (!response.ok) throw new Error("Failed to fetch categories");

      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Fetch default content - upcoming events
  const fetchDefaultContent = async () => {
    setIsLoading(true);

    try {
      // Check cache first
      const cacheKey = "default_content";
      const cached = cachedResults[cacheKey];

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        setSearchResults(cached.data);
        setIsLoading(false);
        return;
      }

      // Get today's date for start date
      const today = new Date();

      // Format as ISO string for API
      const startDate = today.toISOString();

      // Fetch upcoming events
      const response = await fetch(
        `${API_URL}/events?limit=${ITEMS_PER_PAGE}&startDate=${encodeURIComponent(startDate)}`
      );

      if (!response.ok) throw new Error("Failed to fetch default content");

      const data = await response.json();

      // Update state and cache
      setSearchResults(data);
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: { data, timestamp: Date.now() },
      }));

      // Update pagination info
      setCurrentOffset(data.length);
      setTotalCount(data.total || data.length);
    } catch (error) {
      console.error("Error fetching default content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset pagination state
  const resetPagination = () => {
    setNextCursor(null);
    setCurrentOffset(0);
    setSearchResults([]);
  };

  // Handle explicit search submission (from search bar)
  const handleSearch = useCallback(
    async (e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      if (e) e.preventDefault();
      // If search is empty and no categories selected, fetch default content
      if (!searchQuery.trim() && selectedCategories.length === 0) {
        fetchDefaultContent();
      } else {
        resetPagination();
        await fetchSearchResults();
      }
    },
    [searchQuery, selectedCategories]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    resetPagination();

    if (searchQuery.trim() || selectedCategories.length > 0) {
      await fetchSearchResults();
    } else {
      await fetchDefaultContent();
    }

    setIsRefreshing(false);
  }, [searchQuery, selectedCategories]);

  // Fetch search results based on current state
  const fetchSearchResults = async (loadMore = false) => {
    // Skip if nothing to search and trying to load more
    if (loadMore) {
      // For cursor pagination (search endpoint)
      if (searchQuery.trim() && !nextCursor) return;

      // For offset pagination (other endpoints)
      if (!searchQuery.trim() && currentOffset >= totalCount) return;

      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      let url = "";
      const newOffset = loadMore ? currentOffset : 0;
      const cacheKey = getCacheKey(
        searchQuery,
        selectedCategories,
        loadMore,
        nextCursor,
        newOffset
      );

      // Check cache first (but not for load more)
      if (!loadMore) {
        const cached = cachedResults[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
          setSearchResults(cached.data);
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      // Search endpoint - uses cursor pagination
      if (searchQuery.trim()) {
        url = `${API_URL}/events/search?q=${encodeURIComponent(
          searchQuery
        )}&limit=${ITEMS_PER_PAGE}`;

        // Add cursor for pagination if loading more
        if (loadMore && nextCursor) {
          url += `&cursor=${encodeURIComponent(nextCursor)}`;
        }
      }
      // Categories endpoint - uses offset pagination
      else if (selectedCategories.length > 0) {
        url = `${API_URL}/events/by-categories?categories=${selectedCategories.join(
          ","
        )}&limit=${ITEMS_PER_PAGE}`;

        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      }
      // All events endpoint - uses offset pagination
      else {
        url = `${API_URL}/events?limit=${ITEMS_PER_PAGE}`;

        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch search results");

      const data = await response.json();

      // Handle different response formats based on endpoint
      let results: any[] = [];
      let nextPageCursor = null;
      let totalItems = 0;

      if (searchQuery.trim()) {
        // Search endpoint
        results = data.results || [];
        nextPageCursor = data.nextCursor;
      } else if (selectedCategories.length > 0) {
        // Categories endpoint
        results = data.events || [];
        totalItems = data.total || 0;
      } else {
        // All events endpoint
        results = Array.isArray(data) ? data : [];
        // If data has a count property, use it
        totalItems = data.total || results.length;
      }

      // Update results - append if loading more, otherwise replace
      if (loadMore) {
        setSearchResults((prev) => [...prev, ...results]);
      } else {
        setSearchResults(results);

        // Cache results (only initial results, not loaded more)
        setCachedResults((prev) => ({
          ...prev,
          [cacheKey]: { data: results, timestamp: Date.now() },
        }));
      }

      // Update pagination state
      if (searchQuery.trim()) {
        // For cursor pagination
        setNextCursor(nextPageCursor);
      } else {
        // For offset pagination
        setCurrentOffset(newOffset + results.length);
        setTotalCount(totalItems);
      }
    } catch (error: any) {
      console.error("Error fetching search results:", error);
      // Handle cursor errors
      if (loadMore && error.toString().includes("Invalid cursor")) {
        // Reset pagination on cursor error
        resetPagination();
        await fetchSearchResults(false);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Get cache key based on current search parameters
  const getCacheKey = (
    query: string,
    categories: any[],
    isLoadMore: boolean,
    cursor: string | null,
    offset: number
  ): string => {
    if (query.trim()) {
      return `search_${query.trim()}_${cursor || "initial"}`;
    } else if (categories.length > 0) {
      return `categories_${categories.sort().join(",")}_${offset}`;
    } else {
      return "default_content";
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore) {
      // For cursor pagination
      if (searchQuery.trim() && nextCursor) {
        fetchSearchResults(true);
      }
      // For offset pagination
      else if (!searchQuery.trim() && currentOffset < totalCount) {
        fetchSearchResults(true);
      }
    }
  }, [isLoading, isLoadingMore, nextCursor, currentOffset, totalCount, searchQuery]);

  // Toggle category selection
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    // Auto search will trigger from the useEffect
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategories([]);
    // Will trigger fetchDefaultContent via useEffect
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategories,
    searchResults,
    isLoading,
    isLoadingMore,
    isRefreshing,
    // Different hasMore logic based on endpoint
    hasMoreData: searchQuery.trim() ? !!nextCursor : currentOffset < totalCount,
    handleSearch,
    handleLoadMore,
    handleRefresh,
    toggleCategory,
    clearFilters,
  };
};

export default useSearch;
