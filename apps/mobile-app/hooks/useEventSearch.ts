// hooks/useEventSearch.ts
import { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "@/services/ApiClient";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventType } from "@/types/types";

// Convert Marker to EventType for consistent handling
const markerToEventType = (marker: Marker): EventType => {
  return {
    id: marker.id,
    title: marker.data.title || "Unnamed Event",
    description: marker.data.description || "",
    eventDate: marker.data.eventDate || new Date().toISOString(),
    endDate: marker.data.endDate,
    time: marker.data.time || "Time not specified",
    coordinates: marker.coordinates,
    location: marker.data.location || "Location not specified",
    locationNotes: marker.data.locationNotes,
    distance: marker.data.distance || "",
    emoji: marker.data.emoji || "📍",
    categories: marker.data.categories || [],
    creator: marker.data.creator,
    scanCount: marker.data.scanCount ?? 1,
    saveCount: marker.data.saveCount ?? 0,
    timezone: marker.data.timezone ?? "",
    qrUrl: marker.data.qrUrl,
    qrCodeData: marker.data.qrCodeData,
    qrImagePath: marker.data.qrImagePath,
    hasQrCode: marker.data.hasQrCode,
    qrGeneratedAt: marker.data.qrGeneratedAt,
    qrDetectedInImage: marker.data.qrDetectedInImage,
    detectedQrData: marker.data.detectedQrData,
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

  // Add cache for search results
  const searchCache = useRef<Map<string, { results: EventType[], nextCursor?: string }>>(new Map());
  const lastSearchQuery = useRef<string>("");

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

      // Check if we're fetching more results for the same query
      if (!reset && searchQuery === lastSearchQuery.current) {
        // Use cached results if available
        const cached = searchCache.current.get(searchQuery);
        if (cached && !nextCursor) {
          setEventResults(cached.results);
          setNextCursor(cached.nextCursor);
          setHasMoreResults(!!cached.nextCursor);
          return;
        }
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
          eventDate: result.eventDate,
          endDate: result.endDate,
          time: new Date(result.eventDate).toLocaleString(),
          coordinates: result.location.coordinates,
          location: result.address || "Location not specified",
          locationNotes: result.locationNotes,
          distance: "",
          emoji: result.emoji || "📍",
          categories: result.categories?.map((c) => c.name) || [],
          creator: result.creator,
          scanCount: result.scanCount ?? 1,
          saveCount: result.saveCount ?? 0,
          timezone: result.timezone ?? "",
          qrUrl: result.qrUrl,
          qrCodeData: result.qrCodeData,
          qrImagePath: result.qrImagePath,
          hasQrCode: result.hasQrCode,
          qrGeneratedAt: result.qrGeneratedAt,
          qrDetectedInImage: result.qrDetectedInImage,
          detectedQrData: result.detectedQrData,
        }));

        // Update pagination state
        setNextCursor(response.nextCursor);
        setHasMoreResults(!!response.nextCursor);

        // Cache the results
        if (reset) {
          searchCache.current.set(searchQuery, {
            results: newResults,
            nextCursor: response.nextCursor
          });
          setEventResults(newResults);
        } else {
          // Use functional update to avoid dependency on eventResults
          setEventResults((prev) => {
            const existingIds = new Set(prev.map((event) => event.id));
            const uniqueNewResults = newResults.filter((event) => !existingIds.has(event.id));
            return [...prev, ...uniqueNewResults];
          });
        }

        lastSearchQuery.current = searchQuery;
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
    [searchQuery, nextCursor, initialMarkers]
  );

  // Handle search query changes
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchQuery.trim() && !hasSearched) {
      return;
    }

    // Set new timeout with increased debounce time
    const timeout = setTimeout(() => {
      searchEvents(true);
    }, 500); // Increased from 300ms to 500ms

    setSearchTimeout(timeout);

    // Cleanup timeout on component unmount or query change
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery, hasSearched, searchEvents]);

  // Add debounced load more function
  const debouncedLoadMore = useCallback(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (!isLoading && !isFetchingMore && hasMoreResults && searchQuery.trim()) {
        searchEvents(false);
      }
    }, 500); // Same debounce time as search

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, isFetchingMore, hasMoreResults, searchQuery, searchEvents]);

  // Handle loading more results with debouncing
  const handleLoadMore = useCallback(() => {
    debouncedLoadMore();
  }, [debouncedLoadMore]);

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
