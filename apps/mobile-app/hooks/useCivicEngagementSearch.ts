import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiClient } from "@/services/ApiClient";
import { CivicEngagement } from "@/services/ApiClient";
import debounce from "lodash/debounce";

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
          const response =
            await apiClient.civicEngagements.searchCivicEngagements(
              query,
              50, // Limit search results
            );

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
