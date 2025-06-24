"use client";

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
import { Calendar, MapPin, MessageSquare, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCivicEngagements } from "@/hooks/useCivicEngagements";
import useCivicEngagementSearch from "@/hooks/useCivicEngagementSearch";
import { format } from "date-fns";

// Helper function to get type display name
const getTypeName = (type: string) => {
  switch (type) {
    case "POSITIVE_FEEDBACK":
      return "Positive Feedback";
    case "NEGATIVE_FEEDBACK":
      return "Negative Feedback";
    case "IDEA":
      return "Idea";
    default:
      return type;
  }
};

// Helper function to get status badge variant
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

export default function FeedbackPage() {
  const router = useRouter();
  const { civicEngagements, loading, error } = useCivicEngagements();

  // Use the search hook with the initial civic engagements
  const {
    searchQuery,
    setSearchQuery,
    civicEngagementResults,
    isLoading: isSearching,
    error: searchError,
    hasSearched,
    clearSearch,
  } = useCivicEngagementSearch({ initialCivicEngagements: civicEngagements });

  // Use search results if there's a search query, otherwise use original civic engagements
  const displayCivicEngagements = hasSearched
    ? civicEngagementResults
    : civicEngagements;
  const displayLoading = loading || isSearching;
  const displayError = error || searchError;

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
                  ? `Found ${displayCivicEngagements.length} feedback item${displayCivicEngagements.length === 1 ? "" : "s"}`
                  : "No feedback found"}
              </div>
            )}
          </div>

          <div className="rounded-md border">
            {displayLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                {hasSearched ? "Searching feedback..." : "Loading feedback..."}
              </div>
            ) : displayError ? (
              <div className="p-8 text-center text-destructive">
                {displayError}
              </div>
            ) : (
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
                        {hasSearched
                          ? "No feedback matches your search"
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
                          <Badge variant="outline">
                            {getTypeName(civicEngagement.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusVariant(civicEngagement.status)}
                          >
                            {civicEngagement.status
                              .toLowerCase()
                              .replace("_", " ")}
                          </Badge>
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
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
