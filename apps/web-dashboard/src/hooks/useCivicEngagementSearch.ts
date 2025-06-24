import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import debounce from "lodash/debounce";

interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: "POSITIVE_FEEDBACK" | "NEGATIVE_FEEDBACK" | "IDEA";
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
  adminNotes?: string;
  implementedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseCivicEngagementSearchProps {
  initialCivicEngagements: CivicEngagement[];
}

interface UseCivicEngagementSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  civicEngagementResults: CivicEngagement[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  clearSearch: () => void;
}

const useCivicEngagementSearch = ({
  initialCivicEngagements,
}: UseCivicEngagementSearchProps): UseCivicEngagementSearchReturn => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [civicEngagementResults, setCivicEngagementResults] = useState<
    CivicEngagement[]
  >([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInProgress = useRef(false);
  const lastSearchQuery = useRef<string>("");

  // Initialize with initial civic engagements if available
  useEffect(() => {
    if (initialCivicEngagements.length > 0 && !hasSearched) {
      setCivicEngagementResults(initialCivicEngagements);
    }
  }, [initialCivicEngagements, hasSearched]);

  // Create a debounced search function that persists across renders
  const debouncedSearchCivicEngagements = useMemo(
    () =>
      debounce(async (query: string, reset = false) => {
        if (!query.trim()) {
          if (initialCivicEngagements.length > 0) {
            setCivicEngagementResults(initialCivicEngagements);
          } else {
            setCivicEngagementResults([]);
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
          const response = await api.get<{
            civicEngagements: CivicEngagement[];
            total: number;
            scores?: Array<{ id: string; score: number }>;
          }>(`/api/civic-engagements/search/${encodeURIComponent(query)}`);

          setCivicEngagementResults(response.civicEngagements);
          setHasSearched(true);
        } catch (err) {
          console.error("Search error:", err);
          setError("Failed to search civic engagements. Please try again.");
          if (reset) {
            setCivicEngagementResults([]);
          }
        } finally {
          setIsLoading(false);
          searchInProgress.current = false;
        }
      }, 500),
    [initialCivicEngagements],
  );

  // Clean up the debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearchCivicEngagements.cancel();
    };
  }, [debouncedSearchCivicEngagements]);

  // Update search when query changes
  useEffect(() => {
    if (searchQuery.trim() || hasSearched) {
      debouncedSearchCivicEngagements(searchQuery, true);
    }
  }, [searchQuery, hasSearched, debouncedSearchCivicEngagements]);

  // Clear search query
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    if (initialCivicEngagements.length > 0) {
      setCivicEngagementResults(initialCivicEngagements);
    } else {
      setCivicEngagementResults([]);
    }
    setHasSearched(false);
    setIsLoading(false);
    lastSearchQuery.current = "";
  }, [initialCivicEngagements]);

  return {
    searchQuery,
    setSearchQuery,
    civicEngagementResults,
    isLoading,
    error,
    hasSearched,
    clearSearch,
  };
};

export default useCivicEngagementSearch;
