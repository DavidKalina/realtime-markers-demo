import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { Event } from "@/lib/dashboard-data";
import debounce from "lodash/debounce";

interface UseEventSearchProps {
  initialEvents: Event[];
}

interface UseEventSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  eventResults: Event[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  searchEvents: (reset?: boolean) => Promise<void>;
  clearSearch: () => void;
}

const useEventSearch = ({
  initialEvents,
}: UseEventSearchProps): UseEventSearchReturn => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<Event[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInProgress = useRef(false);
  const lastSearchQuery = useRef<string>("");

  // Initialize with initial events if available
  useEffect(() => {
    if (initialEvents.length > 0 && !hasSearched) {
      setEventResults(initialEvents);
    }
  }, [initialEvents, hasSearched]);

  // Create a debounced search function that persists across renders
  const debouncedSearchEvents = useMemo(
    () =>
      debounce(async (query: string, reset: boolean = true) => {
        if (!query.trim()) {
          if (initialEvents.length > 0) {
            setEventResults(initialEvents);
          } else {
            setEventResults([]);
          }
          setHasSearched(false);
          setIsLoading(false);
          return;
        }

        // Prevent concurrent searches and duplicate queries
        if (searchInProgress.current || query === lastSearchQuery.current)
          return;
        searchInProgress.current = true;
        lastSearchQuery.current = query;

        try {
          if (reset) {
            setIsLoading(true);
          }
          setError(null);

          // Use the search endpoint from the backend
          const response = await api.get<{ query: string; results: Event[] }>(
            `/api/events/search?q=${encodeURIComponent(query)}`,
          );

          setEventResults(response.results);
          setHasSearched(true);
        } catch (err) {
          console.error("Search error:", err);
          setError("Failed to search events. Please try again.");
          if (reset) {
            setEventResults([]);
          }
        } finally {
          setIsLoading(false);
          searchInProgress.current = false;
        }
      }, 500),
    [initialEvents],
  );

  // Clean up the debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearchEvents.cancel();
    };
  }, [debouncedSearchEvents]);

  // Update search when query changes
  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      debouncedSearchEvents(searchQuery, true);
    }
  }, [searchQuery, hasSearched, debouncedSearchEvents]);

  // Clear search query
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    if (initialEvents.length > 0) {
      setEventResults(initialEvents);
    } else {
      setEventResults([]);
    }
    setHasSearched(false);
    setIsLoading(false);
    lastSearchQuery.current = "";
  }, [initialEvents]);

  // Create a wrapper for searchEvents that matches the expected type
  const searchEvents = useCallback(
    async (reset: boolean = true) => {
      if (!searchQuery.trim()) return;
      await debouncedSearchEvents(searchQuery, reset);
    },
    [searchQuery, debouncedSearchEvents],
  );

  return {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    error,
    hasSearched,
    searchEvents,
    clearSearch,
  };
};

export default useEventSearch;
