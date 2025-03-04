// hooks/useEventSearch.ts
import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/ApiClient";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventType } from "@/types/types";

// Convert Marker to EventType for consistent handling
const markerToEventType = (marker: Marker): EventType => {
  return {
    id: marker.id,
    title: marker.data.title || "Unnamed Event",
    description: marker.data.description || "",
    time: marker.data.time || "Time not specified",
    location: marker.data.location || "Location not specified",
    distance: marker.data.distance || "",
    emoji: marker.data.emoji || "📍",
    categories: marker.data.categories || [],
  };
};

interface UseEventSearchProps {
  initialMarkers: Marker[];
}

interface UseEventSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  eventResults: EventType[];
  isLoading: boolean;
  isFetchingMore: boolean;
  error: string | null;
  hasSearched: boolean;
  hasMoreResults: boolean;
  searchEvents: (reset?: boolean) => Promise<void>;
  handleLoadMore: () => void;
  clearSearch: () => void;
}

const useEventSearch = ({ initialMarkers }: UseEventSearchProps): UseEventSearchReturn => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<EventType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Initialize with initial markers if available
  useEffect(() => {
    if (initialMarkers.length > 0 && !hasSearched) {
      const initialEvents = initialMarkers.map(markerToEventType);
      setEventResults(initialEvents);
    }
  }, [initialMarkers, hasSearched]);

  // Search function
  const searchEvents = useCallback(
    async (reset = true) => {
      // If search is empty, show initial markers
      if (!searchQuery.trim()) {
        if (initialMarkers.length > 0) {
          const initialEvents = initialMarkers.map(markerToEventType);
          setEventResults(initialEvents);
        } else {
          setEventResults([]);
        }
        setHasMoreResults(false);
        setNextCursor(undefined);
        setHasSearched(false);
        return;
      }

      if (reset) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }
      setError(null);

      try {
        // Use the cursor for pagination if we're loading more
        const cursorToUse = reset ? undefined : nextCursor;

        const response = await apiClient.searchEvents(
          searchQuery,
          10, // Limit
          cursorToUse
        );

        // Map API results to EventType
        const newResults = response.results.map((result) => ({
          id: result.id,
          title: result.title,
          description: result.description || "",
          time: new Date(result.eventDate).toLocaleString(),
          location: result.address || "Location not specified",
          distance: "",
          emoji: result.emoji || "📍",
          categories: result.categories?.map((c) => c.name) || [],
        }));

        // Update pagination state
        setNextCursor(response.nextCursor);
        setHasMoreResults(!!response.nextCursor);

        // If resetting, replace results. Otherwise, append to existing results
        if (reset) {
          setEventResults(newResults);
        } else {
          // Use functional update to avoid dependency on eventResults
          setEventResults((prev) => {
            const existingIds = new Set(prev.map((event) => event.id));
            const uniqueNewResults = newResults.filter((event) => !existingIds.has(event.id));
            return [...prev, ...uniqueNewResults];
          });
        }

        setHasSearched(true);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search events. Please try again.");
        if (reset) {
          setEventResults([]);
        }
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [searchQuery, nextCursor, initialMarkers] // Removed eventResults from dependencies
  );

  // Handle search query changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchQuery.trim() && !hasSearched) {
      return;
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      searchEvents(true);
    }, 500);

    setSearchTimeout(timeout);

    // Cleanup timeout on component unmount or query change
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery, hasSearched, searchEvents]);

  // Handle loading more results
  const handleLoadMore = useCallback(() => {
    if (!isLoading && !isFetchingMore && hasMoreResults && searchQuery.trim()) {
      searchEvents(false);
    }
  }, [isLoading, isFetchingMore, hasMoreResults, searchQuery, searchEvents]);

  // Clear search query
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    if (initialMarkers.length > 0) {
      const initialEvents = initialMarkers.map(markerToEventType);
      setEventResults(initialEvents);
    } else {
      setEventResults([]);
    }
    setHasSearched(false);
  }, [initialMarkers]);

  return {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading,
    isFetchingMore,
    error,
    hasSearched,
    hasMoreResults,
    searchEvents,
    handleLoadMore,
    clearSearch,
  };
};

export default useEventSearch;
