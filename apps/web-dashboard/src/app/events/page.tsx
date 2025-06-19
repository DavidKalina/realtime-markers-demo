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
import { Calendar, MapPin, Users, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEvents } from "@/hooks/useEvents";
import useEventSearch from "@/hooks/useEventSearch";
import { getCategoryName } from "@/lib/dashboard-data";
import { format } from "date-fns";

export default function EventsPage() {
  const router = useRouter();
  const { events, loading, error } = useEvents();

  // Use the search hook with the initial events
  const {
    searchQuery,
    setSearchQuery,
    eventResults,
    isLoading: isSearching,
    error: searchError,
    hasSearched,
    clearSearch,
  } = useEventSearch({ initialEvents: events });

  // Use search results if there's a search query, otherwise use original events
  const displayEvents = hasSearched ? eventResults : events;
  const displayLoading = loading || isSearching;
  const displayError = error || searchError;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Events</h2>
              <p className="text-muted-foreground">
                Manage and view all events
              </p>
            </div>
            <Link href="/events/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search events by title, description, or location..."
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
                {displayEvents.length > 0
                  ? `Found ${displayEvents.length} event${displayEvents.length === 1 ? "" : "s"}`
                  : "No events found"}
              </div>
            )}
          </div>

          <div className="rounded-md border">
            {displayLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                {hasSearched ? "Searching events..." : "Loading events..."}
              </div>
            ) : displayError ? (
              <div className="p-8 text-center text-destructive">
                {displayError}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayEvents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        {hasSearched
                          ? "No events match your search"
                          : "No events found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayEvents.map((event) => (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/events/${event.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{event.title}</div>
                            <div className="text-sm text-muted-foreground max-w-xs truncate overflow-ellipsis">
                              {event.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {event.eventDate
                                ? format(
                                    new Date(event.eventDate),
                                    "MMM d, yyyy, h:mm a",
                                  )
                                : "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{event?.address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCategoryName(event)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{event.attendees || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.endDate &&
                              new Date(event.endDate) < new Date()
                                ? "secondary"
                                : "default"
                            }
                          >
                            {event.endDate &&
                            new Date(event.endDate) < new Date()
                              ? "completed"
                              : "upcoming"}
                          </Badge>
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
