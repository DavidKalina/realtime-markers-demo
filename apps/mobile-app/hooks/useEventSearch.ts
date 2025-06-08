// hooks/useEventSearch.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiClient } from "@/services/ApiClient";
import { Marker } from "@/hooks/useMapWebsocket";
import { EventType } from "@/types/types";
import debounce from "lodash/debounce";

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
    categories: (marker.data.categories || []).map((cat) =>
      typeof cat === "string" ? { id: cat, name: cat } : cat,
    ),
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
    createdAt: marker.data.createdAt,
    updatedAt: marker.data.updatedAt,
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

const useEventSearch = ({
  initialMarkers,
}: UseEventSearchProps): UseEventSearchReturn => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventResults, setEventResults] = useState<EventType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const searchInProgress = useRef(false);
  const lastSearchQuery = useRef<string>("");
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Initialize with initial markers if available
  useEffect(() => {
    if (initialMarkers.length > 0 && !hasSearched) {
      const initialEvents = initialMarkers.map(markerToEventType);
      setEventResults(initialEvents);
    }
  }, [initialMarkers, hasSearched]);

  // Create a debounced search function that persists across renders
  const debouncedSearchEvents = useMemo(
    () =>
      debounce(async (query: string, reset: boolean = true) => {
        // Clear any pending timeouts
        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current);
        }

        if (!query.trim()) {
          if (initialMarkers.length > 0) {
            const initialEvents = initialMarkers.map(markerToEventType);
            setEventResults(initialEvents);
          } else {
            setEventResults([]);
          }
          setHasMoreResults(false);
          setNextCursor(undefined);
          setHasSearched(false);
          setIsLoading(false);
          setIsFetchingMore(false);
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
            setIsFetchingMore(false);
          } else {
            setIsFetchingMore(true);
          }
          setError(null);

          const response = await apiClient.events.searchEvents(query, {
            limit: 10,
            cursor: reset ? undefined : nextCursor,
          });

          // Since the new API doesn't support pagination, we'll just use the results directly
          const newResults = response.events;

          setEventResults(newResults);
          setHasMoreResults(false); // No pagination in new API
          setNextCursor(undefined);
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
          searchInProgress.current = false;
        }
      }, 800),
    [initialMarkers], // Removed nextCursor from dependencies since we don't use pagination anymore
  );

  // Clean up the debounced function and timeouts on unmount
  useEffect(() => {
    return () => {
      debouncedSearchEvents.cancel();
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [debouncedSearchEvents]);

  // Update search when query changes
  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      // Clear any pending timeouts
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      // Set a new timeout to prevent immediate double renders
      searchTimeout.current = setTimeout(() => {
        debouncedSearchEvents(searchQuery, true);
      }, 100);
    }
  }, [searchQuery, hasSearched, debouncedSearchEvents]);

  // Update handleLoadMore to be a no-op since we don't have pagination
  const handleLoadMore = useCallback(() => {
    // No-op since the new API doesn't support pagination
    console.log("Pagination is not supported in the current API version");
  }, []);

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
    setIsLoading(false);
    setIsFetchingMore(false);
    lastSearchQuery.current = "";
  }, [initialMarkers]);

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
