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
  const [isLoading, setIsLoading] = useState(true);
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

  // Refs for debouncing and to prevent concurrent fetches
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch categories when screen is focused.
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      return () => {
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

    if (searchQuery.trim()) {
      debounceTimeout.current = setTimeout(() => {
        setDebouncedSearchQuery(searchQuery);
      }, SEARCH_DEBOUNCE);
    } else {
      // When cleared, immediately update debounced value.
      setDebouncedSearchQuery("");
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  // Auto-search when debounced query or selected categories change.
  useEffect(() => {
    // Always reset pagination before a new fetch.
    resetPagination();
    if (debouncedSearchQuery || selectedCategories.length > 0) {
      fetchSearchResults();
    } else {
      // Only one call to fetchDefaultContent will be made here.
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

  // Fetch default content (upcoming events)
  const fetchDefaultContent = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    // Clear previous results
    setSearchResults([]);

    try {
      const cacheKey = "default_content";
      const cached = cachedResults[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        setSearchResults(cached.data);
        setCurrentOffset(cached.data.length);
        setTotalCount(cached.data.length);
        return;
      }

      const today = new Date();
      const startDate = today.toISOString();

      const response = await fetch(
        `${API_URL}/events?limit=${ITEMS_PER_PAGE}&startDate=${encodeURIComponent(startDate)}`
      );
      if (!response.ok) throw new Error("Failed to fetch default content");

      const data = await response.json();
      let results;
      if (Array.isArray(data)) {
        results = data;
      } else if (data.results) {
        results = data.results;
      } else if (data.events) {
        results = data.events;
      } else {
        results = [];
        console.warn("Unexpected data format:", data);
      }

      setSearchResults(results);
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: { data: results, timestamp: Date.now() },
      }));
      setCurrentOffset(results.length);
      setTotalCount(data.total || results.length);
    } catch (error) {
      console.error("Error fetching default content:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Reset pagination state
  const resetPagination = () => {
    setNextCursor(null);
    setCurrentOffset(0);
  };

  // Handle explicit search submission (e.g. from a submit button)
  const handleSearch = useCallback(
    async (e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      if (e) e.preventDefault();
      setSearchResults([]);
      resetPagination();
      if (!searchQuery.trim() && selectedCategories.length === 0) {
        await fetchDefaultContent();
      } else {
        await fetchSearchResults(false);
      }
    },
    [searchQuery, selectedCategories]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSearchResults([]);
    resetPagination();
    if (searchQuery.trim() || selectedCategories.length > 0) {
      await fetchSearchResults();
    } else {
      await fetchDefaultContent();
    }
    setIsRefreshing(false);
  }, [searchQuery, selectedCategories]);

  // Fetch search results based on current state.
  const fetchSearchResults = async (loadMore = false) => {
    if (isFetchingRef.current && !loadMore) return;

    if (loadMore) {
      if (searchQuery.trim() && !nextCursor) return;
      if (!searchQuery.trim() && currentOffset >= totalCount) return;
      setIsLoadingMore(true);
    } else {
      isFetchingRef.current = true;
      setIsLoading(true);
      // Clear previous results for fresh searches.
      if (!loadMore) {
        setSearchResults([]);
      }
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

      // Check cache if not loading more.
      if (!loadMore) {
        const cached = cachedResults[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
          setSearchResults(cached.data);
          return;
        }
      }

      // Build URL based on search or categories.
      if (searchQuery.trim()) {
        url = `${API_URL}/events/search?q=${encodeURIComponent(
          searchQuery
        )}&limit=${ITEMS_PER_PAGE}`;
        if (loadMore && nextCursor) {
          url += `&cursor=${encodeURIComponent(nextCursor)}`;
        }
      } else if (selectedCategories.length > 0) {
        url = `${API_URL}/events/by-categories?categories=${selectedCategories.join(
          ","
        )}&limit=${ITEMS_PER_PAGE}`;
        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      } else {
        url = `${API_URL}/events?limit=${ITEMS_PER_PAGE}`;
        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch search results");

      const data = await response.json();
      let results: any[] = [];
      let nextPageCursor = null;
      let totalItems = 0;

      if (searchQuery.trim()) {
        results = data.results || [];
        nextPageCursor = data.nextCursor;
      } else if (selectedCategories.length > 0) {
        results = data.events || [];
        totalItems = data.total || 0;
      } else {
        if (Array.isArray(data)) {
          results = data;
          totalItems = data.length;
        } else if (data.results) {
          results = data.results;
          totalItems = data.total || results.length;
        } else if (data.events) {
          results = data.events;
          totalItems = data.total || results.length;
        } else {
          results = [];
          totalItems = 0;
          console.warn("Unexpected data format:", data);
        }
      }

      if (loadMore) {
        setSearchResults((prev) => [...prev, ...results]);
      } else {
        setSearchResults(results);
        setCachedResults((prev) => ({
          ...prev,
          [cacheKey]: { data: results, timestamp: Date.now() },
        }));
      }

      if (searchQuery.trim()) {
        setNextCursor(nextPageCursor);
      } else {
        setCurrentOffset(newOffset + results.length);
        setTotalCount(totalItems);
      }
    } catch (error: any) {
      console.error("Error fetching search results:", error);
      if (loadMore && error.toString().includes("Invalid cursor")) {
        resetPagination();
        await fetchSearchResults(false);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      if (!loadMore) {
        isFetchingRef.current = false;
      }
    }
  };

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
      if (searchQuery.trim() && nextCursor) {
        fetchSearchResults(true);
      } else if (!searchQuery.trim() && currentOffset < totalCount) {
        fetchSearchResults(true);
      }
    }
  }, [isLoading, isLoadingMore, nextCursor, currentOffset, totalCount, searchQuery]);

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }, []);

  const clearFilters = useCallback(async () => {
    resetPagination();
    setSelectedCategories([]);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSearchResults([]);
    await fetchDefaultContent();
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
    // hasMoreData uses cursor for search or offset for default/category results
    hasMoreData: searchQuery.trim() ? !!nextCursor : currentOffset < totalCount,
    handleSearch,
    handleLoadMore,
    handleRefresh,
    toggleCategory,
    clearFilters,
  };
};

export default useSearch;
