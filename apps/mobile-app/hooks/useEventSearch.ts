// hooks/useEventSearch.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiClient } from "@/services/ApiClient";
import { Marker } from "@/types/types";
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
    isRecurring: marker.data.isRecurring ?? false,
    recurrenceFrequency: marker.data.recurrenceFrequency,
    recurrenceDays: marker.data.recurrenceDays,
    recurrenceStartDate: marker.data.recurrenceStartDate,
    recurrenceEndDate: marker.data.recurrenceEndDate,
    recurrenceInterval: marker.data.recurrenceInterval,
    recurrenceTime: marker.data.recurrenceTime,
    recurrenceExceptions: marker.data.recurrenceExceptions,
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
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const searchInProgress = useRef(false);

  // Initialize with initial markers if available
  useEffect(() => {
    if (initialMarkers.length > 0 && !hasSearched) {
      const initialEvents = initialMarkers.map(markerToEventType);
      setEventResults(initialEvents);
    }
  }, [initialMarkers, hasSearched]);

  // Core search function
  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        if (initialMarkers.length > 0) {
          setEventResults(initialMarkers.map(markerToEventType));
        } else {
          setEventResults([]);
        }
        setHasMoreResults(false);
        setHasSearched(false);
        setIsLoading(false);
        return;
      }

      if (searchInProgress.current) return;
      searchInProgress.current = true;

      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.events.searchEvents(query, {
          limit: 20,
        });

        setEventResults(response.events);
        setHasMoreResults(false);
        setHasSearched(true);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search events. Please try again.");
        setEventResults([]);
      } finally {
        setIsLoading(false);
        searchInProgress.current = false;
      }
    },
    [initialMarkers],
  );

  // Debounced version for auto-search as user types
  const debouncedSearch = useMemo(
    () => debounce((query: string) => executeSearch(query), 400),
    [executeSearch],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Trigger debounced search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsLoading(true);
      debouncedSearch(searchQuery);
    } else if (hasSearched) {
      // Query was cleared — reset to landing page state
      debouncedSearch.cancel();
      if (initialMarkers.length > 0) {
        setEventResults(initialMarkers.map(markerToEventType));
      } else {
        setEventResults([]);
      }
      setHasSearched(false);
      setIsLoading(false);
    }
  }, [searchQuery, debouncedSearch, hasSearched, initialMarkers]);

  const handleLoadMore = useCallback(() => {
    // No-op — current API returns all results at once
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    if (initialMarkers.length > 0) {
      setEventResults(initialMarkers.map(markerToEventType));
    } else {
      setEventResults([]);
    }
    setHasSearched(false);
    setIsLoading(false);
    setIsFetchingMore(false);
  }, [initialMarkers]);

  // Immediate search (for submit button / return key)
  const searchEvents = useCallback(
    async (reset: boolean = true) => {
      if (!searchQuery.trim()) return;
      debouncedSearch.cancel();
      await executeSearch(searchQuery);
    },
    [searchQuery, debouncedSearch, executeSearch],
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
