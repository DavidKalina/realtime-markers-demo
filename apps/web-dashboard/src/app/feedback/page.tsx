"use client";

import { useState, useCallback, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiService as api } from "@/services/api";
import useCivicEngagementSearch from "@/hooks/useCivicEngagementSearch";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper function to get type display name and variant
const getTypeInfo = (type: string) => {
  switch (type) {
    case "POSITIVE_FEEDBACK":
      return { name: "Positive Feedback", variant: "default" as const };
    case "NEGATIVE_FEEDBACK":
      return { name: "Negative Feedback", variant: "destructive" as const };
    case "IDEA":
      return { name: "Idea", variant: "secondary" as const };
    default:
      return { name: type, variant: "outline" as const };
  }
};

// Helper function to get status badge variant with better color coding
const getStatusVariant = (status: string) => {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "UNDER_REVIEW":
      return "default";
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "IMPLEMENTED":
      return "default";
    default:
      return "outline";
  }
};

// Helper function to get status display name with proper formatting
const getStatusDisplayName = (status: string) => {
  return status.toLowerCase().replace(/_/g, " ");
};

// Custom badge components with enhanced color coding
const TypeBadge = ({ type }: { type: string }) => {
  const typeInfo = getTypeInfo(type);
  const getTypeStyles = (type: string) => {
    switch (type) {
      case "POSITIVE_FEEDBACK":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200";
      case "NEGATIVE_FEEDBACK":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      case "IDEA":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
    }
  };

  return (
    <Badge variant="outline" className={`${getTypeStyles(type)} font-medium`}>
      {typeInfo.name}
    </Badge>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200";
      case "IN_REVIEW":
        return "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200";
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200";
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      case "IMPLEMENTED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200";
      case "CLOSED":
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
    }
  };

  return (
    <Badge
      variant="outline"
      className={`${getStatusStyles(status)} font-medium`}
    >
      {getStatusDisplayName(status)}
    </Badge>
  );
};

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function FeedbackPage() {
  const router = useRouter();
  const [civicEngagements, setCivicEngagements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCivicEngagements, setTotalCivicEngagements] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [hasFilters, setHasFilters] = useState(false);

  const ITEMS_PER_PAGE = 10;
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter options
  const typeOptions = [
    { value: "POSITIVE_FEEDBACK", label: "Positive Feedback" },
    { value: "NEGATIVE_FEEDBACK", label: "Negative Feedback" },
    { value: "IDEA", label: "Idea" },
  ];

  const statusOptions = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_REVIEW", label: "In Review" },
    { value: "IMPLEMENTED", label: "Implemented" },
    { value: "CLOSED", label: "Closed" },
  ];

  // Use the search hook with the initial civic engagements
  const {
    searchQuery: searchHookQuery,
    setSearchQuery: setSearchHookQuery,
    civicEngagementResults,
    isLoading: isSearchHookLoading,
    error: searchHookError,
    hasSearched: searchHookHasSearched,
    clearSearch: clearSearchHook,
  } = useCivicEngagementSearch({ initialCivicEngagements: civicEngagements });

  const loadCivicEngagements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const response = await api.getCivicEngagements({
        limit: ITEMS_PER_PAGE,
        offset,
        type: selectedTypes.length > 0 ? selectedTypes : undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      });

      if (response.data) {
        setCivicEngagements(response.data.civicEngagements);
        setTotalCivicEngagements(response.data.total);
        setTotalPages(Math.ceil(response.data.total / ITEMS_PER_PAGE));
      } else {
        setError(response.error || "Failed to load civic engagements");
      }
    } catch (err) {
      setError("Failed to load civic engagements");
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedTypes, selectedStatuses]);

  const handleSearch = useCallback(async () => {
    if (!debouncedSearchQuery.trim()) {
      setHasSearched(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await api.getCivicEngagements({
        search: debouncedSearchQuery,
        limit: ITEMS_PER_PAGE,
        offset: 0,
        type: selectedTypes.length > 0 ? selectedTypes : undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      });

      if (response.data) {
        setCivicEngagements(response.data.civicEngagements);
        setTotalCivicEngagements(response.data.total);
        setTotalPages(Math.ceil(response.data.total / ITEMS_PER_PAGE));
        setCurrentPage(1); // Reset to first page when searching
      } else {
        setSearchError(response.error || "Search failed");
      }
    } catch (err) {
      setSearchError("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [debouncedSearchQuery, selectedTypes, selectedStatuses]);

  const clearSearch = () => {
    setSearchQuery("");
    setHasSearched(false);
    setIsSearching(false);
    setSearchError(null);
    setCurrentPage(1);
    clearFilters();
    loadCivicEngagements();
  };

  // Filter management functions
  const handleTypeFilterChange = (value: string) => {
    const newTypes = selectedTypes.includes(value)
      ? selectedTypes.filter((t) => t !== value)
      : [...selectedTypes, value];
    setSelectedTypes(newTypes);
    setCurrentPage(1);
    setHasFilters(newTypes.length > 0 || selectedStatuses.length > 0);
  };

  const handleStatusFilterChange = (value: string) => {
    const newStatuses = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value];
    setSelectedStatuses(newStatuses);
    setCurrentPage(1);
    setHasFilters(selectedTypes.length > 0 || newStatuses.length > 0);
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setHasFilters(false);
    setCurrentPage(1);
  };

  // Load civic engagements when page changes
  useEffect(() => {
    if (!hasSearched) {
      loadCivicEngagements();
    }
  }, [
    currentPage,
    loadCivicEngagements,
    hasSearched,
    selectedTypes,
    selectedStatuses,
  ]);

  // Handle search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      handleSearch();
    } else if (hasSearched) {
      clearSearch();
    }
  }, [debouncedSearchQuery, handleSearch, hasSearched]);

  // Use search results if there's a search query, otherwise use original civic engagements
  const displayCivicEngagements = hasSearched
    ? civicEngagements
    : civicEngagements;
  const displayLoading = loading || isSearching;
  const displayError = error || searchError;
  const isFiltered = hasFilters || hasSearched;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Feedback</h2>
              <p className="text-muted-foreground">
                Manage and view all civic engagements and feedback
              </p>
            </div>
            <Link href="/feedback/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Feedback
              </Button>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search feedback by title, description, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {hasSearched && (
              <div className="mt-2 text-sm text-muted-foreground">
                {displayCivicEngagements.length > 0
                  ? `Found ${totalCivicEngagements} feedback item${totalCivicEngagements === 1 ? "" : "s"}`
                  : "No feedback found"}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Type Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      selectedTypes.includes(option.value)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => handleTypeFilterChange(option.value)}
                    className="h-8 px-3 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={
                      selectedStatuses.includes(option.value)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => handleStatusFilterChange(option.value)}
                    className="h-8 px-3 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            {displayLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                {isFiltered
                  ? "Loading filtered feedback..."
                  : "Loading feedback..."}
              </div>
            ) : displayError ? (
              <div className="p-8 text-center text-destructive">
                {displayError}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayCivicEngagements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          {isFiltered
                            ? "No feedback matches your filters"
                            : "No feedback found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayCivicEngagements.map((civicEngagement) => (
                        <TableRow
                          key={civicEngagement.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            router.push(`/feedback/${civicEngagement.id}`)
                          }
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {civicEngagement.title}
                              </div>
                              <div className="text-sm text-muted-foreground max-w-xs truncate overflow-ellipsis">
                                {civicEngagement.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TypeBadge type={civicEngagement.type} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={civicEngagement.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>
                                {civicEngagement?.address || "No location"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {civicEngagement.createdAt
                                  ? format(
                                      new Date(civicEngagement.createdAt),
                                      "MMM d, yyyy",
                                    )
                                  : "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              <span>View Details</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between space-x-2 py-4 px-6">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages} •{" "}
                      {totalCivicEngagements} total items
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
