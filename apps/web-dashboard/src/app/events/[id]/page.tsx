"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, ArrowLeft, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id;

  // Mock data - replace with real data from your API
  const event = {
    id: eventId,
    title: "Tech Meetup",
    description:
      "Join us for an evening of networking and tech talks. This event will feature presentations from industry leaders, networking opportunities, and refreshments. Don't miss out on this chance to connect with fellow tech enthusiasts and learn about the latest trends in the industry.",
    date: "2024-01-15",
    time: "18:00",
    location: "Downtown Conference Center",
    address: "123 Main Street, Downtown, City, State 12345",
    attendees: 45,
    maxAttendees: 100,
    category: "Technology",
    status: "upcoming",
    organizer: "Tech Community Group",
    contactEmail: "contact@techmeetup.com",
    contactPhone: "+1 (555) 123-4567",
  };

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
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

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
                        {event.date} at {event.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>
                        {event.attendees} / {event.maxAttendees} attendees
                      </span>
                    </div>
                    <div>
                      <Badge variant="outline">{event.category}</Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Address</h3>
                    <p className="text-muted-foreground">{event.address}</p>
                  </div>
                </CardContent>
              </Card>

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
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Capacity</p>
                      <p className="font-medium">{event.maxAttendees} people</p>
                    </div>
                  </div>
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
                      {Math.round((event.attendees / event.maxAttendees) * 100)}
                      % full
                    </p>
                  </div>
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
                  <Badge
                    variant={
                      event.status === "completed" ? "secondary" : "default"
                    }
                    className="text-sm"
                  >
                    {event.status}
                  </Badge>
                </CardContent>
              </Card>

              {/* Organizer Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Organizer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium">{event.organizer}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm">{event.contactEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-sm">{event.contactPhone}</p>
                  </div>
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
