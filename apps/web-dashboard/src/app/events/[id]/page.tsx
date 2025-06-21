"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { EventEngagementStats } from "@/components/dashboard/EventEngagementStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEvent } from "@/hooks/useEvent";
import { useEventEngagement } from "@/hooks/useEventEngagement";
import { useEventDeletion } from "@/hooks/useEventDeletion";
import { useState } from "react";
import { getCategoryName } from "@/lib/dashboard-data";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { event, loading, error, refetch } = useEvent(eventId);
  const {
    engagement,
    loading: engagementLoading,
    error: engagementError,
  } = useEventEngagement(eventId);
  const { deleteEvent, isDeleting, error: deleteError } = useEventDeletion();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    await deleteEvent(eventId);
    setShowDeleteDialog(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading event details...</span>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error || !event) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-destructive">
                Error Loading Event
              </h2>
              <p className="text-muted-foreground mt-2">
                {error || "Event not found"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={refetch} variant="outline">
                Try Again
              </Button>
              <Link href="/events">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Events
                </Button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/events">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Events
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">
                {event.title}
              </h1>
              <p className="text-muted-foreground">Event Details</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Event</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{event.title}&quot;?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Event"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Delete Error Alert */}
          {deleteError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="text-destructive font-medium">
                  Delete Error
                </span>
              </div>
              <p className="text-destructive/80 mt-1">{deleteError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Event Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{event.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(event.eventDate).toLocaleDateString()} at{" "}
                        {new Date(event.eventDate).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {event.address ||
                          (event.location &&
                          typeof event.location === "object" &&
                          "coordinates" in event.location
                            ? `Lat: ${event.location.coordinates[1]}, Lng: ${event.location.coordinates[0]}`
                            : "Location not specified")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>
                        {event.attendees}{" "}
                        {event.maxAttendees && `/ ${event.maxAttendees}`}{" "}
                        attendees
                      </span>
                    </div>
                    <div>
                      <Badge variant="outline">{getCategoryName(event)}</Badge>
                    </div>
                  </div>

                  {event.address && (
                    <div>
                      <h3 className="font-semibold mb-2">Address</h3>
                      <p className="text-muted-foreground">{event.address}</p>
                    </div>
                  )}

                  {event.qrUrl && (
                    <div>
                      <h3 className="font-semibold mb-2">QR Code URL</h3>
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={event.qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {event.qrUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Engagement Statistics */}
              {engagementLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading engagement data...</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : engagementError ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        Unable to load engagement data: {engagementError}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : engagement ? (
                <EventEngagementStats engagement={engagement} />
              ) : null}

              {/* Attendees */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{event.attendees}</p>
                      <p className="text-muted-foreground">
                        Registered attendees
                      </p>
                    </div>
                    {event.maxAttendees && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Capacity
                        </p>
                        <p className="font-medium">
                          {event.maxAttendees} people
                        </p>
                      </div>
                    )}
                  </div>
                  {event.maxAttendees && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(event.attendees / event.maxAttendees) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {Math.round(
                          (event.attendees / event.maxAttendees) * 100,
                        )}
                        % full
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="default" className="text-sm">
                    {getCategoryName(event)}
                  </Badge>
                </CardContent>
              </Card>

              {/* Event Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Event Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Event Date</p>
                    <p className="text-sm">
                      {new Date(event.eventDate).toLocaleDateString()}
                    </p>
                  </div>
                  {event.endDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="text-sm">
                        {new Date(event.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="text-sm">{getCategoryName(event)}</p>
                  </div>
                  {event.qrUrl && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        QR Code URL
                      </p>
                      <div className="flex items-center gap-1">
                        <QrCode className="h-3 w-3 text-muted-foreground" />
                        <a
                          href={event.qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          View QR Code
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full">Send Reminder</Button>
                  <Button variant="outline" className="w-full">
                    Export Attendees
                  </Button>
                  <Button variant="outline" className="w-full">
                    Share Event
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
