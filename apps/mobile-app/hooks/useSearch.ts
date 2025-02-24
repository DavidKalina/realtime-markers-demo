import { useCallback, useEffect, useState } from "react";
import { NativeSyntheticEvent, TextInputSubmitEditingEventData } from "react-native";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const useSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination state - support both cursor and offset pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Reset pagination state
  const resetPagination = () => {
    setNextCursor(null);
    setCurrentOffset(0);
    setSearchResults([]);
  };

  // Handle search query submission
  const handleSearch = useCallback(
    async (e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      if (e) e.preventDefault();
      resetPagination();
      await fetchSearchResults();
    },
    [searchQuery, selectedCategories]
  );

  // Fetch search results
  const fetchSearchResults = async (loadMore = false) => {
    // Determine if we should load more based on pagination type
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

      // Search endpoint - uses cursor pagination
      if (searchQuery.trim()) {
        url = `${API_URL}/search?q=${encodeURIComponent(searchQuery)}&limit=${ITEMS_PER_PAGE}`;

        // Add cursor for pagination if loading more
        if (loadMore && nextCursor) {
          url += `&cursor=${encodeURIComponent(nextCursor)}`;
        }
      }
      // Categories endpoint - uses offset pagination
      else if (selectedCategories.length > 0) {
        url = `${API_URL}/by-categories?categories=${selectedCategories.join(
          ","
        )}&limit=${ITEMS_PER_PAGE}`;

        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      }
      // All events endpoint - uses offset pagination
      else {
        url = `${API_URL}?limit=${ITEMS_PER_PAGE}`;

        if (loadMore) {
          url += `&offset=${newOffset}`;
        }
      }

      const response = await fetch(url);
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
    resetPagination();
  }, []);

  // Effect to trigger search when categories change
  useEffect(() => {
    if (selectedCategories.length > 0) {
      handleSearch();
    }
  }, [selectedCategories]);

  return {
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategories,
    searchResults,
    isLoading,
    isLoadingMore,
    // Different hasMore logic based on endpoint
    hasMoreData: searchQuery.trim() ? !!nextCursor : currentOffset < totalCount,
    handleSearch,
    handleLoadMore,
    toggleCategory,
  };
};

export default useSearch;
